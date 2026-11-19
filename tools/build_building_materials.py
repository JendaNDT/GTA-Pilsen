"""Spáruje povrch stěn a střech OSM přes obvod budovy v distribuované mapě."""
import argparse
from collections import defaultdict
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from build_landscape import read_pack, fingerprint
from coordinates import to_xz

WALL = {'plaster':0,'stucco':0,'render':1,'brick':2,'bricks':2,'concrete':3,'concrete_panels':3,
        'stone':4,'sandstone':4,'metal':5,'steel':5,'wood':6,'timber_framing':6}
ROOF = {'tile':7,'tiles':7,'roof_tiles':7,'clay':7,'metal':8,'metal_sheet':8,'sheet_metal':8,'steel':8,
        'zinc':8,'copper':9,'tar_paper':10,'bitumen':10,'asphalt':10,'eternit':11,'asbestos':11,
        'fibre_cement':11,'slate':11}


def match_buildings(buildings,elements):
    # Dva nejvzdálenější krajní body jen zúží výběr. Pak ověříme celý obvod.
    candidates=defaultdict(list)
    for i,ring in enumerate(buildings['bRing'][:-1]):
        start,end=buildings['ringStart'][ring:ring+2]
        points=frozenset(zip(buildings['vdx'][start:end].astype('int32')+buildings['ax'][i],
                             buildings['vdz'][start:end].astype('int32')+buildings['az'][i]))
        if len(points)>=3:
            candidates[min(points)].append((i,points))
    assigned={}
    for item in elements:
        tags=item.get('tags',{})
        wall=WALL.get(tags.get('building:material'),-1)
        roof=ROOF.get(tags.get('roof:material'),-1)
        if wall<0 and roof<0:
            continue
        rings=[item['geometry']] if item['type']=='way' else [m['geometry'] for m in item.get('members',[])
                                                                if m.get('geometry') and m['role']!='inner']
        points={tuple(round(v*10) for v in to_xz(p['lat'],p['lon'])) for ring in rings for p in ring}
        for pt in points:
            for i,outline in candidates.get(pt,()):
                if outline.issubset(points):
                    old=assigned.get(i,[-1,-1])
                    assigned[i]=[wall if wall>=0 else old[0],roof if roof>=0 else old[1]]
    return [[i,*pair] for i,pair in sorted(assigned.items())]


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--raw',type=Path,required=True)
    ap.add_argument('--data',type=Path,default=Path('public/data'))
    ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args()
    meta=json.loads((args.data/'meta.json').read_text())
    bbox=','.join(map(str,meta['sources']['bbox']))
    stamp=meta['osmTimestamp']
    query=f'[out:json][timeout:110][date:"{stamp}"];(wr["building:material"]({bbox});wr["roof:material"]({bbox}););out geom;'
    if not args.raw.exists():
        req=Request('https://overpass-api.de/api/interpreter?'+urlencode({'data':query}),
                    headers={'User-Agent':'Plzen-naplno/1.0 building-map'})
        with urlopen(req,timeout=150) as reply:
            source=json.load(reply)
        if source.get('remark') or not source.get('elements'):
            raise ValueError('Neúplný historický výřez OSM')
        args.raw.parent.mkdir(parents=True,exist_ok=True)
        args.raw.write_text(json.dumps({'query':query,'elements':source['elements']},separators=(',',':')))
    raw=json.loads(args.raw.read_text())
    if raw['query']!=query:
        raise ValueError('Podklad odpovídá jiné oblasti nebo datu.')
    path=args.data/'buildings.bin'
    rows=match_buildings(read_pack(path)[1],raw['elements'])
    result={'osm':stamp,'buildings':fingerprint(path),'surfaces':rows}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,separators=(',',':'))+'\n')
    print(f'Přiřazeno {len(rows)} půdorysů.')


if __name__=='__main__':
    main()
