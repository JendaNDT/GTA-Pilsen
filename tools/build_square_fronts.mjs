// Překreslení vlastních vektorových fasád podle adresních záznamů a obrysů štítů.
import { readFileSync, writeFileSync } from 'node:fs';
import { cellWidth as W, cellHeight as H, columns, crownLine, facadeY } from '../src/world/square-gables.js';
const folder=new URL('../src/world/square-fronts/',import.meta.url);
const houses=JSON.parse(readFileSync(new URL('houses.json',folder),'utf8'));
const num=x=>Number(x.toFixed(2));
const rect=(x,y,w,h,fill)=>`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${fill}"/>`;
const path=(d,fill,style='')=>`<path d="${d}" fill="${fill}" ${style}/>`;
const use=(id,x,y,w=1,h=w)=>`<use xlink:href="#${id}" transform="translate(${num(x)} ${num(y)}) scale(${num(w)} ${num(h)})"/>`;
const defs=`<defs>
<linearGradient id="glass" x2=".6" y2="1"><stop stop-color="#384550"/><stop offset=".54" stop-color="#52606a"/><stop offset="1" stop-color="#615c58"/></linearGradient>
<pattern id="blocks" width="36" height="14" patternUnits="userSpaceOnUse"><path d="M0 13h36M12 0v13" stroke="#64574a" opacity=".27" fill="none"/><path d="M0 14h36" stroke="#fff9dc" opacity=".65"/></pattern>
<pattern id="tile" width="8" height="5" patternUnits="userSpaceOnUse"><path d="M0 3q2 4 4 0 2 4 4 0M1 0v3" fill="none" stroke="#53392e" opacity=".43"/><path d="M2 0v3" stroke="#e5b58d" opacity=".42"/></pattern>
<pattern id="slate" width="9" height="6" patternUnits="userSpaceOnUse"><path d="M0 4l4.5 2 4.5-2m-4.5-4v5" fill="none" stroke="#a49d92" opacity=".47"/></pattern>
<g id="rose"><circle r="4.4" fill="#8d7e6c"/><path d="M0-3.6 1.4-1.1l2 .2-1.8 2 .35 2.2L0 2l-2.2 1.3.6-2.5L-3.6-.6l2.4-.7z" fill="#eae0c8"/></g>
<g id="swag"><path d="M-16-4Q-9 9 0 6Q9 9 16-4M-13-2Q0 18 13-2" fill="none" stroke="#877866" stroke-width="2"/><path d="M-15-4Q-8 7 0 4Q8 7 15-4" fill="none" stroke="#eee3cd" stroke-width="2"/><circle cx="-16" cy="-4" r="2.5" fill="#c1ad92"/><circle cx="16" cy="-4" r="2.5" fill="#c1ad92"/></g>
<g id="vase"><path d="M-4 0h8l-1-2h-2v-3q6-3 4-8h-2l1-2h-6l1 2h-2q-2 5 4 8v3h-2z" fill="#9f8a6c" stroke="#dfd0ae" stroke-width=".7"/></g>
<g id="scroll"><path d="M-15 7q12 0 13-10q0-6 5-6q5 0 5 4q0 4-4 4q-3-1-2-3" stroke="#96836c" stroke-width="2.3" fill="none"/><path d="M-15 5q10-1 11-9" stroke="#f5e8c8" fill="none"/></g>
<g id="rider"><path d="M-18 4q2-4 8-4l12 1 4-7 6-2 5 4-2 3-4-1-4 9-6 1 3 10-2 1-6-10-5-1-5 10-2-1 3-12-4-2-6 6-3-2z" fill="#84684d"/><circle cy="-10" r="3.3" fill="#6f5748"/><path d="M-2-7h4l2 6-4 3-4-1z" fill="#aa8158"/><path d="M0-3l14-14" stroke="#655646" stroke-width="1.2"/></g>
<g id="herb"><path d="M0 10Q-2 0 2-13M0 4q-11-1-12-9Q-2-6 0 4m0-4q1-10 10-10Q10-3 0 0" fill="#81926e" stroke="#687a58" stroke-width="1"/></g>
</defs>`;
const trimLight='#f2e6ce', shade='#958571', frame='#63584b';
const band=(y,c,h=3)=>rect(0,y,W,h,shade)+rect(0,y-.5,W,h*.51,c)+rect(0,y-1,W,.9,trimLight);

