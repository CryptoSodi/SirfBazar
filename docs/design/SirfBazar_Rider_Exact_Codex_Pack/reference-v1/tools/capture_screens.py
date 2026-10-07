from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys
R=Path(__file__).resolve().parents[1]
target=[('home','light','01-home-light'),('home','dark','02-home-dark'),('assigned','light','03-assigned-light'),('pickup','light','04-pickup-light'),('navigate','light','05-active-delivery-light'),('doorstep','light','06-at-customer-light'),('code','light','07-delivery-code-light'),('complete','light','08-completed-light'),('prepaid','light','09-paid-completion-light')]
remaining=['history','help','report','profile','appearance','permissions','login','login-code','shops','apply','pending','empty','offline','loading','error','expired','inactive','unknown']
target += [(s,'light',f'{i:02d}-{s}-light') for i,s in enumerate(remaining,10)]
target += [(s,'dark',f'{i:02d}-{s}-dark') for i,s in enumerate(['pickup','navigate','code','complete','profile','appearance','login'],28)]
start=int(sys.argv[1]) if len(sys.argv)>1 else 0
end=int(sys.argv[2]) if len(sys.argv)>2 else len(target)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for s,mode,name in target[start:end]:
  page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2)
  page.set_content((R/'SirfBazar_Rider_Design.html').read_text(),wait_until='domcontentloaded')
  page.evaluate('''([s,mode])=>{document.body.classList.add('capture'); __riderDesign.setTheme(mode);__riderDesign.scene(s)}''',[s,mode])
  page.wait_for_timeout(230)
  page.screenshot(path=str(R/'screens'/f'{name}.png'),animations='disabled',timeout=8000)
  print(name,flush=True)
  page.close()
 b.close()
(R/'SCREENSHOTS.json').write_text(json.dumps([{'screen':s,'theme':mode,'file':f'screens/{name}.png','viewport':{'width':390,'height':844},'deviceScaleFactor':2,'scope':'scrollable screen, visible viewport'} for s,mode,name in target],indent=2))
