import { test } from '@playwright/test';

export function gameUrl(path, { defaultRenderer = false } = {}) {
  const { name, use } = test.info().project;
  const url = new URL(path, use.baseURL);
  if (!defaultRenderer && name === 'webgl2') url.searchParams.set('renderer', 'webgl');
  return url.href;
}
