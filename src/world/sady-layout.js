import { easternBeds, easternBenches, easternLawns, easternSites, easternWalks } from './strouha-layout.js';

// Obrys Smetanových sadů, osy pěšin, pomník, pítko a lavičky z místního výřezu OSM.
export const lawn = [
  [-247.3,243.1],[-289.3,261.2],[-285.9,268],[-238.6,288.9],[-199.4,304],
  [-169.7,313],[-147.9,317.2],[-144.2,315.9],[-140.4,298.7],[-136.7,281.9],
  [-139.7,277.4],[-176.7,271.2],[-187.9,269.3],[-193.2,268.4],[-225.4,258.3],
  [-229.8,255.8],[-236.9,251.8],
];
const westKopecky = [[-113.9,279.5],[-63.8,281.9],[-45.8,283.6],[9.2,288.6],[7,297],
  [-1,309.1],[-58.1,312.6],[-78.3,313.8],[-119.8,316.9],[-121.2,315.1]];
const museumLawn = [[23,290],[37,292.4],[106,302],[111.4,304.5],[117,304],[128,318],
  [126.5,320],[26,308.4],[21.7,307.6]];
const lawns=[lawn,westKopecky,museumLawn];
export const features = [
  {id:'rusalka',name:'Kašna Rusalka',x:-253.45,z:259,angle:-.42},
  {id:'smetana',name:'Pomník Josefa Františka Smetany',x:-183.2,z:276.4,angle:.16},
  {id:'leknin',name:'Pítko Leknín',x:-129.7,z:299.2,angle:.32},
  {id:'corso',name:'Fontána Corso',x:-83.7,z:295.15,angle:0,rx:3.56,rz:3.56},
  {id:'matka',name:'Matka s dítětem',x:-28.7,z:300.85,angle:-.3,rx:3.6,rz:3.6},
  {id:'bedrich',name:'Pomník Bedřicha Smetany',x:-92.6,z:291.9,angle:.2},
  {id:'kopecky',name:'Pomník Martina Kopeckého',x:-55.8,z:289.3,angle:.16},
  {id:'loubi',name:'Zelené loubí u muzea',x:75,z:302.6,angle:.115},
  {id:'muzeum',name:'Fontána před muzeem',x:141.25,z:307.55,angle:-.67,rx:8.8,rz:5.05},
  ...easternSites,
];
export const benches = [
  [-157.2,294.3,.17],[-172.4,305.1,-1.38],[-181.3,287.4,2.23],[-137.9,290,1.78],
  [-145,299.2,.17],[-234.9,262.7,1.62],[-174.1,267.3,-1.36],[-174,298.8,1.79],[-141.6,308.5,-1.35],
  [94.3,299.5,0.12],
  [86.6,298.6,0.12],
  [102.7,317.1,3.26],
  [96.5,316.3,3.26],
  [65.4,295.6,0.12],
  [83.0,298.1,0.12],
  [53.6,294.4,0.12],
  [45.1,293.0,0.12],
  [129.2,314.1,-0.68],
  [127.3,311.5,-0.68],
  [62.7,295.2,0.12],
  [125.2,309.5,-0.68],
  [88.6,315.2,3.26],
  [120.6,303.9,0.12],
  [123.0,306.7,-0.68],
  [-82.8,308.3,0.15],
  [-51.5,292.5,0.15],
  [-107.6,300.9,0.15],
  [-114.3,303.1,0.15],
  [-103.8,304.2,0.15],
  [-58.2,300.5,0.15],
  [-56.2,306.1,0.15],
  [-91.9,301.7,0.15],
  [-98.5,294.8,0.15],
  ...easternBenches,
];
// Výtvarná skladba nízkých záhonů sleduje volné plochy mezi skutečnými cestami.
export const beds = [
  [-267,259.2,7.5,1.65,-.38],[-244.2,265,5.8,1.6,-.42],
  [-218.5,277,9.8,1.55,.28],[-212,289.9,7.4,1.45,.35],
  [-183,280.2,3.1,1.35,.18],[-161,289.7,9.0,1.45,.17],[-158.7,304.8,8.2,1.45,.17],
  [-95,308,6.2,1.3,.24],[-78.1,300.4,3.4,1.05,-.52],[-40,289.8,6,1.3,.11],
  [-16.1,296,8,1.5,.1],[47.4,301.6,12,1.6,.115],[79.6,305,13,1.7,.115],[104.8,309,7.4,1.5,.12],
  ...easternBeds,
];
export const gardenWalks = [
  [[-243,286],[-240.8,281.5],[-233.6,275.7],[-233.1,263.3],[-229.8,255.8]],
  [[-233.6,275.7],[-217.7,280.8],[-200.7,284.5],[-190,282.3],[-179.9,284.9],[-171.9,293.3],[-140.4,298.7]],
  [[-200.7,284.5],[-202.8,302]], [[-179.9,284.9],[-176.7,271.2]],
  [[-171.9,293.3],[-175.5,310.4]], [[-190,282.3],[-187.9,269.3]],
  [[-118.4,301.4],[-98.7,302.7],[-78.3,313.8],[-58.1,312.6],[-56.3,297.1],[-62.7,284.1],[-63.8,281.9]],
  [[-58.1,312.6],[-1,309.1],[8.4,290.1]], [[-56.3,297.1],[-47.3,285.4],[-45.8,283.6]],
  [[23.7,289.9],[37.2,291.1],[106.4,299.7],[111.8,299.4]],
];

