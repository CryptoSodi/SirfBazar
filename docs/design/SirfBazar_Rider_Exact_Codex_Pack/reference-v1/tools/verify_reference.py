"""Verify the immutable reference inputs. No network, installs or mutations."""
from pathlib import Path
import json,hashlib,sys
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'REFERENCE_LOCK.json').read_text())
errors=[]
for rel,expected in manifest['sha256'].items():
 p=root/rel
 if not p.is_file(): errors.append(f'Missing: {rel}')
 elif hashlib.sha256(p.read_bytes()).hexdigest()!=expected:errors.append(f'Changed: {rel}')
print('\n'.join(errors) if errors else f"Verified {len(manifest['sha256'])} reference files.")
sys.exit(1 if errors else 0)
