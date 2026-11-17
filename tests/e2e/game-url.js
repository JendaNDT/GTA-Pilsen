import { test } from '@playwright/test';

export function gameUrl(path) {
  const { name, use } = test.info().project;
  const url = new URL(path, use.baseURL);
  if (name === 'webgl2') url.searchParams.set('renderer', 'webgl');
  return url.href;
}
