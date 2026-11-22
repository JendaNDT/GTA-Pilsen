// Otisky distribuovaných souborů a kontrola všech odkazů ze čtyř prostorových katalogů.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assetFingerprint } from '../src/fingerprint.js';

export function graphicsManifest(root = 'public') {
  const files = {};
  function record(path) {
    const raw = readFileSync(join(root,path));
    files[path] = {bytes:raw.length, fingerprint:assetFingerprint(raw), sha256:createHash('sha256').update(raw).digest('hex')};
  }
  function visit(name) {
    const entries = readdirSync(join(root,name),{withFileTypes:true});
    for (const entry of entries.sort((a,b) => a.name < b.name ? -1 : 1)) {
      const path = name + '/' + entry.name;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) record(path);
    }
  }
  record('data/collision-roofs.json');
  for (const dir of ['detail','luts','models','textures']) visit(dir);
  const index = dir => JSON.parse(readFileSync(join(root,'detail',dir,'index.json')));
  const check = (path, key, expected) => {
    if (!files[path] || files[path][key] !== expected) throw Error('Neúplné nebo změněné podklady: ' + path);
  };
  for (const block of Object.values(index('orthophoto').blocks)) {
    check('detail/orthophoto/'+block.file,'sha256',block.sha256);
    check('detail/orthophoto/'+block.file,'bytes',block.bytes);
  }
  for (const [,,file] of index('city').tiles) {
    if (!files['detail/city/'+file]) throw Error('Chybí městská dlaždice ' + file);
  }
  const structures = index('structures'), streets = index('streets');
  check('detail/structures/core.bin','fingerprint',structures.hash);
  for (const tile of structures.tiles) check('detail/structures/'+tile.file,'fingerprint',tile.hash);
  check('detail/structures/index.json','fingerprint',streets.structures);
  if (streets.city !== index('city').sha256) throw Error('Ulice vycházejí z jiného městského modelu');
  for (const section of streets.sections) check('detail/streets/'+section.name,'fingerprint',section.hash);
  return {version:1,files};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(process.argv[2] ?? 'public/graphics-manifest.json', JSON.stringify(graphicsManifest(),null,2)+'\n');
}
