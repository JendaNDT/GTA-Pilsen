"""Vlastní kulisy místností pro pět vnitřních stěn za každým oknem."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw

SIZE = 192
PALETTES = [
    ('#ddcdb9', '#78624c', '#506855'), ('#c8d2cc', '#86664f', '#526477'),
    ('#decdb1', '#72573c', '#955c49'), ('#d7ded8', '#596364', '#5e7585'),
    ('#c9d5d9', '#616568', '#3f5e6a'), ('#e5d4b1', '#9c8873', '#926546'),
    ('#c8c3b8', '#79736a', '#526052'), ('#e5ceb4', '#826952', '#855748')]


def room(variant,side):
    wall,floor,accent = PALETTES[variant]
    base = wall if side<3 else floor if side==3 else '#e3e0d6'
    img=Image.new('RGB',(SIZE,SIZE),base)
    d=ImageDraw.Draw(img)
    if side==3:
        for j in range(0,SIZE,24):
            d.line((0,j,SIZE,j),fill='#61594f')
            for i in range((j//24%2)*28,SIZE,56):
                d.line((i,j,i,j+24),fill='#71665a')
    elif side==4:
        if variant in (3,4,5):
            d.rectangle((38,70,150,121),fill='#aeb4ad',outline='#878f8c',width=3)
            d.rectangle((44,76,144,115),fill='#fff7da')
        else:
            d.ellipse((78,78,114,114),fill='#e8d5a5',outline='#797169',width=3)
    else:
        d.rectangle((0,181,SIZE,191),fill=floor)
        if side==0:
            if variant in (0,1,2):
                d.rectangle((22,116,148,164),fill=accent,outline='#4a4037',width=3)
                d.rectangle((14,134,158,160),fill=accent,outline='#514a42',width=3)
                for i in (19,146):d.rectangle((i,160,i+6,176),fill='#5e4b39')
                d.rectangle((56,30,126,87),fill='#6d5547')
                d.rectangle((61,35,121,82),fill='#a1b3ae')
                d.polygon([(61,76),(90,49),(101,62),(115,53),(121,75)],fill=accent)
            elif variant in (3,4):
                for i in (10,106):
                    d.rectangle((i,119,i+75,126),fill=floor)
                    d.rectangle((i+5,126,i+9,174),fill='#595954')
                    d.rectangle((i+61,126,i+65,174),fill='#595954')
                    d.rectangle((i+15,83,i+58,109),fill='#42494d')
                    d.rectangle((i+19,87,i+54,105),fill=accent)
                    d.rectangle((i+32,109,i+39,119),fill='#505a5a')
            elif variant==6:
                for j in range(7):
                    x=8+j*24;y=152-j*15
                    d.rectangle((x,y,x+24,181),fill=floor,outline=accent)
                d.line((7,117,183,17),fill=accent,width=5)
            else:
                for j in range(3):
                    y=65+j*40
                    for k in range(13):
                        x=9+k*14
                        d.rectangle((x,y-13-(k*7+j)%11,x+9,y),fill=(accent,'#bd9455','#526f6d')[k%3])
                    d.rectangle((4,y,187,y+5),fill=floor)
        elif (side+variant)%2:
            d.rectangle((36,24,111,166),fill=floor,outline='#635d53',width=3)
            d.ellipse((94,91,100,97),fill='#d9c38b')
        else:
            for i in range(3):
                d.rectangle((25+i*54,47,65+i*54,91),fill=floor)
                d.rectangle((29+i*54,51,61+i*54,87),fill=accent)
    return img


def build(output):
    atlas=Image.new('RGB',(SIZE*8,SIZE*5))
    for variant in range(8):
        for side in range(5):
            atlas.paste(room(variant,side),(variant*SIZE,(4-side)*SIZE))
    output.parent.mkdir(parents=True,exist_ok=True)
    atlas.save(output,lossless=True,method=5)


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('output',type=Path)
    build(ap.parse_args().output)
