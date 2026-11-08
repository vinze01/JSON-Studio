/**
 * Minimal end-to-end smoke tests for the JSON Studio workspace.
 *
 * Loads the real built extension (.output/chrome-mv3) into a persistent
 * Chromium profile and exercises the workspace page as a user would.
 *
 * Prerequisite: `npm run build` before running, plus an installed Chromium
 * (`npx playwright install chromium`).
 */
import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BUILD_DIR = path.resolve(import.meta.dirname, '../../.output/chrome-mv3');
const SAMPLE_JSON = `{"name":"json-studio","version":1,"items":[1,2,3],"nested":{"ok":true}}`;

test.describe('workspace', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    if (!existsSync(BUILD_DIR)) {
      throw new Error('Extension not built — run `npm run build` first.');
    }
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${BUILD_DIR}`,
        `--load-extension=${BUILD_DIR}`,
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  /** Resolves the unpacked extension's host id from its registered service worker. */
  async function extensionHost(): Promise<string | null> {
    const poll = async (attempts: number): Promise<string | null> => {
      const worker = context
        .serviceWorkers()
        .find((w) => w.url().startsWith('chrome-extension://'));
      if (worker) return worker.url().split('/')[2] ?? null;
      if (attempts <= 0) return null;
      await new Promise((resolve) => setTimeout(resolve, 250));
      return poll(attempts - 1);
    };
    return poll(60);
  }

  test('loads the workspace and renders a valid document', async () => {
    const host = await extensionHost();
    test.skip(
      host === null,
      'No extension service worker registered in headless Chromium.',
    );
    const page = await context.newPage();
    await page.goto(`chrome-extension://${host}/workspace.html`);

    // Paste a document and let the store process it (debounced).
    const editor = page.locator('textarea').first();
    await editor.fill(SAMPLE_JSON);
    await page.waitForTimeout(1500);

    // The tree should render the top-level keys.
    const tree = page.getByTestId('tree-viewport');
    await expect(tree.getByText('name')).toBeVisible();
    await expect(tree.getByText('json-studio')).toBeVisible();

    // The integrity report should be present and report no risks.
    await expect(page.getByTestId('integrity-report')).toBeVisible();
    await expect(page.getByTestId('integrity-report')).toContainText(
      'No structural risks found',
    );
  });

  test('integrity report flags duplicate keys with pointers', async () => {
    const host = await extensionHost();
    test.skip(
      host === null,
      'No extension service worker registered in headless Chromium.',
    );
    const page = await context.newPage();
    await page.goto(`chrome-extension://${host}/workspace.html`);

    const editor = page.locator('textarea').first();
    await editor.fill(`{"id":1,"id":2}`);
    await page.waitForTimeout(1500);

    await expect(page.getByTestId('integrity-report')).toBeVisible();
    await expect(page.getByTestId('integrity-report')).toContainText('1 duplicate key');
  });

  test('validate highlights the offending key in an invalid document', async () => {
    const host = await extensionHost();
    test.skip(
      host === null,
      'No extension service worker registered in headless Chromium.',
    );
    const page = await context.newPage();
    await page.goto(`chrome-extension://${host}/workspace.html`);

    const editor = page.locator('textarea').first();
    await editor.fill(`{"name": "A", "language" "Galician"}`);
    await page.waitForTimeout(1500);

    // The failure banner names the missing colon...
    const banner = page.locator('main').first().locator('div.bg-danger-soft');
    await expect(banner).toContainText("Expected ':'");

    // ...and clicking Validate marks the failing slice in the editor.
    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByTestId('error-highlight')).toBeVisible();
    await expect(page.getByTestId('error-highlight')).toContainText(
      '"language"',
    );
  });

  test('lossless format preserves a 19-digit number exactly', async () => {
    const host = await extensionHost();
    test.skip(
      host === null,
      'No extension service worker registered in headless Chromium.',
    );
    const page = await context.newPage();
    await page.goto(`chrome-extension://${host}/workspace.html`);

    const editor = page.locator('textarea').first();
    await editor.fill(`{"snowflakeId": 1234567890123456789}`);
    await page.waitForTimeout(1500);

    // Format via the toolbar; the lossless reprinter must keep every digit.
    await page.locator('[title="Format the JSON in the editor"]').click();
    await expect(page.locator('textarea').first()).toHaveValue(
      '{\n  "snowflakeId": 1234567890123456789\n}',
      { timeout: 10_000 },
    );
  });

  test('virtualized tree renders correct row slice for a 1000-item document', async () => {
    const host = await extensionHost();
    test.skip(
      host === null,
      'No extension service worker registered in headless Chromium.',
    );
    const page = await context.newPage();
    await page.goto(`chrome-extension://${host}/workspace.html`);

    const items = Array.from({ length: 1000 }, (_, i) => ({ i, v: `row-${i}` }));
    const editor = page.locator('textarea').first();
    await editor.fill(JSON.stringify({ rows: items, trailer: 'END' }));
    await page.waitForTimeout(1500);

    const tree = page.getByTestId('tree-viewport');

    // Expand the big container so the document exceeds the 1000-node
    // render-all threshold and slicing engages.
    await tree.getByRole('treeitem', { name: /^rows:/ }).first().click();
    await page.waitForTimeout(400);

    // Every rendered row must be exactly the 22px virtualization pitch -
    // a mismatch corrupts the slice window (the "missing keys" bug).
    const geometry = await page.evaluate(() => {
      const heights = Array.from(document.querySelectorAll('[role="treeitem"]')).map(
        (row) => row.getBoundingClientRect().height,
      );
      return {
        rendered: heights.length,
        min: Math.min(...heights),
        max: Math.max(...heights),
      };
    });
    expect(geometry.rendered).toBeGreaterThan(30);
    expect(geometry.min).toBe(22);
    expect(geometry.max).toBe(22);

    // Jump to the bottom: the final row must be reachable and rendered.
    await page.evaluate(() => {
      const viewport = document.querySelector('[data-testid="tree-viewport"]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    });
    await page.waitForTimeout(400);
    await expect(tree.getByText('trailer')).toBeVisible();
  });

  test('expand-all reveals array items and Format preserves tree expansion', async () => {
    const host = await extensionHost();
    test.skip(
      host === null,
      'No extension service worker registered in headless Chromium.',
    );
    const page = await context.newPage();
    await page.goto(`chrome-extension://${host}/workspace.html`);

    const users = JSON.stringify([
      { id: 1, first_name: 'Jeanette', email: 'jpenddreth0@census.gov' },
      { id: 2, first_name: 'Giavani', email: 'gfrediani1@senate.gov' },
      { id: 3, first_name: 'Noell', email: 'nbea2@imageshack.us' },
      { id: 4, first_name: 'Willard', email: 'wvalek3@vk.com' },
    ]);
    const editor = page.locator('textarea').first();
    await editor.fill(users);
    await page.waitForTimeout(1500);

    const tree = page.getByTestId('tree-viewport');
    // Collapsed: root + the 4 array objects.
    expect(await tree.locator('[role="treeitem"]').count()).toBe(5);

    // One expand-all click reveals every nested key (4 objects x 3 keys
    // + the root row).
    await page.locator('[data-testid="expand-all"]').click();
    await page.waitForTimeout(400);
    expect(await tree.locator('[role="treeitem"]').count()).toBe(17);

    // Format must not collapse the tree back to the root row.
    await page.locator('[title="Format the JSON in the editor"]').click();
    await page.waitForTimeout(800);
    expect(await tree.locator('[role="treeitem"]').count()).toBe(17);

    // And collapse-all returns to the root-only row.
    await page.locator('[data-testid="collapse-all"]').click();
    await page.waitForTimeout(300);
    expect(await tree.locator('[role="treeitem"]').count()).toBe(1);
  });
});
