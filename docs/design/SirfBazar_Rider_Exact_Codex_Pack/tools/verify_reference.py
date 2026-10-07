#!/usr/bin/env python3
"""Verify every immutable original reference file. Standard library; no network."""
from pathlib import Path
import hashlib
import json
import sys


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    reference = root / 'reference-v1'
    try:
        manifest = json.loads((root / 'REFERENCE_MANIFEST.json').read_text(encoding='utf-8'))
        checks = manifest['sha256']
        errors = []
        for relative, expected in checks.items():
            path = (reference / relative).resolve()
            if reference.resolve() not in path.parents:
                errors.append(f'Unsafe manifest path: {relative}')
            elif not path.is_file():
                errors.append(f'Missing: {relative}')
            elif hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                errors.append(f'Changed: {relative}')
        extras = sorted(str(p.relative_to(reference)) for p in reference.rglob('*')
                        if p.is_file() and p.relative_to(reference).as_posix() not in checks)
        if errors:
            print('\n'.join(errors), file=sys.stderr)
            return 1
        print(f'Verified {len(checks)} original reference files, unchanged.')
        if extras:
            print('Unlisted files (not baseline evidence): ' + ', '.join(extras))
        print('Reference integrity only. No native/UI/API test has been performed by this tool.')
        return 0
    except (OSError, KeyError, ValueError) as exc:
        print(f'Cannot verify reference: {exc}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
