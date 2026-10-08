"""Bounded release archives; no runtime configuration or migration commands."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import tarfile

MAX_ARCHIVE = 200 * 1024 * 1024
MAX_EXPANDED = 768 * 1024 * 1024
ALLOWED = {"dist", "src", "prisma", "scripts", "node_modules", "package.json", "package-lock.json", "release.json"}
RELEASE_ID = r"[a-f0-9]{40}-[1-9][0-9]{0,19}-[1-9][0-9]{0,9}"
DIGEST = r"[a-f0-9]{64}"


def validate_identity(release_id, digest):
    if not re.fullmatch(RELEASE_ID, release_id) or not re.fullmatch(DIGEST, digest):
        raise ValueError("Invalid release identity")


def file_hash(filename):
    digest = hashlib.sha256()
    with open(filename, "rb") as source:
        for chunk in iter(lambda: source.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def schema_hash(filename):
    return hashlib.sha256(Path(filename).read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def safe_name(name):
    while name.startswith("./"):
        name = name[2:]
    name = name.rstrip("/")
    if name in ("", "."):
        return ""
    parts = PurePosixPath(name).parts
    if (name.startswith("/") or "\\" in name or any(ord(c) < 32 or ord(c) == 127 for c in name)
            or any(part in ("..", ".") or ":" in part for part in parts)
            or parts[0] not in ALLOWED
            or any(part == ".env" or part.startswith(".env.") for part in parts)):
        raise ValueError("Unsafe release path")
    return str(PurePosixPath(name))


def extract(archive, destination):
    archive, destination = Path(archive), Path(destination)
    if archive.is_symlink() or archive.stat().st_size > MAX_ARCHIVE:
        raise ValueError("Unsafe or oversized archive")
    with tarfile.open(archive, "r:gz") as source:
        entries, expanded = {}, 0
        for index, member in enumerate(source):
            if index >= 60000:
                raise ValueError("Too many release entries")
            name = safe_name(member.name)
            if not name and member.isdir():
                continue
            if not name or name in entries or member.mode & 0o7000:
                raise ValueError("Duplicate or privileged archive entry")
            if not (member.isdir() or member.isfile() or member.issym()):
                raise ValueError("Unsupported archive entry type")
            expanded += member.size
            if expanded > MAX_EXPANDED or member.size < 0:
                raise ValueError("Expanded release is too large")
            entries[name] = member
        for name, member in entries.items():
            for parent in PurePosixPath(name).parents:
                if str(parent) != "." and str(parent) in entries and not entries[str(parent)].isdir():
                    raise ValueError("Archive path has a non-directory parent")
            if member.issym():
                target = member.linkname
                if target.startswith("/") or "\\" in target or any(ord(c) < 32 for c in target):
                    raise ValueError("Unsafe dependency symlink")
                resolved = safe_name(posixpath.normpath(posixpath.join(posixpath.dirname(name), target)))
                if resolved not in entries or not entries[resolved].isfile():
                    raise ValueError("Dependency link must target an archived regular file")
        destination.mkdir(mode=0o700)
        # Materialize only validated members; ignore archive owners and permissions.
        for name, member in entries.items():
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            if member.isdir():
                target.mkdir(exist_ok=True, mode=0o700)
            elif member.issym():
                target.symlink_to(member.linkname)
            else:
                with source.extractfile(member) as contents, target.open("xb") as output:
                    remaining = member.size
                    while remaining:
                        chunk = contents.read(min(remaining, 65536))
                        if not chunk:
                            raise ValueError("Truncated archive entry")
                        output.write(chunk)
                        remaining -= len(chunk)
                target.chmod(0o700 if member.mode & 0o111 else 0o600)


def verify_tree(root, sha):
    root = Path(root)
    manifest_path = root / "release.json"
    if manifest_path.is_symlink() or manifest_path.stat().st_size > 16 * 1024 * 1024:
        raise ValueError("Invalid manifest")
    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    expected = {"repository": "CryptoSodi/SirfBazar", "sha": sha, "nodeMajor": 22, "platform": "linux", "arch": "x64"}
    if any(manifest.get(key) != value for key, value in expected.items()):
        raise ValueError("Release runtime or commit does not match")
    records = {}
    for record in manifest["files"]:
        name = safe_name(record["path"])
        if not name or name == "release.json" or name in records:
            raise ValueError("Invalid manifest file")
        records[name] = record
    actual = set()
    for directory, dirs, files in os.walk(root, followlinks=False):
        if any((Path(directory) / name).is_symlink() for name in dirs):
            raise ValueError("Directory symlinks are not allowed")
        for name in files:
            filename = Path(directory) / name
            relative = filename.relative_to(root).as_posix()
            if relative == "release.json":
                continue
            actual.add(relative)
            record = records.get(relative)
            if record is None:
                raise ValueError("Unmanifested file")
            if filename.is_symlink():
                if (os.readlink(filename) != record.get("link") or not filename.resolve().is_relative_to(root.resolve())
                        or not filename.resolve().is_file()):
                    raise ValueError("Dependency link differs from manifest")
            elif (not filename.is_file() or "link" in record or filename.stat().st_size != record.get("bytes")
                  or file_hash(filename) != record.get("sha256")):
                raise ValueError("Release file differs from manifest")
    if actual != set(records):
        raise ValueError("Missing release files")
    for name in ("dist/main.js", "prisma/schema.prisma", "package.json", "package-lock.json",
                 "node_modules/@prisma/client/package.json", "node_modules/.prisma/client/default.js"):
        if name not in records or (root / name).is_symlink():
            raise ValueError("Missing runtime entrypoint")
    if schema_hash(root / "prisma/schema.prisma") != manifest.get("schemaSha256"):
        raise ValueError("Schema differs from manifest")
    return manifest