export function inLawn(lawn,x,z) {
  let inside=false;
  for(let i=0,j=lawn.length-1;i<lawn.length;j=i++) {
    const [a,b]=lawn[i], [c,d]=lawn[j];
    if ((b>z)!==(d>z) && x<a+(c-a)*(z-b)/(d-b)) inside=!inside;
  }
  return inside;
}

export function inSady(x,z) {
  if (x >= 116 && x <= 419 && z >= -173 && z <= 305 &&
      easternLawns.some(outline => inLawn(outline,x,z))) return true;
  if(x < -290 || x > 129 || z < 242 || z > 321) return false;
  return lawns.some(outline=>inLawn(outline,x,z));
}

export function paintSady(ctx,x,z,span) {
  const west = x+span >= -291 && x <= 130 && z+span >= 242 && z <= 321;
  const east = x+span >= 116 && x <= 419 && z+span >= -173 && z <= 305;
  if (!west && !east) return;
  const outlines = west && east ? [...lawns,...easternLawns] : west ? lawns : easternLawns;
  const paths = west && east ? [...gardenWalks,...easternWalks] : west ? gardenWalks : easternWalks;
  const path=points=>{
    ctx.beginPath();ctx.moveTo(...points[0]);
    for(const p of points.slice(1)) ctx.lineTo(...p);
  };
  ctx.save();
  ctx.beginPath();
  for(const outline of outlines) {
    ctx.moveTo(...outline[0]);
    for(const p of outline.slice(1)) ctx.lineTo(...p);
    ctx.closePath();
  }
  ctx.clip();
  ctx.fillStyle='#7e9c65';ctx.fill();
  for(const points of paths) {
    path(points);
    ctx.lineWidth=3.35;ctx.strokeStyle='#aba18e';ctx.stroke();
    ctx.lineWidth=2.9;ctx.strokeStyle='#c7bdab';ctx.stroke();
  }
  ctx.beginPath();ctx.ellipse(-183.2,276.8,5.9,6.5,.18,0,Math.PI*2);
  ctx.fillStyle='#c7bdab';ctx.fill();
  for(const [bx,bz,a,b,angle] of beds) {
    ctx.beginPath();ctx.ellipse(bx,bz,a,b,angle,0,Math.PI*2);
    ctx.fillStyle='#727447';ctx.fill();
  }
  ctx.restore();
}

export function inRusalka(x,z) {
  const site=features[0], dx=x-site.x, dz=z-site.z;
  if(Math.abs(dx)>6.5 || Math.abs(dz)>6.5) return false;
  const c=Math.cos(site.angle),s=Math.sin(site.angle);
  return Math.abs(dx*c+dz*s)<4.7 && Math.abs(dz*c-dx*s)<4.8;
}

const basins = features.filter(site => site.rx).map(site => ({
  ...site, cos: Math.cos(site.angle), sin: Math.sin(site.angle)
}));

const leknin = features.find(site => site.id === 'leknin');

export function inParkFountain(x, z) {
  if (x < -261 || x > 151 || z < 251 || z > 318) return false;
  if (inRusalka(x, z)) return true;
  for (const basin of basins) {
    const dx = x - basin.x, dz = z - basin.z;
    const u = dx * basin.cos + dz * basin.sin, v = dz * basin.cos - dx * basin.sin;
    if ((u / (basin.rx + .35)) ** 2 + (v / (basin.rz + .35)) ** 2 < 1) return true;
  }
  return (x - leknin.x) ** 2 + (z - leknin.z) ** 2 < 1.6 ** 2;
}

// Pod oválnou nádrží u muzea se původní vodní polygon choval jako přírodní břeh.
export function museumWaterPolygon(x0,z0,x1,z1) {
  return Math.abs((x0+x1)/2-141.25)<1 && Math.abs((z0+z1)/2-307.55)<1
    && Math.abs((x1-x0)-14.5)<2 && Math.abs((z1-z0)-13.3)<2;
}
