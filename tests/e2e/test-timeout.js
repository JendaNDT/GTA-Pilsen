// Na strojích GitHubu vykresluje prohlížeč softwarově a hra startuje pomaleji.
export function testTimeout(ms = 90_000) {
  return process.env.CI ? Math.max(ms, 300_000) : ms;
}
