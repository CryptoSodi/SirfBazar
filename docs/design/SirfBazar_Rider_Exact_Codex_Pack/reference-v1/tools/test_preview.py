from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, sys
R=Path(__file__).resolve().parents[1]
checks=[];errs=[];net=[];shots=[]
def record(name,cond,detail=None):
 checks.append({'name':name,'passed':bool(cond),'detail':detail})
 print(('PASS ' if cond else 'FAIL ')+name)
def nav(page,s):
 page.evaluate('(s)=>__riderDesign.scene(s)',s);page.wait_for_timeout(230)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2)
 page.on('pageerror',lambda e:errs.append(str(e)))
 page.on('request',lambda r:net.append(r.url))
 page.set_content((R/'SirfBazar_Rider_Design.html').read_text(),wait_until='domcontentloaded')
 page.evaluate("document.body.classList.add('capture')")
 page.wait_for_timeout(250)
 scenes=page.evaluate('__riderDesign.screens')
 (R/'SCREENS.json').write_text(json.dumps(scenes,indent=2))
 # All scenes, both appearances; geometry is checked on the real rendered DOM.
 layouts=[]
 for mode in ['light','dark']:
  page.evaluate('(x)=>__riderDesign.setTheme(x)',mode)
  for s in scenes:
   nav(page,s['id'])
   val=page.evaluate('''()=>({screen:__riderDesign.state.screen, width:innerWidth, document:document.documentElement.scrollWidth,
      content:document.querySelector('#content').scrollWidth,contentWidth:document.querySelector('#content').clientWidth,
      text:document.querySelector('#content').innerText.length,footer:document.querySelector('#footer').getBoundingClientRect().bottom})''')
   val['theme']=mode;layouts.append(val)
 record('All 26 scene/state compositions render in both themes',len(layouts)==52 and all(x['text']>20 for x in layouts))
 record('No horizontal overflow at 390px in any scene/theme',all(x['document']<=x['width'] and x['content']<=x['contentWidth']+1 for x in layouts),[x for x in layouts if x['content']>x['contentWidth']+1])
 record('Action/navigation docks remain within the 844px reference viewport',all(x['footer']<=845 for x in layouts))
 # Real interactive sample handoff.
 nav(page,'home'); page.locator('[data-act="open-current"]').click()
 page.locator('[data-act="arrived-shop"]').click();page.wait_for_timeout(300)
 record('At-shop action enters pickup and retains distinct state',page.evaluate('__riderDesign.state.status')=='RIDER_ARRIVED_AT_SHOP')
 record('Pickup requires deliberate packed-order acknowledgement',page.locator('[data-act="confirm-pickup"]').is_disabled())
 page.locator('[data-flag="bag"]').check();page.locator('[data-act="confirm-pickup"]').click();page.wait_for_timeout(40)
 first=page.locator('.sheet button').first
 first.focus();page.keyboard.press('Shift+Tab')
 trapped=page.evaluate("document.activeElement===document.querySelector('.sheet button:last-child')")
 page.keyboard.press('Escape')
 record('Sheet Escape cancels without changing pickup status',page.locator('.sheet').count()==0 and page.evaluate('__riderDesign.state.status')=='RIDER_ARRIVED_AT_SHOP')
 page.locator('[data-act="confirm-pickup"]').click();page.wait_for_timeout(60)
 page.locator('.sheet button').first.focus();page.keyboard.press('Shift+Tab')
 trap=page.evaluate("document.activeElement.closest('.sheet')!==null")
 record('Keyboard focus wraps within confirmation sheet',trap)
 page.locator('[data-act="save-pickup"]').click();page.wait_for_timeout(300)
 record('Pickup advances main state to ON_THE_WAY',page.evaluate('__riderDesign.state.status')=='ON_THE_WAY')
 page.locator('[data-act="arrived-customer"]').click();page.wait_for_timeout(300)
 page.locator('[data-act="go:code"]').click()
 page.locator('#delivery-code').fill('8742')
 page.locator('[data-flag="handed"]').check()
 record('COD completion remains disabled without collected-cash acknowledgement',page.locator('[data-act="complete-delivery"]').is_disabled())
 page.locator('[data-flag="cash"]').check()
 record('Code and both acknowledgements enable completion',not page.locator('[data-act="complete-delivery"]').is_disabled())
 page.evaluate("__riderDesign.setTheme('dark')")
 record('Theme change preserves code and form state',page.locator('#delivery-code').input_value()=='8742' and page.locator('[data-flag="cash"]').is_checked())
 page.locator('[data-act="complete-delivery"]').click();page.wait_for_timeout(300)
 record('Full local merchant-assigned delivery path completes',page.evaluate('__riderDesign.state.status')=='DELIVERED' and 'All handed over' in page.locator('#content').inner_text())
 nav(page,'prepaid');page.locator('[data-act="go:code"]').click()
 record('Paid variant omits cash collection acknowledgement',page.locator('[data-flag="cash"]').count()==0 and 'Do not collect cash' in page.locator('#content').inner_text())
 nav(page,'report');page.locator('[data-act="send-issue"]').click()
 record('Empty issue report shows validation instead of success',bool(page.locator('#report-error').inner_text()) and page.locator('.sheet').count()==0)
 page.locator('[data-draft="description"]').fill('The customer did not answer at the address.')
 page.locator('[data-act="send-issue"]').click();page.wait_for_timeout(300)
 record('Local issue reporting leaves delivery status unchanged',page.evaluate('__riderDesign.state.status')=='RIDER_ARRIVED_AT_CUSTOMER')
 page.locator('[data-act="close-sheet"]').click()
 nav(page,'offline');page.evaluate("__riderDesign.go('code')")
 page.locator('#delivery-code').fill('8742');page.locator('[data-flag="handed"]').check();page.locator('[data-flag="cash"]').check()
 record('Disconnected state cannot complete a delivery',page.locator('[data-act="complete-delivery"]').is_disabled())
 nav(page,'login');page.locator('[data-act="send-login"]').click()
 record('Invalid phone is not treated as sign-in success',bool(page.locator('#login-error').inner_text()))
 page.locator('[data-draft="phone"]').fill('3000000014');page.locator('[data-act="send-login"]').click();page.wait_for_timeout(300)
 record('Phone entry progresses to distinct login-code screen',page.evaluate('__riderDesign.state.screen')=='login-code')
 nav(page,'shops');page.locator('[data-act="go:apply"]').click()
 page.locator('[data-draft="fullName"]').fill('Example Rider');page.locator('[data-draft="appPhone"]').fill('+923000000014')
 page.locator('[data-act="apply"]').click();page.wait_for_timeout(300)
 record('Shop application ends in pending, not automatic approval',page.evaluate('__riderDesign.state.screen')=='pending')
 page.evaluate("__riderDesign.setTheme('system')");page.emulate_media(color_scheme='dark');page.wait_for_timeout(170)
 a=page.get_attribute('html','data-theme')=='dark'
 page.emulate_media(color_scheme='light');page.wait_for_timeout(170)
 a=a and page.get_attribute('html','data-theme')=='light'
 page.evaluate("__riderDesign.setTheme('light')");page.emulate_media(color_scheme='dark');page.wait_for_timeout(170)
 record('System follows OS; explicit Light ignores OS changes',a and page.get_attribute('html','data-theme')=='light')
 nav(page,'loading');page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(70)
 record('Reduced motion disables loading animation',page.locator('.skeleton').first.evaluate('(e)=>getComputedStyle(e).animationName')=='none')
 page.emulate_media(reduced_motion='no-preference',color_scheme='light')
 sizes=[]
 for w,h in [(360,800),(412,915),(320,740)]:
  page.set_viewport_size({'width':w,'height':h})
  for s in ['home','navigate','code','apply','appearance','history']:
   nav(page,s)
   dim=page.evaluate("()=>({screen:__riderDesign.state.screen,w:innerWidth,d:document.documentElement.scrollWidth,c:document.querySelector('#content').scrollWidth,cw:document.querySelector('#content').clientWidth})")
   sizes.append(dim)
 record('Selected long/form screens fit 320, 360 and 412px widths',all(x['d']<=x['w'] and x['c']<=x['cw']+1 for x in sizes),[x for x in sizes if x['c']>x['cw']+1])
 nav(page,'expired');record('Expired-session composition hides customer and order details','House 24' not in page.locator('#content').inner_text() and 'SB-1048' not in page.locator('#content').inner_text())

 record('Browser JavaScript errors',len(errs)==0,errs)
 record('Prototype makes no network requests',len(net)==0,net)
 results={'checks':checks,'passed':sum(c['passed'] for c in checks),'total':len(checks),'sceneThemeRenders':52,'browser':'system Chromium via Python Playwright','scope':'local HTML preview only; no real API or native runtime','jsErrors':errs,'networkRequests':net,'layouts':layouts}
 (R/'qa-results.json').write_text(json.dumps(results,indent=2))
 if '--tests-only' in sys.argv:
  b.close()
  print('RESULT',results['passed'],'/',results['total'])
  sys.exit(0)

 b.close()
print('RESULT',results['passed'],'/',results['total'])
sys.exit(0 if results['passed']==results['total'] else 1)
