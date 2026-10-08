#!/usr/bin/python3
"""Promote one SirfBazar release; never migrate data or manage other services."""
import fcntl
import grp
import hashlib
import json
import os
from pathlib import Path
import pwd
import shutil
import signal
import stat
import subprocess
import sys
import uuid

sys.path.insert(0, "/usr/local/libexec/sirfbazar-deploy")
from archive import MAX_ARCHIVE, extract, file_hash, schema_hash, validate_identity, verify_tree

RELEASES = Path("/opt/sirfbazar-api/releases")
CURRENT = Path("/opt/sirfbazar-api/current")
BACKUPS = Path("/var/backups/sirfbazar-api")
ENVIRONMENT = Path("/etc/sirfbazar-api.env")
UNIT = Path("/etc/systemd/system/sirfbazar-api.service")
SERVICE = "sirfbazar-api.service"


class DeploymentError(Exception):
    pass


def check_schema(previous, candidate):
    if schema_hash(previous / "prisma/schema.prisma") != schema_hash(candidate / "prisma/schema.prisma"):
        raise DeploymentError("Prisma schema changed; an approved manual migration is required")


def swap_pointer(current, release):
    temporary = current.with_name(".current-deploy-" + uuid.uuid4().hex)
    temporary.symlink_to(release, target_is_directory=True)
    try:
        os.replace(temporary, current)
    finally:
        temporary.unlink(missing_ok=True)


def cutover(current, candidate, restart, healthcheck):
    previous = current.resolve(strict=True)
    try:
        swap_pointer(current, candidate)
        restart()
        healthcheck()
    except BaseException as error:
        try:
            swap_pointer(current, previous)
            restart()
            healthcheck()
        except BaseException:
            raise DeploymentError("Deployment and rollback health checks failed; operator intervention required") from error
        raise DeploymentError("Deployment failed; previous API release restored and verified") from error
    return previous


def command(arguments, **kwargs):
    return subprocess.run(arguments, check=True, timeout=180, **kwargs)


def restart():
    command(["/usr/bin/systemctl", "restart", SERVICE])


def healthcheck():
    command(["/usr/sbin/runuser", "-u", "sirfbazar-api", "--", "/usr/bin/node",
             "--env-file=/etc/sirfbazar-api.env", "/usr/local/libexec/sirfbazar-deploy/healthcheck.cjs"])


