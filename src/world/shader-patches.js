/** Zachová pořadí náhrad a v debug režimu upozorní na nekompatibilní shader knihovny. */
export function patchShader(source, label, replacements, debug = false) {
  for (const [needle, replacement] of replacements) {
    if (debug && !source.includes(needle)) {
      console.warn(`Úprava shaderu „${label}“: nenalezen řetězec „${needle}“.`);
    }
    source = source.replace(needle, replacement);
  }
  return source;
}
