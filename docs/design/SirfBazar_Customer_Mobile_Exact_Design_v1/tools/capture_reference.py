"""Capture this offline HTML reference only; never opens a production API.
Requires Python Playwright and an installed Chromium. Writes to an external output
folder by default and refuses to overwrite the locked original screenshot folder.
"""
from pathlib import Path
import argparse, json, os, shutil
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]

def run():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out', type=Path, default=Path('customer-reference-captures'))
    ap.add_argument('--theme', choices=['light','dark','both'], default='both')
    ap.add_argument('--first', type=int, default=1)
    ap.add_argument('--last', type=int, default=42)
    ap.add_argument('--width', type=int, default=390)
    ap.add_argument('--height', type=int, default=844)
    ap.add_argument('--scale', type=float, default=2)
    args = ap.parse_args()
    out = args.out.resolve()
    if out == (ROOT/'reference/screens').resolve() or (ROOT/'reference').resolve() in out.parents:
        ap.error('Write recaptures outside the immutable reference directory.')
    out.mkdir(parents=True, exist_ok=True)
    scenes = json.loads((ROOT/'reference/SCREENS.json').read_text())
    themes = ['light','dark'] if args.theme=='both' else [args.theme]
    records=[]
    with sync_playwright() as p:
        exe=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
        browser=p.chromium.launch(**({'executable_path':exe} if exe else {}))
        page=browser.new_page(viewport={'width':args.width,'height':args.height},device_scale_factor=args.scale)
        page.emulate_media(reduced_motion='reduce')
        page.set_content((ROOT/'reference/SirfBazar_Customer_Mobile.html').read_text(),wait_until='load')
        page.evaluate("document.documentElement.classList.add('capture')")
        for theme in themes:
            page.evaluate('(t)=>__customerDesign.theme(t)',theme)
            for i,s in enumerate(scenes,1):
                if not args.first<=i<=args.last: continue
                page.evaluate('(key)=>__customerDesign.scene(key)',s['key'])
                page.evaluate('document.fonts.ready')
                page.wait_for_timeout(30)
                name=f"{s['id']}-{s['key']}-{theme}.png"
                page.screenshot(path=str(out/name))
                records.append({'file':name,'scene':s['key'],'id':s['id'],'theme':theme,'logicalSize':[args.width,args.height],'scale':args.scale})
        browser.close()
    manifest=out/f'capture-{args.theme}-{args.first}-{args.last}.json'
    manifest.write_text(json.dumps(records,indent=2))
    print(f'Captured {len(records)} offline reference images in {out}')

if __name__=='__main__':run()
