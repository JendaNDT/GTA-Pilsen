// Desetisekundový průjezd potřebuje aspoň deset vzorků CPU za sekundu.
// Dotazy GPU jsou asynchronní, pro jejich P95 požadujeme alespoň tři za sekundu.
export function frameBudgets(summary, seconds) {
  const result = {};
  for (const [name, metric, limit, perSecond] of [
    ['physics','physicsMs',4,10], ['logic','logicMs',2,10],
    ['render','renderMs',6,10], ['gpu','gpuMs',12,3],
  ]) {
    const samples = summary?.[name + 'Samples'] ?? 0;
    const required = Math.max(20, Math.ceil(seconds * perSecond));
    const p95 = summary?.[metric]?.p95;
    const status = !Number.isFinite(p95) || samples < required ? 'neprůkazné'
      : p95 <= limit ? 'splněno' : 'překročeno';
    result[name] = { p95: p95 ?? null, limit, samples, required, status };
  }
  return result;
}
