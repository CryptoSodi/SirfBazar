#!/usr/bin/env python3
"""Offline reference render + DOM measurements. Not a native app test.

Requires existing Python Playwright and a compatible Chromium executable/browser.
Writes only outside reference-v1; blocks all network requests. Never modifies HTML.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / 'reference-v1'

MEASURE = r'''() => {
  const props = ['display','position','boxSizing','width','height','minHeight','maxHeight',
    'paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight',
    'marginBottom','marginLeft','gap','rowGap','columnGap','alignItems','justifyContent',
    'flexDirection','flexShrink','fontFamily','fontSize','fontWeight','lineHeight',
    'letterSpacing','color','backgroundColor','borderTopWidth','borderTopColor',
    'borderRadius','boxShadow','overflow','transform','strokeWidth'];
  const selector = '#device, .statusbar, #appbar, #content, #content section, #content h1, '
    + '#content h2, #content h3, #content .hero, #content .card, #content .stats, '
    + '#content .stat, #content .availability, #content .trip, #content .stop, '
    + '#content .map, #content .input, #content .checkrow, #content .tag, '
    + '#content .cell, #content .btn, #content .note, #footer, #footer *, '
    + '#overlay .sheet, #overlay .sheethead, #overlay .btn, #appbar .brand, #appbar .ic';
  const rows = [...document.querySelectorAll(selector)].map((el) => {
    const r = el.getBoundingClientRect(), css = getComputedStyle(el);
    const styles = Object.fromEntries(props.map(p => [p, css[p]]));
    return { tag: el.tagName, id: el.id || null, class: typeof el.className === 'string' ? el.className : null,
      action: el.getAttribute('data-act'),
      text: (el.innerText || el.textContent || '').trim().slice(0, 500),
      box: { x:r.x,y:r.y,width:r.width,height:r.height }, styles };
  });
  return { viewport:{width:innerWidth,height:innerHeight},devicePixelRatio,
    theme:document.documentElement.dataset.theme,scrollTop:document.querySelector('#content')?.scrollTop,
    documentWidth:document.documentElement.scrollWidth,declaredFont:getComputedStyle(document.body).fontFamily,
    fontNote:'Declared font stack is not proof of the resolved platform font. No font is downloaded by this helper.',
    nodes:rows };
}'''


def main() -> int:
    scenes = json.loads((REFERENCE / 'SCREENS.json').read_text(encoding='utf-8'))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--screen', choices=[x['id'] for x in scenes], default='home')
    parser.add_argument('--theme', choices=['light','dark'], default='light')
    parser.add_argument('--width', type=int, default=390)
    parser.add_argument('--height', type=int, default=844)
    parser.add_argument('--scale', type=float, default=2)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--chromium', help='Path to an existing Chromium executable; otherwise use detected/system or Playwright browser.')
    parser.add_argument('--pickup-sheet', action='store_true', help='Open the reference pickup confirmation; requires screen=pickup.')
    args = parser.parse_args()
    if not 280 <= args.width <= 2400 or not 320 <= args.height <= 4000 or not 0.5 <= args.scale <= 4:
        parser.error('Invalid viewport/scale.')
    if args.pickup_sheet and args.screen != 'pickup':
        parser.error('--pickup-sheet requires --screen pickup.')
    out = args.out.expanduser().resolve()
    if out == REFERENCE.resolve() or REFERENCE.resolve() in out.parents:
        parser.error('Output must not be inside immutable reference-v1.')
    out.mkdir(parents=True, exist_ok=True)
    stem=f'{args.screen}-{args.theme}'+('-sheet' if args.pickup_sheet else '')
    targets=[out / f'{stem}.png', out / f'{stem}.json']
    if any(x.exists() for x in targets):
        parser.error('Output already exists; use a fresh output directory to retain comparison evidence.')
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Python Playwright is not installed. Use existing project browser tooling or a separate approved test environment.',file=sys.stderr)
        return 2
    html=(REFERENCE/'SirfBazar_Rider_Design.html').read_text(encoding='utf-8')
    blocked=[]
    errors=[]
    try:
        with sync_playwright() as p:
            options={'headless':True}
            executable=args.chromium or shutil.which('chromium') or shutil.which('chromium-browser')
            if executable:
                options['executable_path']=executable
            browser=p.chromium.launch(**options)
            context=browser.new_context(viewport={'width':args.width,'height':args.height},
                                       device_scale_factor=args.scale,locale='en-PK',color_scheme=args.theme)
            def block(route):
                blocked.append(route.request.url)
                route.abort()
            context.route('**/*',block)
            page=context.new_page()
            page.on('pageerror',lambda e: errors.append(str(e)))
            page.set_content(html,wait_until='domcontentloaded')
            page.evaluate("([screen,theme]) => { document.body.classList.add('capture'); window.__riderDesign.setTheme(theme); window.__riderDesign.scene(screen); }",[args.screen,args.theme])
            if args.pickup_sheet:
                page.locator('[data-flag="bag"]').check()
                page.locator('[data-act="confirm-pickup"]').click()
            page.wait_for_timeout(260)
            page.screenshot(path=str(targets[0]),animations='disabled',timeout=10000)
            data=page.evaluate(MEASURE)
            data.update({'referenceSha256':hashlib.sha256(html.encode('utf-8')).hexdigest(),
                         'screen':args.screen,'pickupSheet':args.pickup_sheet,
                         'networkRequestsBlocked':blocked,'pageErrors':errors,
                         'evidenceScope':'Fresh offline HTML reference render only; no native/app/API execution.'})
            targets[1].write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
            browser.close()
        print(f'Reference screenshot: {targets[0]}\nComputed layout: {targets[1]}')
        if errors:
            print('Browser errors: '+'; '.join(errors),file=sys.stderr)
            return 1
        return 0
    except Exception as exc:
        print(f'Reference render failed: {exc}',file=sys.stderr)
        return 2


if __name__=='__main__':
    raise SystemExit(main())
