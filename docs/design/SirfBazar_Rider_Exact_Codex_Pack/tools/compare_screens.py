#!/usr/bin/env python3
"""Produce overlay/raw diff/side-by-side PNGs. No resize/crop/mask or parity certificate.

Requires Pillow. Supply original retained input images with already-matched dimensions.
A pixel metric cannot alone establish native visual quality or correct integration.
"""
from pathlib import Path
import argparse
import json
import sys


def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference',type=Path,required=True)
    parser.add_argument('--actual',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--channel-tolerance',type=int,default=0,help='Diagnostic maximum-channel tolerance; defaults to exact 0. Recorded in report, not a pass threshold.')
    args=parser.parse_args()
    if not 0 <= args.channel_tolerance <= 255:
        parser.error('Channel tolerance must be 0–255.')
    try:
        from PIL import Image,ImageChops,ImageStat
    except ImportError:
        print('Pillow is required. Use an existing image-test environment, not an application dependency.',file=sys.stderr)
        return 2
    try:
        with Image.open(args.reference) as f: reference=f.convert('RGB')
        with Image.open(args.actual) as f: actual=f.convert('RGB')
        if reference.size != actual.size:
            raise ValueError(f'Dimensions differ: reference={reference.size}, actual={actual.size}. Align capture conditions explicitly; this tool will not resize.')
        out=args.out.expanduser().resolve()
        root=Path(__file__).resolve().parents[1]
        immutable=(root/'reference-v1').resolve()
        if out==immutable or immutable in out.parents:
            raise ValueError('Cannot write comparisons into immutable reference-v1.')
        out.mkdir(parents=True,exist_ok=True)
        output_paths=[out/x for x in ['overlay.png','difference.png','side-by-side.png','metrics.json']]
        if any(x.exists() for x in output_paths):
            raise ValueError('Comparison output exists. Use a fresh output directory; retain old evidence.')
        diff=ImageChops.difference(reference,actual)
        maxchannel=ImageChops.lighter(ImageChops.lighter(*diff.split()[:2]),diff.split()[2])
        histogram=maxchannel.histogram()
        n=reference.width*reference.height
        changed=sum(histogram[args.channel_tolerance+1:])
        metrics={'reference':str(args.reference.resolve()),'actual':str(args.actual.resolve()),
                 'width':reference.width,'height':reference.height,'channelTolerance':args.channel_tolerance,
                 'changedPixels':changed,'changedPixelFraction':changed/n,
                 'meanAbsoluteChannelError0to255':sum(ImageStat.Stat(diff).sum)/(n*3),
                 'automaticResizing':False,'automaticMasking':False,'nativeParityCertified':False,
                 'note':'Diagnostic measurements only. Font/system-region conditions and visual inspection must be recorded separately.'}
        Image.blend(reference,actual,0.5).save(output_paths[0])
        diff.save(output_paths[1])
        side=Image.new('RGB',(reference.width*2,reference.height))
        side.paste(reference,(0,0));side.paste(actual,(reference.width,0));side.save(output_paths[2])
        output_paths[3].write_text(json.dumps(metrics,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(metrics,indent=2))
        return 0
    except (OSError,ValueError) as exc:
        print(f'Comparison failed: {exc}',file=sys.stderr)
        return 2


if __name__=='__main__':
    raise SystemExit(main())
