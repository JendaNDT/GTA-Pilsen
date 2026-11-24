import * as THREE from 'three/webgpu';

export const museumTile = '128-384.bin';
// Osa u probíhá podél vstupního průčelí, d roste směrem ke kašně.
const length = Math.hypot(18.16, 14.42);
const ux = 18.16 / length, uz = -14.42 / length;
const point = (u, d, y) => [123.92 + ux*u - uz*d, y, 287.07 + uz*u + ux*d];
const along = ([x,,z]) => (x-123.92)*ux + (z-287.07)*uz;
const pixel = (x,y) => [x/1536, 1-y/1024];
const front = p => pixel(304 + along(p)*576/length, 670-(p[1]+5)*25);
const stone = pixel(645,680), sand = pixel(705,680), iron = pixel(765,680), pewter = pixel(825,680);

export function museumGeometry(pack, shell) {
  if (pack.fileHash !== 'd45bbb33') return null;
  const positions = [], uvs = [];
  function triangle(points, paint) {
    for (const p of points) {
      positions.push(...p);
      uvs.push(...(typeof paint === 'function' ? paint(p) : paint));
    }
  }
  function quad(a,b,c,d,paint) {
    triangle([a,b,c],paint);
    triangle([a,c,d],paint);
  }
  const pos = shell.getAttribute('position');
  // Pořadí ploch platí pouze pro ověřený městský list. Zadní přístavky a sousedy zachováme.
  for (let j=432; j<1947; j+=3) {
    const points = Array.from(pack.i.subarray(j,j+3), i => [pos.getX(i),pos.getY(i),pos.getZ(i)]);
    if ((j>=1137 && j<1671) || (j>=1734 && j<1740) || j>=1878) {
      // Dva jehlany v měření zastupují celé krajní věžičky. Nad úpatí přijde otevřená lucerna.
      for (const p of points) if (p[1]>30.8) p[1]=27.95;
      triangle(points, ([x,y,z]) => pixel(651+(x-58)*10, 39+(z-218)*7+y));
    } else if (j>=1740 && j<1878) {
      // Zakulacené nároží má souvislé pásy i na úzkých ploškách kolem osy.
      const angle = ([x,,z]) => Math.atan2(z-222.8,x-132.28);
      const start = angle(points[0]);
      triangle(points,p => {
        const delta = angle(p)-start;
        const a = start+Math.atan2(Math.sin(delta),Math.cos(delta));
        return pixel(818+a*160/Math.PI, 700+(11.12-p[1])*17.3);
      });
    } else if (j>=948 && j<1041) {
      triangle(points,front);
    } else if (j>=903 && j<1086) {
      // Oba ústupky mají vlastní osu okna. Na bocích se kresba otáčí kolmo k čelu.
      const parallel = (j>=915 && j<930) || (j>=1059 && j<1074);
      const outer = j<915 || j>=1074;
      triangle(points,p => {
        const depth = -(p[0]-123.92)*uz+(p[2]-287.07)*ux;
        const offset = parallel ? Math.abs(along(p))-14.86 : depth+(outer ? 6.75 : 2.15);
        return pixel(77+offset*(parallel ? 18 : 22), Math.max(25,670-(p[1]+5)*26.7));
      });
    } else {
      // Společná souřadnice pro celou délku křídla zachová návaznost kresby přes švy měření.
      const eastWing = j>=630 && j<903;
      triangle(points, ([x,y,z]) => pixel(38+(eastWing ? z-218 : x-60)*19, Math.max(700,700+(17.1-y)*12.65)));
    }
  }

  function band(half, bottom, top, depth, back, paint) {
    const a=point(-half,depth,bottom), b=point(half,depth,bottom);
    const c=point(half,depth,top), d=point(-half,depth,top);
    quad(a,b,c,d,paint);
    quad(d,c,point(half,back,top),point(-half,back,top),paint);
    quad(point(-half,back,bottom),a,d,point(-half,back,top),paint);
    quad(b,point(half,back,bottom),point(half,back,top),c,paint);
    quad(a,point(-half,back,bottom),point(half,back,bottom),b,paint);
  }
  // Portál přebírá kresbu dveří a soch ze stejného rozvržení jako zadní stěna.
  band(2.57,-5,2.72,1.12,-.35,front);
  band(2.73,2.25,2.47,1.28,-.35,sand);
  for (const [y,depth] of [[2.69,.16],[12.97,.29],[13.33,.22],[20.4,.38]]) {
    band(length/2+.09,y,y+.14,depth,-.48,stone);
  }
  function turned(x,z,profile,sides) {
    for (let i=0; i<sides; i++) {
      const ring = (j,y,r) => [x+Math.cos(j*2*Math.PI/sides)*r,y,z+Math.sin(j*2*Math.PI/sides)*r];
      for (let k=1; k<profile.length; k++) {
        const [lo,r]=profile[k-1], [hi,s,paint]=profile[k];
        quad(ring(i+1,lo,r),ring(i,lo,r),ring(i,hi,s),ring(i+1,hi,s),paint);
      }
    }
  }
  for (const u of [-2.1,2.1]) {
    const [x,,z]=point(u,.2,0);
    turned(x,z,[[13.3,.45],[13.64,.49,stone],[13.85,.36,stone],[19.65,.30,stone],
      [19.85,.47,stone],[20.12,.50,stone]],12);
  }
  // Tři vikýře v čelní mansardě, se zapuštěným oknem pod kovovou stříškou.
  for (const u of [-3.1,0,3.1]) {
    const w = u===0 ? .72 : .47, d = -2.05, h = 23.09;
    const a=point(u-w,d,h), b=point(u+w,d,h);
    const c=point(u+w,d,h+1.12), e=point(u-w,d,h+1.12), peak=point(u,d,h+1.62);
    quad(a,b,c,e,pewter);
    triangle([e,c,peak],iron);
    quad(point(u-w*.65,d+.02,h+.12),point(u+w*.65,d+.02,h+.12),
      point(u+w*.65,d+.02,h+.93),point(u-w*.65,d+.02,h+.93),pixel(887,680));
    for (const side of [-1,1]) {
      quad(point(u+side*w,d,h+1.12),peak,point(u,d-1.8,h+1.62),point(u+side*w,d-1.8,h+1.12),iron);
      quad(point(u+side*w,d,h-.65),point(u+side*w,d-1.8,h-.65),point(u+side*w,d-1.8,h+1.12),
        point(u+side*w,d,h+1.12),pewter);
    }
  }
  // Horní části věžiček mají průhledy až na oblohu a každá spočívá na zaměřené ose.
  function lantern(x,z,base,r,opening,spire) {
    const sill=base+1.8*r, crown=sill+opening;
    turned(x,z,[[base,1.12*r],[base+.35*r,1.14*r,iron],[sill-.24*r,.82*r,pewter],
      [sill,1.05*r,iron],[sill,0,iron]],8);
    for (let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      turned(x+.79*r*Math.cos(a),z+.79*r*Math.sin(a),[[sill,.13*r],[crown,.12*r,pewter]],6);
    }
    turned(x,z,[[crown,0],[crown,1.09*r,iron],[crown+.28*r,1.11*r,pewter],
      [crown+1.08*r,.67*r,iron],[crown+1.52*r,.20*r,pewter],[spire-.42,.046,iron],
      [spire-.28,.12,pewter],[spire,0,iron]],8);
  }
  // Osmiboký buben zakrývá otvor v zaměřené střeše kolem hlavní věžičky.
  turned(118.58,280.68,[[24.2,2.52],[29.02,2.52,iron],[29.2,2.62,pewter],[29.4,1.56,iron]],8);
  lantern(118.58,280.68,29.35,1.56,2.8,44.32);
  for (const [x,z] of [[115.2,290.2],[128.75,279.69]]) {
    turned(x,z,[[23.1,1.86],[24.4,1.58,iron],[26.79,.98,pewter]],8);
    lantern(x,z,26.75,.95,1.54,33);
  }

  shell.setIndex([...pack.i.subarray(0,432),...pack.i.subarray(2121)]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function museumMaterial() {
  const map = new THREE.TextureLoader().load(new URL('./museum.svg',import.meta.url).href);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshStandardNodeMaterial({map,side:THREE.DoubleSide,roughness:.86});
}