function windowBay(x,y,w,h,house,topRow) {
  const {style,trim}=house, arc=['riders','renaissance','bishop','mansion'].includes(style) && topRow;
  const r=arc ? Math.min(w*.49,h*.29) : 0;
  const arch=(l,t,width,height,rad)=>`M${l} ${t+height}V${t+rad}Q${l} ${t} ${l+width/2} ${t}T${l+width} ${t+rad}V${t+height}Z`;
  let svg=path(arch(x-w/2-2.8,y-3,w+5.6,h+6,r+1),trim)+path(arch(x-w/2,y,w,h,r),'url(#glass)');
  svg+=rect(x-1,y+1,2,h-1,frame)+rect(x-w/2,y+h*.31,w,1.7,frame)+rect(x-w/2,y+h*.69,w,1.1,'#9a8c75');
  if (w>31) for (const f of [-.25,.25]) svg+=rect(x+w*f,y+2,.9,h-2,frame);
  svg+=rect(x-w/2-4,y+h+2,w+8,2.6,shade)+rect(x-w/2-4,y+h+1,w+8,1.2,trimLight);
  if (!arc) svg+=rect(x-w/2-3,y-4,w+6,2.4,trimLight);
  if (!topRow && ['secession','ornate','mansion','herb','riders'].includes(style)) {
    svg+=path(`M${x-w*.67} ${y-4}l${w*.67} -7 ${w*.67} 7z`,shade)+path(`M${x-w*.66} ${y-6}l${w*.66} -6 ${w*.66} 6z`,trimLight);
  }
  if (style==='puppet') {
    svg+=rect(x-w/2-4,y-4,w+8,4,'#805244')+rect(x-w/2-3,y,2.5,h,'#935b44')
      +rect(x+w/2+.5,y,2.5,h,'#935b44');
  }
  return svg;
}

function storeyWindows(h,eave,ground) {
  const spacing=(ground-eave)/h.floors, pitch=W/h.bays;
  let s='';
  for (let row=0;row<h.floors;row++) {
    const y=eave+spacing*(row+.21);
    for (let j=0;j<h.bays;j++) {
      const x=h.style==='puppet' ? W*[.22,.59,.81][j] : pitch*(j+.5);
      const width=Math.min(pitch*.52,50),height=spacing*.59;
      s+=windowBay(x,y,width,height,h,row===0);
      if (row===0 && ['ornate','secession','mansion'].includes(h.style)) s+=use('swag',x,y+height+6,width/42,.48);
    }
    if (h.style!=='empire') s+=band(eave+(row+1)*spacing-3,h.trim,2.2);
  }
  return s;
}

function portal(x,y,w,arch,trim) {
  const r=arch ? Math.min(14,w/2) : 1;
  const opening=(w,dy,ink)=>path(`M${x-w/2} 337V${y+dy+r}q0 -${r} ${w/2} -${r}t${w/2} ${r}V337z`,ink);
  return opening(w+6,-3,trim)+opening(w,0,'url(#glass)')+rect(x-1,y+r+1,2,336-y-r,frame)+rect(x-w/2,y+r+1,w,2,frame);
}

function modern(h,eave,base) {
  const rows=h.floors,pitch=(base-eave)/rows, hotel=h.style==='central', dark=h.style==='band';
  let s=rect(0,0,W,H,h.wall);
  for(let r=0;r<rows;r++) {
    const y=eave+pitch*(r+.16);
    if(hotel || dark) s+=rect(1,y-2,W-2,pitch*.63,dark?'#48433d':'#786858');
    for(let i=0;i<h.bays;i++) {
      const col=W/h.bays, x=col*(i+.5),w=col*(hotel ? .83 : dark ? .64 : .69);
      s+=rect(x-w/2-1.6,y-1.6,w+3.2,pitch*.51+3.2,h.trim)+rect(x-w/2,y,w,pitch*.51,'url(#glass)');
      s+=rect(x-w/2,y+pitch*.13,w,1.5,'#746e64');
    }
    if(dark || hotel) s+=band(y+pitch*.58,h.trim,3.2);
  }
  if(hotel)for(let i=0;i<=h.bays;i++){s+=rect(i*W/h.bays-2,26,4,base-26,'#dbcab0');}
  return s;
}