def copy_upload(source, destination, digest):
    owner = pwd.getpwnam("sirfbazar-deploy").pw_uid
    descriptor = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
    checksum, size = hashlib.sha256(), 0
    with os.fdopen(descriptor, "rb") as upload:
        info = os.fstat(upload.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != owner or info.st_nlink != 1 or info.st_size > MAX_ARCHIVE:
            raise DeploymentError("Unsafe uploaded archive")
        with destination.open("xb") as output:
            destination.chmod(0o600)
            while chunk := upload.read(65536):
                size += len(chunk)
                if size > MAX_ARCHIVE:
                    raise DeploymentError("Oversized uploaded archive")
                output.write(chunk)
                checksum.update(chunk)
    if not size or checksum.hexdigest() != digest:
        raise DeploymentError("Uploaded archive checksum mismatch")


def database_backup(destination):
    with destination.open("xb") as output:
        destination.chmod(0o600)
        command(["/usr/sbin/runuser", "-u", "postgres", "--", "/usr/bin/pg_dump",
                 "--host=/var/run/postgresql", "--dbname=sirfbazar", "--format=custom",
                 "--no-owner", "--no-privileges"], stdout=output, stderr=subprocess.DEVNULL)
    command(["/usr/bin/pg_restore", "--list", str(destination)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if destination.stat().st_size == 0:
        raise DeploymentError("Empty database backup")


def freeze_release(release):
    group = grp.getgrnam("sirfbazar-api").gr_gid
    for directory, dirs, files in os.walk(release, followlinks=False):
        for name in files:
            filename = Path(directory) / name
            if filename.is_symlink():
                os.chown(filename, 0, group, follow_symlinks=False)
            else:
                executable = filename.stat().st_mode & 0o111
                os.chown(filename, 0, group)
                filename.chmod(0o750 if executable else 0o640)
        os.chown(directory, 0, group)
        Path(directory).chmod(0o750)


def interrupted(*_):
    raise DeploymentError("Deployment interrupted")


def status():
    # The deploy account cannot traverse the private runtime directory or read its secrets.
    release = CURRENT.resolve(strict=True)
    if not CURRENT.is_symlink() or release.parent != RELEASES:
        raise DeploymentError("Current API release is outside the approved release directory")
    service = subprocess.run(["/usr/bin/systemctl", "is-active", SERVICE], capture_output=True, text=True, timeout=10)
    print(json.dumps({"release": release.name, "service": service.stdout.strip()}))
    return service.returncode


def entrypoint(arguments):
    if os.geteuid() != 0:
        raise DeploymentError("The validating deployment helper must run through its restricted sudo rule")
    if arguments == ["status"]:
        return status()
    if len(arguments) != 2:
        raise DeploymentError("Exactly one release identity and checksum are required")
    main(*arguments)
    return 0


def main(release_id, digest):
    if os.geteuid() != 0:
        raise DeploymentError("Root-owned promotion helper must run through its restricted sudo rule")
    validate_identity(release_id, digest)
    signal.signal(signal.SIGHUP, signal.SIG_IGN)
    signal.signal(signal.SIGTERM, interrupted)
    os.umask(0o077)
    with open("/run/lock/sirfbazar-api-deploy.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        previous = CURRENT.resolve(strict=True)
        if not CURRENT.is_symlink() or previous.parent != RELEASES or previous.is_symlink():
            raise DeploymentError("Current API release is outside the approved release directory")
        if shutil.disk_usage(RELEASES).free < 3 * 1024 ** 3:
            raise DeploymentError("Less than 3 GiB free; operator cleanup required")
        candidate = RELEASES / release_id
        if candidate.exists() or candidate.is_symlink():
            raise DeploymentError("Release already exists; use a new workflow attempt")
        protected = {name: file_hash(name) for name in (ENVIRONMENT, UNIT)}
        work = Path("/opt/sirfbazar-api/deploy-work")
        work.mkdir(mode=0o700, exist_ok=True)
        private_archive = work / (release_id + ".tar.gz")
        copy_upload(Path("/var/lib/sirfbazar-deploy/incoming") / (release_id + ".tar.gz"), private_archive, digest)
        # Bound parser metadata too, not just expanded file payloads. Restore the
        # address-space limit before spawning Node, which reserves a large heap.
        import resource
        original_limit = resource.getrlimit(resource.RLIMIT_AS)
        resource.setrlimit(resource.RLIMIT_AS, (192 * 1024 ** 2, original_limit[1]))
        try:
            extract(private_archive, candidate)
            verify_tree(candidate, release_id[:40])
        finally:
            resource.setrlimit(resource.RLIMIT_AS, original_limit)
        check_schema(previous, candidate)
        # Read-only preflight also verifies that WhatsApp is ready before restarting.
        healthcheck()
        BACKUPS.mkdir(mode=0o700, exist_ok=True)
        dump = BACKUPS / (release_id + ".dump")
        database_backup(dump)
        freeze_release(candidate)

        def verify_health_and_config():
            healthcheck()
            if any(file_hash(name) != checksum for name, checksum in protected.items()):
                raise DeploymentError("Live environment or service definition changed during deployment")

        cutover(CURRENT, candidate, restart, verify_health_and_config)
        proof = {"release": release_id, "sha": release_id[:40], "previousRelease": previous.name,
                 "backup": str(dump), "archiveSha256": digest, "configurationUnchanged": True}
        with (BACKUPS / (release_id + ".json")).open("x") as report:
            json.dump(proof, report)
        private_archive.unlink()
        (Path("/var/lib/sirfbazar-deploy/incoming") / (release_id + ".tar.gz")).unlink(missing_ok=True)
        print(json.dumps(proof))


if __name__ == "__main__":
    try:
        sys.exit(entrypoint(sys.argv[1:]))
    except Exception as error:
        message = str(error) if isinstance(error, DeploymentError) else "Deployment refused; inspect the server before retrying"
        print(message, file=sys.stderr)
        sys.exit(1)
