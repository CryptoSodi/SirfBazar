#!/usr/bin/python3
"""Forced SSH entrypoint, never a shell or general file transfer."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

sys.path.insert(0, "/usr/local/libexec/sirfbazar-deploy")
from archive import DIGEST, MAX_ARCHIVE, RELEASE_ID

HOME = Path("/var/lib/sirfbazar-deploy")


def parse_command(command):
    if command == "status":
        return ("status", None, None)
    match = re.fullmatch(rf"(upload|deploy) ({RELEASE_ID}) ({DIGEST})", command)
    if not match:
        raise ValueError("Only upload, deploy and status commands are allowed")
    return match.groups()


def main():
    action, release_id, digest = parse_command(os.environ.get("SSH_ORIGINAL_COMMAND", ""))
    if action == "status":
        service = subprocess.run(["/usr/bin/systemctl", "is-active", "sirfbazar-api.service"], capture_output=True, text=True)
        print(json.dumps({"release": Path("/opt/sirfbazar-api/current").resolve().name, "service": service.stdout.strip()}))
        return service.returncode
    archive = HOME / "incoming" / (release_id + ".tar.gz")
    if action == "deploy":
        return subprocess.run(["/usr/bin/sudo", "-n", "/usr/local/libexec/sirfbazar-deploy/promote.py", release_id, digest]).returncode
    if shutil.disk_usage(HOME).free < 3 * 1024 ** 3:
        raise ValueError("Less than 3 GiB free; operator cleanup required")
    temporary = archive.with_suffix(f".upload-{os.getpid()}")
    created = False
    try:
        checksum, size = hashlib.sha256(), 0
        with temporary.open("xb") as output:
            created = True
            temporary.chmod(0o600)
            while chunk := sys.stdin.buffer.read(65536):
                size += len(chunk)
                if size > MAX_ARCHIVE:
                    raise ValueError("Archive exceeds upload limit")
                checksum.update(chunk)
                output.write(chunk)
        if not size or checksum.hexdigest() != digest:
            raise ValueError("Upload checksum mismatch")
        os.link(temporary, archive)
    finally:
        if created:
            temporary.unlink(missing_ok=True)
    print(json.dumps({"uploaded": release_id, "checksumVerified": True}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        print("SirfBazar deployment command rejected; contact the operator.", file=sys.stderr)
        sys.exit(1)
