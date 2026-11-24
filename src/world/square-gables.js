// Čára horní římsy z čelního pohledu. Souřadnice jsou podíly šířky a výšky štítu.
const halfProfiles = {
  triangle: [[0,0],[.5,1]],
  tiers: [[0,.03],[0,.14],[.10,.14],[.12,.2],[.13,.30],[.13,.42],
    [.22,.42],[.22,.53],[.27,.55],[.28,.66],[.28,.72],[.37,.72],[.37,.84],[.42,.84],[.42,.90],[.5,1]],
  steps: [[0,0],[0,.12],[.12,.12],[.12,.34],[.23,.34],[.23,.57],[.34,.57],[.34,.80],[.40,.80],[.5,1]],
  round: [[0,.02],[.04,.09],[.14,.09],[.19,.17],[.24,.26],[.28,.40],[.29,.57],
    [.32,.72],[.35,.83],[.4,.92],[.45,.98],[.5,1]],
  volute: [[0,.04],[.04,.16],[.12,.16],[.16,.20],[.17,.27],[.15,.32],[.17,.35],
    [.22,.32],[.26,.38],[.30,.53],[.31,.69],[.34,.78],[.40,.81],[.43,.87],[.46,.96],[.5,1]],
  scroll: [[0,.04],[.035,.12],[.095,.12],[.14,.18],[.19,.24],[.22,.34],[.23,.47],
    [.21,.52],[.23,.56],[.28,.54],[.31,.6],[.32,.7],[.31,.78],[.36,.79],[.41,.86],[.44,.94],[.5,1]],
  ogee: [[0,.02],[.06,.12],[.12,.13],[.19,.22],[.24,.34],[.27,.48],[.26,.62],
    [.28,.68],[.34,.70],[.40,.76],[.44,.86],[.46,.94],[.5,1]],
  crest: [[0,.03],[.30,.03],[.32,.13],[.37,.18],[.40,.32],[.40,.69],[.44,.76],[.5,1]],
};

function symmetric(half) {
  return half.concat(half.slice(0,-1).reverse().map(([x,y])=>[1-x,y]));
}

export function crownLine(house) {
  if (house.shape==='twin') {
    const one=symmetric(halfProfiles[house.number===12 ? 'steps' : 'volute']);
    return one.map(([x,y])=>[x*.5,y]).concat(one.slice(1).map(([x,y])=>[.5+x*.5,y]));
  }
  if (house.shape==='triple') {
    const one=symmetric(halfProfiles.triangle);
    return [[0,0],[.04,.42],[.12,.70],[.20,.45],[.24,.12],
      ...one.map(([x,y])=>[.28+x*.44,.20+.80*y]),[.76,.12],[.80,.45],[.88,.70],[.96,.42],[1,0]];
  }
  const half=halfProfiles[house.shape];
  return half ? symmetric(half) : [];
}

// Jeden oddělený obdélník textury na adresu. Poslední pole obsahuje krytinu a odstíny říms.
export const cellWidth=320, cellHeight=352, columns=4;
export function facadeY(house,height) {
  return 333-(height-house.base)/(house.peak-house.base)*309;
}