function crown(h,edge,points) {
  const e=facadeY(h,h.eave), rise=e-facadeY(h,h.peak);
  if (!points.length) return '';
  let s=band(e,h.trim,3.2);
  const crest=points.map(([x,y])=>[num(3+x*(W-6)),num(e-y*rise)]);
  const line='M'+crest.map(p=>p.join(' ')).join(' L');
  s+=path(line,'none','stroke="#897c69" stroke-width="4" stroke-linejoin="round"');
  s+=path(line,'none','stroke="#f1e5ce" stroke-width="1.5" stroke-linejoin="round"');
  const centers=h.shape==='twin' ? [.25,.75] : [.5];
  for(const cx of centers){
    const x=cx*W;
    if(h.shape==='triangle'){s+=use('rose',x,e-rise*.34,1.35);continue;}
    if(h.shape==='tiers' || h.shape==='steps' || h.style==='puppet'){
      const span=h.shape==='twin'?65:125;
      s+=rect(x-span/2,e-rise*.41,span,2.5,edge);
      for(const i of [-1,0,1])s+=windowBay(x+i*span*.25,e-rise*.34,span*.14,rise*.24,h,true);
      s+=rect(x-span*.24,e-rise*.73,span*.48,2.1,edge);
      s+=use('rose',x,e-rise*.62,1);
    }else{
      const w=Math.max(12,Math.min(39,rise*.56)),y=e-rise*.57;
      s+=windowBay(x,y,w,rise*.33,h,true);
      s+=use('scroll',x-w*.8,e-rise*.20,1.15,.9)+use('scroll',x+w*.8,e-rise*.20,-1.15,.9);
      s+=use('rose',x,e-rise*.76,.76);
    }
  }
  return s;
}

