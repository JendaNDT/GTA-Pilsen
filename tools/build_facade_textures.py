"""Převede sedm fotomateriálů Poly Haven a vytvoří pět opakovatelných povrchů střech."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

from build_terrain_textures import source

SIDE = 1024
WALLS = ('painted_plaster_wall', 'grey_plaster_03', 'brick_wall_001', 'precast_concrete_wall',
         'stone_wall_03', 'exterior_wall_cladding', 'wood_plank_wall')


def roof(index):
    y, x = np.mgrid[:SIDE, :SIDE].astype(np.float32) / SIDE
    tau = 2 * np.pi
    mottling = np.sin(tau * (2*x+3*y)) * np.cos(tau * (3*x-y)) + .24*np.sin(tau*(47*x+13*y))
    color = np.ones((SIDE, SIDE, 3), np.float32)
    if index in (0, 4):
        row = np.floor(y*8)
        u = (x*9+row*.5) % 1
        v = (y*8) % 1
        height = (.32*np.cos(tau*u) if index == 0 else .05*np.sin(tau*(u+v))) + .48*v
        height -= .28*np.exp(-np.minimum(u, 1-u)**2/.002)
        color *= (.86+.16*v+.09*np.cos(tau*u)+.05*mottling)[:, :, None]
        roughness = .76 if index == 0 else .86
    elif index in (1, 2):
        u=(x*7) % 1
        height=.85*np.exp(-np.minimum(u,1-u)**2/.0012)+.055*mottling
        color *= (.94+.10*height+.035*mottling)[:, :, None]
        if index == 2:
            color[:, :, 0] *= .93-.10*mottling
            color[:, :, 1] *= 1.09+.06*mottling
        roughness = .58 if index == 1 else .67
    else:
        height=.03*np.sin(tau*(71*x+17*y))+.04*mottling+.16*np.exp(-((y*4)%1)**2/.001)
        color *= (.97+.23*height+.04*mottling)[:, :, None]
        roughness=.94
    slope_x=(np.roll(height,-1,1)-np.roll(height,1,1))*5
    slope_y=(np.roll(height,-1,0)-np.roll(height,1,0))*5
    norm=np.sqrt(1+slope_x*slope_x+slope_y*slope_y)
    packed=np.stack((.5-.5*slope_x/norm,.5+.5*slope_y/norm,roughness+.025*mottling),axis=-1)
    return np.uint8(np.clip(color*128,0,255)),np.uint8(np.clip(packed*255,0,255))


def build(cache,output):
    manifest=json.loads(Path(__file__).with_name('facade-textures.json').read_text())
    output.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True,exist_ok=True)
    atlases=[Image.new('RGB',(4*SIDE,3*SIDE)) for _ in range(2)]
    for i in range(12):
        if i<len(WALLS):
            name=WALLS[i]
            def channel(key):
                return source(name,key,manifest[name][key],cache,side=SIDE)
            pixels=channel('Diffuse').astype(np.float32)
            gain=np.uint8(np.clip(pixels/np.maximum(1,pixels.mean(axis=(0,1)))*128,0,255))
            packed=channel('nor_gl').copy()
            packed[:,:,2]=channel('Rough')[:,:,0]
        else:
            gain,packed=roof(i-len(WALLS))
        at=((i%4)*SIDE,(i//4)*SIDE)
        for atlas, pixels in zip(atlases,(gain,packed)):
            atlas.paste(Image.fromarray(pixels),at)
    for atlas,name in zip(atlases,('barva','povrch')):
        atlas.save(output/(name+'.webp'),quality=92,method=4)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache',type=Path,default=Path('data-raw/e24/polyhaven'))
    parser.add_argument('--output',type=Path,default=Path('data-raw/kandidat/textures/facades'))
    args=parser.parse_args()
    build(args.cache,args.output)
