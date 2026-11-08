/**
 * UI audit script: screenshots the built extension in multiple viewports,
 * themes, and states. Not part of the vitest/playwright suite - run manually:
 *   node scripts/ui-audit.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BUILD_DIR = path.resolve(import.meta.dirname, '../.output/chrome-mv3');
const OUT_DIR = path.resolve(import.meta.dirname, '../.ui-audit');
mkdirSync(OUT_DIR, { recursive: true });

const SAMPLE = JSON.stringify(
  {
    workspace: 'json-studio',
    version: '1.0.0',
    features: ['lossless', 'integrity', 'search'],
    nested: { users: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Lin' }], ok: true },
  },
  null,
  2,
);

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${BUILD_DIR}`, `--load-extension=${BUILD_DIR}`],
});

const sw = () =>
  new Promise((resolve, reject) => {
    const found = context.serviceWorkers().find((w) => w.url().startsWith('chrome-extension://'));
    if (found) return resolve(found);
    context.on('serviceworker', (w) => w.url().startsWith('chrome-extension://') && resolve(w));
    setTimeout(() => reject(new Error('no service worker')), 20000);
  });
const worker = await sw();
const host = worker.url().split('/')[2];

async function shot(name, { width = 1280, height = 800, dark = false, action, doc = SAMPLE } = {}) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(`chrome-extension://${host}/workspace.html`);
  await page.waitForTimeout(300);
  if (doc !== null) {
    await page.locator('textarea').first().fill(doc);
    await page.waitForTimeout(1200);
  }
  if (dark) {
    await page.locator('[title="Switch between light and dark theme"]').click();
  }
  if (action) await action(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
  await page.close();
  console.log(`shot: ${name}`);
}

await shot('01-empty', { doc: null });
await shot('02-desktop', {});
await shot('03-dark', { dark: true, action: async (p) => { await p.locator('button[title*="theme"], [aria-label*="theme"]').first().click().catch(() => {}); } });
await shot('04-narrow-800', { width: 800, height: 800 });
await shot('05-narrow-500', { width: 500, height: 800 });
await shot('06-code-view', { action: async (p) => { await p.locator('[title*="Code"], [aria-label*="Code view"]').first().click().catch(() => {}); } });
await shot('07-search-open', { action: async (p) => { await p.locator('[title*="Search"]').first().click(); await p.locator('input[placeholder*="Search"], .search input, input[type="text"]').first().fill('name').catch(() => {}); } });
await shot('08-settings', { width: 600, height: 800, action: async (p) => { await p.locator('[title="Open settings"]').click(); } });
await shot('09-error-state', { doc: `{"broken": [1, 2,` });
await shot('10-integrity-findings', { doc: `{"id": 9007199254740993, "dup": 1, "dup": 2}` });

// Popup
const popupPage = await context.newPage();
await popupPage.setViewportSize({ width: 360, height: 480 });
await popupPage.goto(`chrome-extension://${host}/popup.html`);
await popupPage.waitForTimeout(400);
await popupPage.screenshot({ path: path.join(OUT_DIR, '11-popup.png') });
console.log('shot: 11-popup');

await context.close();