function frontage(h) {
  const e=facadeY(h,h.eave), ground=facadeY(h,h.base+Math.min(3.8,(h.eave-h.base)*.33));
  const line=crownLine(h);
  const profile=line.map(([u,rise])=>[num(u*W),num(e+(facadeY(h,h.peak)-e)*rise)]);
  const clip='house-'+h.number;
  let s='';
  if (profile.length) s+='<defs><clipPath id="'+clip+'"><polygon points="'+profile.concat([[W,H],[0,H]]).map(p=>p.join(',')).join(' ')+'"/></clipPath></defs><g clip-path="url(#'+clip+')">';
  if (['central','band','insurance'].includes(h.style)) {
    s+=modern(h,e,ground);
  } else {
    s+=rect(0,0,W,H,h.wall);
    if (h.shape==='mansard') s+=rect(0,0,W,e,'#665e56')+rect(0,0,W,e,'url(#slate)');
    s+=rect(0,ground,W,H-ground,'url(#blocks)');
    const pitch=W/h.bays;
    for(let i=0;i<=h.bays;i++){
      const x=i*pitch;
      if (i===0 || i===h.bays || ['bishop','renaissance','puppet'].includes(h.style)) {
        s+=rect(x-3,e,6,ground-e,h.trim)+rect(x-3,e,1.3,ground-e,trimLight);
      }
    }
    s+=storeyWindows(h,e,ground)+band(ground,h.trim,3.5)+band(e+1,h.trim,4.3);
    s+=crown(h,h.trim,line);
    if (h.style==='fresco') {
      for(const u of [.07,.5,.93]) {
        const x=W*u;
        s+=rect(x-4,e+5,8,ground-e-8,'#92997a')+use('rose',x,e+14,.9)+use('swag',x,ground-10,.48,.65);
      }
    }
    if (h.style==='riders') {
      s+=use('rider',W*.32,ground-7,1.12,.7)+use('rider',W*.68,ground-7,-1.12,.7);
      s+=path('M156 0q4-5 7 0 4-5 7 0 1 4-7 10-8-6-7-10z','#a64a3c',
        'transform="translate(-3 '+num(ground-6)+')"');
    }
    if (h.style==='herb') for(let i=1;i<h.bays;i++) s+=use('herb',pitch*i,(ground+e)/2,.8,1.1);
    if (h.style==='puppet') for(const u of [.08,.92]) {
      s+=use('vase',u*W,e-1,1.2,1.3)+use('scroll',u*W,(e+ground)/2,.9,1.3);
      const x=u*W,y=e-(e-24)*.25;
      s+=path('M-8 8V-5Q-8-16 0-16T8-5V8Z','#716b61','transform="translate('+x+' '+y+')"');
      s+=use('vase',x,y+7,.63,.92);
    }
    if (h.style==='puppet') {
      const labelY=e+(ground-e)*.50+1;
      s+=rect(22,labelY-5,276,11,h.wall)+'<text x="160" y="'+num(labelY+3)+'" font-family="serif" font-weight="bold" letter-spacing="1" font-size="9" fill="#874f40" text-anchor="middle">MUZEUM LOUTEK PLZEŇ</text>';
    }
    if (h.shape==='mansard') {
      for (const u of [.12,.32,.53,.74,.9]) {
        const x=u*W, y=e*.64;
        s+=path('M-11 0 -8-13 0-20 8-13 11 0Z','#6e655d','transform="translate('+x+' '+y+')"')
          +rect(x-5,y-12,10,11,'#394450')+rect(x-8,y,16,2,trimLight);
      }
    }
  }
  const count=h.style==='arcade' ? Math.min(4,h.bays) : h.bays;
  for(let i=0;i<count;i++) s+=portal((i+.5)*W/count,ground+7,W/count*.68,
    ['arcade','renaissance','puppet','bishop','mansion'].includes(h.style),h.trim);
  // Vstup, sokl a pás nad výlohami zůstávají čitelné i ze silnice.
  const pitch=W/count;
  for(let i=0;i<count;i++) {
    const x=(i+.5)*pitch;
    s+=rect(x-pitch*.32,321,pitch*.64,12,i%3===0?'#66564b':'#79766f')
      +rect(x-pitch*.34,ground+14,pitch*.68,2.3,'#c5b89f');
    if (i!==Math.floor(count/2))
      s+=rect(x-pitch*.32,ground+3,pitch*.64,4.6,['#716956','#887261','#a19277'][i%3]);
  }
  s+=rect(0,336,W,H-336,'#817769');
  return s+(profile.length?'</g>':'');
}

const samples=rect(0,0,W,124,'#a4644b')+rect(0,0,W,124,'url(#tile)')
  +rect(0,124,W,124,'#625f5d')+rect(0,124,W,124,'url(#slate)')
  +rect(0,248,160,104,'#d9cfb8')+rect(160,248,160,104,'#a89984');

for(const tile of new Set(houses.map(h=>h.tile))) {
  const group=houses.filter(h=>h.tile===tile);
  const panels=group.map(frontage).concat(samples);
  const rowsHeight=Math.ceil(panels.length/columns)*H;
  // Severní řada na stejném listu používá společnou texturu i vykreslovací volání.
  let north='';
  if (tile.endsWith('--128')) {
    north=readFileSync(new URL('../north-square.svg',folder),'utf8')
      .replace(/id="([^"]+)"/g,'id="north-$1"').replace(/url\(#([^)]*)\)/g,'url(#north-$1)')
      .replace(/xlink:href="#/g,'xlink:href="#north-')
      .replace('width="2048" height="1024"', 'y="'+rowsHeight+'" width="1280" height="640"');
  }
  const height=rowsHeight+(north ? 640 : 0);
  const cells=panels.map((content,i)=>'<svg x="'+i%columns*W+'" y="'+Math.floor(i/columns)*H
    +'" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+content+'</svg>');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="2048" height="'
    +Math.round(height*2048/(W*columns))+'" viewBox="0 0 '+W*columns+' '+height+'">'+defs+cells.join('\n')+north+'</svg>\n';
  writeFileSync(new URL(tile+'.svg',folder),svg);
}
