// Vypiš skutečnou chybu startu i na adaptéru, který odmítl grafickou pipeline.
export async function waitForGame(page) {
  const result = await page.waitForFunction(() => {
    const message = document.getElementById('loadtext')?.textContent ?? '';
    return window.__ready || (message.startsWith('Hru se nepodařilo spustit') && message);
  });
  const status = await result.jsonValue();
  if (status !== true) throw new Error(status);
}
