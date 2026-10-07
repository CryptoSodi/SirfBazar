from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json, hashlib,re,zipfile
R=Path(__file__).resolve().parents[1]
# Static references retain their original data; no external file or font is shipped.
F='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
B='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(n,bold=False):return ImageFont.truetype(B if bold else F,n)
def board(items,path,title,subtitle):
 n=len(items);sw=330;sh=round(sw*844/390);gap=26;pad=40;top=155;bot=62
 w=pad*2+n*sw+(n-1)*gap;h=top+sh+bot
 canvas=Image.new('RGB',(w,h),'#F2F5F0');d=ImageDraw.Draw(canvas)
 d.text((pad,27),'SIRFBAZAR  /  RIDER MOBILE',font=font(13,True),fill='#007A52')
 d.text((pad,52),title,font=font(29,True),fill='#071F18')
 d.text((pad,96),subtitle,font=font(13),fill='#52695D')
 for i,(name,label) in enumerate(items):
  x=pad+i*(sw+gap);y=top;im=Image.open(R/'screens'/name).convert('RGB').resize((sw,sh),Image.Resampling.LANCZOS)
  mask=Image.new('L',(sw,sh),0);ImageDraw.Draw(mask).rounded_rectangle((0,0,sw-1,sh-1),radius=21,fill=255)
  d.rounded_rectangle((x-2,y-2,x+sw+1,y+sh+1),radius=23,fill='#D3DED6')
  canvas.paste(im,(x,y),mask)
  d.text((x,y+sh+18),label,font=font(12,True),fill='#52695D')
 canvas.save(R/path,optimize=True)
board([('01-home-light.png','01  Deliveries'),('05-active-delivery-light.png','02  Active delivery'),('07-delivery-code-light.png','03  Handover & code'),('02-home-dark.png','04  Dark appearance')], 'RIDER_APP_OVERVIEW.png','One delivery. One clear next step.','An API-mapped, merchant-owned delivery experience. Fictional records shown for design review.')
board([('01-home-light.png','Light · warm, clear surfaces'),('02-home-dark.png','Dark · the same hierarchy')], 'LIGHT_DARK_PREVIEW.png','Made for both light and dark.','System mode follows device appearance without resetting your task.')
scenes=json.loads((R/'SCREENS.json').read_text());shots=json.loads((R/'SCREENSHOTS.json').read_text())
lines=['# Rider screen directory','','26 compositions include core screens and recovery states. 36 screenshots include light/dark variants, a sheet and the desktop review shell. The screenshot number is not the same as the R screen ID.','','| Screen | Reference ID | Light screenshot | Dark screenshot |','|---|---|---|---|']
for i,s in enumerate(scenes,1):
 def pick(mode):
  found=next((x['file'] for x in shots if x['screen']==s['id'] and x['theme']==mode),None)
  return f'[{Path(found).name}]({found})' if found else 'Theme supported in interactive preview'
 lines.append(f"| R{i:02d} · {s['name']} | `{s['id']}` | {pick('light')} | {pick('dark')} |")
lines+=['','Additional captures: `screens/35-pickup-confirmation-sheet.png`, `screens/36-design-studio.png`.','','Screens are 390×844 logical viewport at device scale 2 (780×1688 pixel PNGs), except the 1440×1000 desktop review shell at scale 2. Screens with more content scroll; the PNG is the visible viewport, not the full scroll area. Do not make real app screens 780 logical units wide.','', 'Use the review rail on desktop, bottom review selector on a narrow browser, or the interactive app controls. Production excludes review controls and the simulated status bar.']
(R/'SCREEN_INDEX.md').write_text('\n'.join(lines)+'\n')
source=[
('apps/rider-app/package.json','6587e0151667ccf73d1d55f42909d80ac3e8cfe0','complete file'),
('apps/rider-app/screens/DeliveryScreen.tsx','8e91217f31353ffbe4d05602be4943a73e2c7dad','complete file'),
('apps/rider-app/screens/LoginScreen.tsx','41ecba9d2b8f2723b62ed020a8202bca399ed6f4','complete file'),
('apps/api/src/rider/rider.service.ts','22c99749a1f66ffe5b97985b05c8e3a99323fbc7','selected lines 1–115 and 112–395'),
('apps/api/src/rider/rider.controller.ts','6fc92a187c8304542434bf71e915efc2040d4591','complete file'),
('apps/api/src/rider/rider-apply.controller.ts','625e98438521ac95ca3333bc85ffba4261cc9009','complete file'),
('apps/api/src/auth/auth.dto.ts','c5a1960c2056e70576adf7e3e0bd811e7a5e7c66','complete file')]
manifest={'prepared':'2026-09-29','repository':'CryptoSodi/SirfBazar','read_ref':'default branch; display URLs master; deployed version not verified','files':[{'path':p,'git_blob_sha':sha,'scope':scope,'url':'https://github.com/CryptoSodi/SirfBazar/blob/master/'+p} for p,sha,scope in source], 'search_excerpt':{'path':'apps/api/src/orders/orders.service.ts','snippet':'deliveryOtp: generateNumericCode(4)','scope':'search result excerpt, not full file','ref_in_search':'69e137bf9ca53c5235ac6d55c866b611b3e6ce38'},'startup_log':{'path':'reference/API_STARTUP_LOG.txt','sha256':hashlib.sha256((R/'reference/API_STARTUP_LOG.txt').read_bytes()).hexdigest()},'brand_sources':{'package':'SirfBazar_API_Supported_Dashboard_v2.zip','geometry':'Original provided SVGs copied unchanged; generated PNG display derivatives change dark fill only'},'not_performed':['Live API traffic','Real authentication or delivery mutations','Backend or native repository edits','Google Stitch generation','Native runtime testing']}
(R/'SOURCE_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
