import manifest from '../../public/graphics-manifest.json' with {type:'json'};
import { assetFingerprint } from '../fingerprint.js';

export function matchesGraphicAsset(path, bytes) {
  const expected = manifest.files[path];
  return Boolean(expected && bytes && bytes.byteLength === expected.bytes &&
    assetFingerprint(bytes) === expected.fingerprint);
}

export async function fetchGraphicResponse(path, url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw Error('Nedostupný soubor ' + path);
  const bytes = await response.arrayBuffer();
  if (!matchesGraphicAsset(path, bytes)) throw Error('Obsah neodpovídá vydání hry: ' + path);
  return new Response(bytes, {headers:{'Content-Type':response.headers.get('content-type') || 'application/octet-stream'}});
}

export async function graphicAsset(path, base = import.meta.env?.BASE_URL ?? '/', signal) {
  return (await fetchGraphicResponse(path, base + path, { signal })).blob();
}
