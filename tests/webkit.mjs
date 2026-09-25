import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { webkit, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await webkit.launch({ headless: true });
const origin = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: '4174' }, windowsHide: true });
await new Promise((resolve, reject) => { origin.stdout.once('data', resolve); origin.once('error', reject); });
const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-TW', timezoneId: 'Asia/Taipei' });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept());
const click = name => page.getByRole('button', { name, exact: true }).click();
const toast = text => page.locator('#toast').filter({ hasText: text }).waitFor();
try {
  await page.goto('http://127.0.0.1:4174');
  await click('＋ 新增重訓動作'); await page.locator('.list-main[data-action=choose]').filter({ hasText: /^Chest Press/ }).click();
  const button = page.getByRole('button', { name: '✓ 完成這組', exact: true }); await button.waitFor();
  const box = await button.boundingBox(), navBox = await page.locator('.bottom-nav').boundingBox(); assert.ok(box.y + box.height < navBox.y, JSON.stringify({ box, navBox }));
  await page.getByRole('spinbutton', { name: '重量', exact: true }).fill('45'); await click('✓ 完成這組'); await toast('第 1 組完成');
  await click('✓ 完成這組'); await toast('第 2 組完成');
  await page.reload(); await page.getByText('今天已完成 · 2 組').waitFor();
  await page.screenshot({ path: fileURLToPath(new URL('../test-results/webkit-record.png', import.meta.url)), fullPage: false });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('[data-nav=today]').click(); await click('＋ 新增熱身項目'); await page.locator('.list-main[data-action=choose]').filter({ hasText: /^Band Pull Apart/ }).click();
  await page.getByRole('spinbutton', { name: '時間', exact: true }).fill('0'); await page.getByRole('spinbutton', { name: '次數', exact: true }).fill('15'); await page.getByRole('spinbutton', { name: '組數', exact: true }).fill('2'); await click('✓ 完成熱身'); await toast('已儲存');
  await click('＋ 新增有氧項目'); await page.locator('.list-main[data-action=choose]').filter({ hasText: /^Treadmill/ }).click(); await page.getByRole('spinbutton', { name: '時間', exact: true }).fill('10'); await click('速度 增加 0.5'); await click('✓ 完成有氧'); await toast('已儲存');
  await page.getByRole('heading', { name: '今天，好好練。' }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // WebKit setOffline currently rejects SW responses (Playwright #42775).
  // Stop this test's actual origin instead; no server is available to satisfy requests.
  await new Promise(resolve => { origin.once('exit', resolve); origin.kill(); });
  await assert.rejects(() => fetch('http://127.0.0.1:4174'));
  await page.reload(); await page.getByRole('heading', { name: '今天，好好練。' }).waitFor();
  await click('＋ 記錄下一組'); await click('✓ 完成這組'); await toast('第 3 組完成'); await page.reload(); await page.getByText('今天已完成 · 3 組').waitFor();
  // Exercise the same real fallback used when Safari denies clipboard permission.
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true }); });
  await page.locator('[data-nav=today]').click(); await click('複製給 ChatGPT ↗'); await page.getByRole('textbox', { name: 'ChatGPT 訓練紀錄' }).waitFor(); assert.ok((await page.locator('.text-output').inputValue()).includes('45 kg × 10')); await click('複製文字'); await toast('文字已選取');
  assert.deepEqual(errors, []);
  const report = { engine: 'WebKit ' + await browser.version(), emulation: 'iPhone 13', passed: ['startup', 'strength repeat/editable controls', 'complete button visible without scrolling', 'warm-up reps/sets', 'cardio', 'IndexedDB persistence', 'origin stopped: reload and record via service worker', 'clipboard denied fallback', 'mobile layout'], errors, realIPhone: false };
  await writeFile(new URL('../test-results/webkit-results.json', import.meta.url), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) { await page.screenshot({ path: fileURLToPath(new URL('../test-results/webkit-failure.png', import.meta.url)), fullPage: true }); console.error(error); process.exitCode = 1; }
finally { origin.kill(); await browser.close(); }
