import { SolidBuf } from './solid-buffer.js';
import { inLawn } from './sady-layout.js';

// Jedna síť na dlaždici: dlouhé listy kosatců a orobince, při kraji i plovoucí lekníny.
export function bankPlants(world, patches, detail) {
  const buffer=new SolidBuf(), spacing=detail ? 1.02 : 1.68;
  for(const outline of patches) {
    const xs=outline.map(p=>p[0]),zs=outline.map(p=>p[1]);
    const x0=Math.min(...xs),z0=Math.min(...zs),x1=Math.max(...xs),z1=Math.max(...zs);
    for(let x=x0+.25;x<x1;x+=spacing) for(let z=z0+.25;z<z1;z+=spacing) {
      const seed=Math.sin(x*21.7+z*14.3);
      const px=x+.22*seed,pz=z+.21*Math.cos(x*8+z);
      if(!inLawn(outline,px,pz)) continue;
      const y=world.heightAt(px,pz);
      for(let j=0;j<(detail?7:4);j++) {
        const a=j*2.4+seed*4, dx=Math.cos(a),dz=Math.sin(a);
        const h=.48+.38*(1+Math.sin(j*14.9+px));
        const tip=[px+dx*.44,y+h,pz+dz*.44], base=[px+dx*.06,y-.05,pz+dz*.06];
        const mid=[px+dx*.20,y+h*.58,pz+dz*.20];
        buffer.quad(base,[mid[0]-dz*.065,mid[1],mid[2]+dx*.065],tip,
          [mid[0]+dz*.065,mid[1],mid[2]-dx*.065],j%2?[.17,.30,.09]:[.28,.36,.12]);
      }
      if(detail && seed>.55) {
        buffer.box(px,y+.92,y+1.15,pz,.033,[.22,.12,.05]);
        buffer.box(px,y+.1,y+.93,pz,.016,[.21,.29,.1]);
      }
      if (seed<-.33) {
        const pad=[.14,.29,.14], lily=[.89,.69,.73];
        const a=seed*5,h=y+.105;
        for(let j=0;j<7;j++) {
          const angle=a+j*.78, next=angle+.78;
          const at=t=>[px+.32+.23*Math.cos(t),h,pz+.18*Math.sin(t)];
          buffer.quad([px+.32,h,pz],at(next),at(angle),[px+.32,h,pz],pad);
        }
        if(detail && seed<-.84) for(let j=0;j<4;j++) {
          const t=j*Math.PI/2;
          buffer.quad([px+.32,h+.025,pz],[px+.32+.037*Math.cos(t+1),h+.042,pz+.037*Math.sin(t+1)],
            [px+.32+.092*Math.cos(t),h+.095,pz+.092*Math.sin(t)],[px+.32+.035*Math.cos(t-1),h+.04,pz+.035*Math.sin(t-1)],lily);
        }
      }
    }
  }
  return buffer.geometry();
}
