import { test } from '@playwright/test';

export function gameUrl(path, { defaultRenderer = false } = {}) {
  const { name, use } = test.info().project;
  const url = new URL(path, use.baseURL);
  if (process.env.PLZEN_TEST_PHYSICS === 'old') url.searchParams.set('physics', 'old');
  if (!defaultRenderer && name === 'webgl2') url.searchParams.set('renderer', 'webgl');
  return url.href;
}
