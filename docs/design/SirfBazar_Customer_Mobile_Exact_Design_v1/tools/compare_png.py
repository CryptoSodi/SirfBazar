"""Equal-size PNG visual comparison, for diagnostic use after documented OS crops.
Does not resize images, suppress mismatches, alter expected files or certify parity.
"""
from pathlib import Path
import argparse,json
from PIL import Image, ImageChops, ImageStat

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('expected',type=Path);ap.add_argument('actual',type=Path)
    ap.add_argument('--out',type=Path,required=True)
    a=ap.parse_args()
    expected=a.expected.resolve();actual=a.actual.resolve();out=a.out.resolve()
    out.mkdir(parents=True,exist_ok=True)
    for name in ['overlay.png','difference.png','metrics.json']:
        if (out/name).resolve() in [expected,actual]:ap.error('Output may not overwrite inputs.')
    e=Image.open(expected).convert('RGB');n=Image.open(actual).convert('RGB')
    if e.size!=n.size:ap.error(f'Pixel sizes differ: {e.size} vs {n.size}. Align capture conditions; no automatic stretching.')
    delta=ImageChops.difference(e,n);s=ImageStat.Stat(delta)
    changed=sum(pixel!=(0,0,0) for pixel in delta.getdata())
    Image.blend(e,n,.5).save(out/'overlay.png');delta.save(out/'difference.png')
    metrics={'size':e.size,'meanAbsoluteDifferenceRGB':s.mean,'changedPixels':changed,'totalPixels':e.width*e.height,'changedFraction':changed/(e.width*e.height),'scope':'Diagnostic raw pixel difference; no automatic native-parity pass/fail.'}
    (out/'metrics.json').write_text(json.dumps(metrics,indent=2));print(json.dumps(metrics,indent=2))
if __name__=='__main__':main()
