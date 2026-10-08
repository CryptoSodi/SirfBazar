#!/usr/bin/python3
"""Runner-only archive verification before handing an artifact to SSH."""
import json
import sys
from archive import extract, verify_tree

if __name__ == "__main__":
    archive, destination, sha = sys.argv[1:]
    extract(archive, destination)
    manifest = verify_tree(destination, sha)
    print(json.dumps({"sha": manifest["sha"], "verifiedFiles": len(manifest["files"])}))
