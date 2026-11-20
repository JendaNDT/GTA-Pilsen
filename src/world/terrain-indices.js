// Jemná síť zůstane tam, kde se v dlaždici měnily výšky. Okolí používá původní
// úhlopříčky terénu a na společných hranách přebírá vrcholy jemného souseda.
export function localGradeIndices(size, step, offsets) {
  const stride = size + 1, cells = size / step;
  const fine = new Uint8Array(cells * cells);
  for (let z = 0; z <= size; z++) for (let x = 0; x <= size; x++) {
    if (!offsets[z * stride + x]) continue;
    const left = Math.max(0, Math.floor((x - 1) / step)), right = Math.min(cells - 1, Math.floor(x / step));
    const top = Math.max(0, Math.floor((z - 1) / step)), bottom = Math.min(cells - 1, Math.floor(z / step));
    for (let j = top; j <= bottom; j++) for (let i = left; i <= right; i++) fine[j * cells + i] = 1;
  }
  const indices = [];
  const quad = (a, width) => {
    const b = a + width, c = a + stride * width;
    indices.push(a, c, b, b, c, c + width);
  };
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const cell = j * cells + i, a = step * (j * stride + i);
    if (fine[cell]) {
      for (let z = 0; z < step; z++) for (let x = 0; x < step; x++) quad(a + z * stride + x, 1);
      continue;
    }
    const left = i > 0 && fine[cell - 1], right = i + 1 < cells && fine[cell + 1];
    const top = j > 0 && fine[cell - cells], bottom = j + 1 < cells && fine[cell + cells];
    if (!left && !right && !top && !bottom) {
      quad(a, step);
      continue;
    }
    // Střed leží na původní úhlopříčce. Každý trojúhelník proto zůstává v jedné její rovině.
    const center = a + step / 2 * (stride + 1);
    const side = (from, direction, divided) => {
      const jump = divided ? 1 : step;
      for (let k = 0; k < step; k += jump) indices.push(center, from + k * direction, from + (k + jump) * direction);
    };
    side(a, stride, left);
    side(a + step * stride, 1, bottom);
    side(a + step * (stride + 1), -stride, right);
    side(a + step, -1, top);
  }
  return new Uint16Array(indices);
}
