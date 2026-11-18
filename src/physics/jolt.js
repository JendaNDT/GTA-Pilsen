export async function loadJolt() {
  try {
    const { default: initialize } = await import('jolt-physics/wasm-compat');
    return await initialize();
  } catch (cause) {
    throw new Error('Nepodařilo se načíst fyziku vozidel. Obnov stránku a zkus to znovu.', { cause });
  }
}
