import { ShapeUtils, Vector2 } from 'three/webgpu';

// Polohy hladin z OSM, směry chrličů odečtené z ortofota. U roste ve směru výtoku.
export const fountains = [
  {id:'andel',name:'Anděl',x:48.55,z:-26.4,angle:.213,depth:.58,
    bowls:[{u:-2.43,ru:1.4,rv:1.4},{u:2.43,ru:1.4,rv:1.4}],
    mouths:[{u:-1.78,low:4.08,high:4.74,target:-2.43},{u:1.78,low:4.23,high:4.9,target:2.43}]},
  {id:'chrtice',name:'Chrtice',x:-54.54,z:82.18,angle:1.77,depth:.51,
    bowls:[{u:0,ru:1.42,rv:2.1}],mouths:[{u:-.68,low:3.16,high:3.7,target:0}]},
  {id:'velbloud',name:'Velbloud',x:21.13,z:98.73,angle:1.24,depth:.56,
    bowls:[{u:0,ru:2.45,rv:2.45,square:true}],mouths:[{u:-2.04,low:3.34,high:3.84,target:-1.12}]},
];

export function fountainPoint(site,u,y,v) {
  return [site.x+u*site.cos-v*site.sin,site.ground+y,site.z+u*site.sin+v*site.cos];
}

function outline(id,detail) {
  if (id==='andel') return [[-.36,-.24],[.36,-.24],[.36,4.00],[1.78,4.23],[1.78,4.9],
    [.03,4.62],[-1.78,4.74],[-1.78,4.08],[-.36,3.97]];
  if (id==='velbloud') return [[-7.25,-.24],[-6.64,-.24],[-6.52,3.52],[-4.38,3.44],
    [-4.21,-.24],[-3.67,-.24],[-3.79,3.40],[-2.04,3.34],[-2.04,3.84],[-6.96,4.10]];
  const p=[[-3.56,-.24],[-2.95,-.24],[-2.39,1.39],[-1.63,-.24],[-1.03,-.24],[-2.10,1.98]];
  function curve(cx,cy,x,y) {
    const [ax,ay]=p.at(-1), n=detail ? 12 : 4;
    for (let i=1;i<=n;i++) {
      const t=i/n,s=1-t;
      p.push([s*s*ax+2*s*t*cx+t*t*x,s*s*ay+2*s*t*cy+t*t*y]);
    }
  }
  curve(-1.96,2.97,-.68,3.16);
  p.push([-.68,3.7]);
  curve(-2.55,3.58,-2.84,2.04);
  return p;
}

export function fountainSculpture(site,detail,polygon) {
  const p=outline(site.id,detail), half=site.depth/2;
  const cap=p.map(([u,h])=>new Vector2(u,h));
  const vertex=(i,v)=>fountainPoint(site,...p[i],v);
  for (const tri of ShapeUtils.triangulateShape(cap,[])) {
    polygon(tri.map(i=>vertex(i,half)),'gold');
    polygon(tri.map(i=>vertex(i,-half)).reverse(),'gold');
  }
  for (let i=0;i<p.length;i++) {
    const j=(i+1)%p.length, m=site.mouths.find(m=>p[i][0]===m.u && p[j][0]===m.u);
    if (!m) {
      polygon([vertex(i,-half),vertex(j,-half),vertex(j,half),vertex(i,half)],'gold');
      continue;
    }
    // Ústí má zlaté ostění, tmavé vnitřní stěny a dno zapuštěné do bronzu.
    const sign=Math.sign(m.target-m.u);
    const ring=(u,border)=>[
      [u,m.low+border,-half+border],[u,m.high-border,-half+border],
      [u,m.high-border,half-border],[u,m.low+border,half-border],
    ].map(a=>fountainPoint(site,...a));
    const outer=ring(m.u,0), inner=ring(m.u,.065), back=ring(m.u-sign*.27,.065);
    for (let k=0;k<4;k++) {
      const next=(k+1)%4;
      const lip=[outer[k],outer[next],inner[next],inner[k]];
      const wall=[inner[k],inner[next],back[next],back[k]];
      polygon(sign>0 ? lip : lip.reverse(),'gold');
      polygon(sign>0 ? wall : wall.reverse(),'bronze');
    }
    polygon(sign>0 ? back : back.reverse(),'bronze');
  }
}

export const waterHeight=.70;
export function fountainBowl(site,bowl,sides,polygon,distant=false) {
  const square=bowl.square;
  const profile=distant ? (square ? [[-.22,1],[.77,1],[.70,.945]] : [[-.22,.25],[.25,.69],[.77,1],[.70,.945]]) : square ? [[-.22,.94],[.08,.97],[.17,1],[.77,1],[.77,.959],[.26,.91]]
    : [[-.22,.24],[.06,.25],[.12,.43],[.24,.66],[.42,.84],[.62,.96],[.77,1],[.77,.958],[.57,.87],[.34,.62],[.22,.28]];
  const n=square ? 4 : sides;
  const at=(i,r,h)=>{
    if (!square) {
      const a=2*Math.PI*i/n;
      return fountainPoint(site,bowl.u+bowl.ru*r*Math.cos(a),h,-bowl.rv*r*Math.sin(a));
    }
    // Čtverec Velblouda má hrany rovnoběžné s náměstím, chrlič je k němu šikmo.
    const [u,v]=[[1,1],[1,-1],[-1,-1],[-1,1]][i%4];
    const x=u*bowl.ru*r,z=v*bowl.rv*r,angle=.218;
    return [site.x+x*Math.cos(angle)-z*Math.sin(angle),site.ground+h,site.z+x*Math.sin(angle)+z*Math.cos(angle)];
  };
  for (let i=0;i<n;i++) {
    for (let k=1;k<profile.length;k++) {
      const [a,r]=profile[k-1],[b,s]=profile[k];
      polygon([at(i,r,a),at(i+1,r,a),at(i+1,s,b),at(i,s,b)],'stone');
    }
    const [h,r]=profile.at(-1);
    if (!distant) polygon([fountainPoint(site,bowl.u,h,0),at(i,r,h),at(i+1,r,h)],'stone');
    polygon([fountainPoint(site,bowl.u,waterHeight,0),at(i,.945,waterHeight),at(i+1,.945,waterHeight)],'pool');
  }
}

export function streamPoint(site,m,t) {
  const u=m.u+(m.target-m.u)*t;
  const top=m.low+.105, y=top+(waterHeight-top)*t*t;
  return fountainPoint(site,u,y,0);
}

// Mísy mají v mapě vlastní polygon vody. Pod osazenou nádobou pokračuje dlažba náměstí.
export function isFountainPool(x0,z0,x1,z1) {
  if (x1-x0>6.6 || z1-z0>6.6) return false;
  const x=(x0+x1)/2,z=(z0+z1)/2;
  return fountains.some(f=>f.bowls.some(b=>Math.hypot(x-f.x-b.u*Math.cos(f.angle),z-f.z-b.u*Math.sin(f.angle))<.32));
}
