export function assetFingerprint(buffer) {
  let hash = 2166136261;
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
