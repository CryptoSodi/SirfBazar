import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import types
import unittest
from unittest.mock import patch

from archive import MAX_ARCHIVE, extract, safe_name, schema_hash, validate_identity, verify_tree

# Exercise pure promotion functions on Windows too; Unix-only entrypoints stay uncalled.
if os.name == "nt":
    for name in ("fcntl", "grp", "pwd"):
        sys.modules[name] = types.ModuleType(name)
import promote

spec = importlib.util.spec_from_file_location("ssh_command", Path(__file__).with_name("ssh-command.py"))
ssh_command = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ssh_command)
SHA = "a" * 40
RELEASE = SHA + "-123-1"
CHECKSUM = "b" * 64


class DeployTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def make_archive(self, entries):
        filename = self.root / "release.tar.gz"
        with tarfile.open(filename, "w:gz") as archive:
            for name, kind, value in entries:
                info = tarfile.TarInfo(name)
                info.type = kind
                info.mode = 0o755 if kind == tarfile.DIRTYPE else 0o644
                if kind == tarfile.REGTYPE:
                    info.size = len(value)
                    archive.addfile(info, io.BytesIO(value))
                else:
                    info.linkname = value
                    archive.addfile(info)
        return filename

    def fixture(self):
        files = {"dist/main.js": b"console.log('fixture');", "prisma/schema.prisma": b"// fixture\n",
                 "package.json": b"{}", "package-lock.json": b"{}",
                 "node_modules/@prisma/client/package.json": b"{}", "node_modules/.prisma/client/default.js": b"// generated\n"}
        manifest = {"repository": "CryptoSodi/SirfBazar", "sha": SHA, "nodeMajor": 22, "platform": "linux", "arch": "x64",
                    "schemaSha256": hashlib.sha256(files["prisma/schema.prisma"]).hexdigest(),
                    "files": [{"path": name, "bytes": len(value), "sha256": hashlib.sha256(value).hexdigest()} for name, value in files.items()]}
        files["release.json"] = json.dumps(manifest).encode()
        archive = self.make_archive([(name, tarfile.REGTYPE, data) for name, data in files.items()])
        destination = self.root / "extracted"
        extract(archive, destination)
        return destination

    def symlink(self, link, target):
        try:
            link.symlink_to(target, target_is_directory=target.is_dir())
        except OSError:
            self.skipTest("OS does not grant symbolic-link creation; Linux CI runs this check")

    def test_identity_and_forced_commands(self):
        validate_identity(RELEASE, CHECKSUM)
        self.assertEqual(ssh_command.parse_command(f"upload {RELEASE} {CHECKSUM}"), ("upload", RELEASE, CHECKSUM))
        self.assertEqual(ssh_command.parse_command(f"deploy {RELEASE} {CHECKSUM}"), ("deploy", RELEASE, CHECKSUM))
        self.assertEqual(ssh_command.parse_command("status"), ("status", None, None))
        for command in ("bash", "scp -t /tmp", "status; id", "status\n", f"deploy ../bad {CHECKSUM}",
                        f"deploy {RELEASE} {CHECKSUM}; id", f"deploy {SHA}-0-1 {CHECKSUM}"):
            with self.subTest(command=command), self.assertRaises(ValueError):
                ssh_command.parse_command(command)

    def test_paths(self):
        self.assertEqual(safe_name("./dist/main.js"), "dist/main.js")
        for name in ("/etc/passwd", "dist/../../etc/passwd", "dist\\bad", "dist/a\n", "other/file", "src/.env", "src/.env.production", "dist/C:evil"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                safe_name(name)

    def test_status_uses_only_privileged_metadata_helper(self):
        with patch.dict(os.environ, {"SSH_ORIGINAL_COMMAND": "status"}), patch.object(ssh_command.subprocess, "run") as run:
            run.return_value.returncode = 0
            self.assertEqual(ssh_command.main(), 0)
        run.assert_called_once_with(["/usr/bin/sudo", "-n", "/usr/local/libexec/sirfbazar-deploy/promote.py", "status"])

    def test_helper_dispatch_rejects_nonroot_and_extra_status_arguments(self):
        with patch.object(os, "geteuid", return_value=1000, create=True), self.assertRaises(promote.DeploymentError):
            promote.entrypoint(["status"])
        with patch.object(os, "geteuid", return_value=0, create=True), patch.object(promote, "status", return_value=0) as status:
            self.assertEqual(promote.entrypoint(["status"]), 0)
            status.assert_called_once_with()
            for arguments in ([], ["bash"], ["status", "extra", "argument"]):
                with self.subTest(arguments=arguments), self.assertRaises(promote.DeploymentError):
                    promote.entrypoint(arguments)
            with self.assertRaises(ValueError):
                promote.entrypoint(["status", "extra"])

    def test_status_only_reports_release_and_service(self):
        releases = self.root / "releases"
        release = releases / RELEASE
        release.mkdir(parents=True)
        current = self.root / "current"
        self.symlink(current, release)
        output = io.StringIO()
        with patch.object(promote, "CURRENT", current), patch.object(promote, "RELEASES", releases), \
                patch.object(promote.subprocess, "run") as run, patch("sys.stdout", output):
            run.return_value.returncode = 0
            run.return_value.stdout = "active\n"
            self.assertEqual(promote.status(), 0)
        self.assertEqual(json.loads(output.getvalue()), {"release": RELEASE, "service": "active"})
        run.assert_called_once_with(["/usr/bin/systemctl", "is-active", "sirfbazar-api.service"], capture_output=True, text=True, timeout=10)

    def test_valid_release(self):
        root = self.fixture()
        self.assertEqual(verify_tree(root, SHA)["sha"], SHA)

    def test_wrong_revision(self):
        with self.assertRaises(ValueError):
            verify_tree(self.fixture(), "c" * 40)

    def test_tampered_file(self):
        root = self.fixture()
        (root / "dist/main.js").write_bytes(b"tampered")
        with self.assertRaises(ValueError):
            verify_tree(root, SHA)

    def test_unmanifested_file(self):
        root = self.fixture()
        (root / "dist/extra.js").write_bytes(b"extra")
        with self.assertRaises(ValueError):
            verify_tree(root, SHA)

    def test_missing_file(self):
        root = self.fixture()
        (root / "dist/main.js").unlink()
        with self.assertRaises(ValueError):
            verify_tree(root, SHA)

    def test_unsafe_archives(self):
        cases = [
            [("dist/../../escape", tarfile.REGTYPE, b"x")],
            [("dist/one", tarfile.REGTYPE, b"x"), ("dist/one", tarfile.REGTYPE, b"y")],
            [("dist/hard", tarfile.LNKTYPE, "dist/main.js")],
            [("dist/fifo", tarfile.FIFOTYPE, "")],
            [("dist/link", tarfile.SYMTYPE, "/etc/passwd")],
            [("dist/link", tarfile.SYMTYPE, "../../etc/passwd")],
            [("dist/parent", tarfile.REGTYPE, b"x"), ("dist/parent/child", tarfile.REGTYPE, b"x")],
            [("dist/link", tarfile.SYMTYPE, "main.js"), ("dist/main.js", tarfile.REGTYPE, b"x"),
             ("dist/link/child", tarfile.REGTYPE, b"x")],
        ]
        for index, entries in enumerate(cases):
            with self.subTest(index=index), self.assertRaises(ValueError):
                extract(self.make_archive(entries), self.root / f"unsafe-{index}")

    @unittest.skipIf(os.name == "nt", "POSIX dependency symlinks are verified on Linux CI")
    def test_relative_dependency_link(self):
        archive = self.make_archive([("node_modules/tool/bin.js", tarfile.REGTYPE, b"fixture"),
                                     ("node_modules/.bin/tool", tarfile.SYMTYPE, "../tool/bin.js")])
        try:
            extract(archive, self.root / "linked")
        except OSError:
            self.skipTest("OS does not grant symbolic-link creation; Linux CI runs this check")
        self.assertEqual((self.root / "linked/node_modules/.bin/tool").read_bytes(), b"fixture")

    def test_oversized_upload(self):
        archive = self.root / "oversized"
        with archive.open("wb") as output:
            output.truncate(MAX_ARCHIVE + 1)
        with self.assertRaises(ValueError):
            extract(archive, self.root / "too-large")

    def test_schema_changes_block_but_line_endings_do_not(self):
        before, after = self.root / "before", self.root / "after"
        for root in (before, after):
            (root / "prisma").mkdir(parents=True)
        (before / "prisma/schema.prisma").write_bytes(b"schema\r\n")
        (after / "prisma/schema.prisma").write_bytes(b"schema\n")
        self.assertEqual(schema_hash(before / "prisma/schema.prisma"), schema_hash(after / "prisma/schema.prisma"))
        promote.check_schema(before, after)
        (after / "prisma/schema.prisma").write_bytes(b"new schema\n")
        with self.assertRaises(promote.DeploymentError):
            promote.check_schema(before, after)

    def pointer_fixture(self):
        old, new = self.root / "old", self.root / "new"
        old.mkdir()
        new.mkdir()
        current = self.root / "current"
        self.symlink(current, old)
        return current, old, new

    @unittest.skipIf(os.name == "nt", "Atomic directory-symlink replacement requires Linux")
    def test_successful_cutover(self):
        current, old, new = self.pointer_fixture()
        events = []
        self.assertEqual(promote.cutover(current, new, lambda: events.append("restart"), lambda: events.append("health")), old)
        self.assertEqual(current.resolve(), new)
        self.assertEqual(events, ["restart", "health"])

    @unittest.skipIf(os.name == "nt", "Atomic directory-symlink replacement requires Linux")
    def test_health_failure_rolls_back(self):
        current, old, new = self.pointer_fixture()
        events = []

        def health():
            events.append(current.resolve().name)
            if current.resolve() == new:
                raise RuntimeError("fixture failure")

        with self.assertRaisesRegex(promote.DeploymentError, "previous API release restored"):
            promote.cutover(current, new, lambda: events.append("restart"), health)
        self.assertEqual(current.resolve(), old)
        self.assertEqual(events, ["restart", "new", "restart", "old"])

    @unittest.skipIf(os.name == "nt", "Atomic directory-symlink replacement requires Linux")
    def test_failed_rollback_requires_operator(self):
        current, old, new = self.pointer_fixture()

        def health():
            raise RuntimeError("fixture failure")

        with self.assertRaisesRegex(promote.DeploymentError, "operator intervention"):
            promote.cutover(current, new, lambda: None, health)
        self.assertEqual(current.resolve(), old)

    def test_no_automatic_schema_or_other_service_commands(self):
        source = Path(promote.__file__).read_text()
        self.assertNotIn('"db", "push"', source)
        self.assertNotIn('"migrate"', source)
        self.assertNotIn('"seed"', source)
        self.assertNotIn('"reload"', source)
        self.assertIn('SERVICE = "sirfbazar-api.service"', source)

    def test_restart_only_manages_sirfbazar(self):
        with patch.object(promote, "command") as run:
            promote.restart()
        run.assert_called_once_with(["/usr/bin/systemctl", "restart", "sirfbazar-api.service"])

    def test_health_checker_drops_to_api_user(self):
        with patch.object(promote, "command") as run:
            promote.healthcheck()
        self.assertEqual(run.call_args.args[0], ["/usr/sbin/runuser", "-u", "sirfbazar-api", "--", "/usr/bin/node",
                                               "--env-file=/etc/sirfbazar-api.env", "/usr/local/libexec/sirfbazar-deploy/healthcheck.cjs"])


if __name__ == "__main__":
    unittest.main()
