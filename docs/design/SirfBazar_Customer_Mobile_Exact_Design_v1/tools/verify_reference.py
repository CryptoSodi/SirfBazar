"""Verify the immutable design reference. No network or app execution."""
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]

def main():
    lock_path=ROOT/'REFERENCE_LOCK.json'
    if not lock_path.is_file():
        raise SystemExit('REFERENCE_LOCK.json is missing. Keep the full pack together.')
    lock=json.loads(lock_path.read_text());failures=[]
    for record in lock['files']:
        path=(ROOT/record['path']).resolve()
        if ROOT not in path.parents or not path.is_file():
            failures.append({'path':record['path'],'error':'missing or outside pack'});continue
        raw=path.read_bytes()
        if len(raw)!=record['bytes'] or hashlib.sha256(raw).hexdigest()!=record['sha256']:
            failures.append({'path':record['path'],'error':'reference content changed'})
    print(json.dumps({'checked':len(lock['files']),'passed':len(lock['files'])-len(failures),'failures':failures,'scope':'Reference integrity only, not native or API verification.'},indent=2))
    return 1 if failures else 0
if __name__=='__main__':sys.exit(main())
