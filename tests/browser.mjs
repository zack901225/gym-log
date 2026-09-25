import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'zh-TW', timezoneId: 'Asia/Taipei', permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
const page = await context.newPage(), errors = [], results = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
const check = (label, fn) => fn().then(() => { results.push(label); console.log('PASS', label); });
const click = (name, exact = true) => page.getByRole('button', { name, exact }).click();
const nav = id => page.locator(`[data-nav="${id}"]`).click();
const waitToast = text => page.locator('#toast').filter({ hasText: text }).waitFor();
const state = () => page.evaluate(async () => {
  const { readData } = await import('./storage.js'); return readData();
});
const out = new URL('../test-results/', import.meta.url);
await mkdir(out, { recursive: true });
try {
  await page.goto('http://127.0.0.1:4173');
  await check('app starts / mobile layout', async () => { await page.getByRole('heading', { name: '今天，好好練。' }).waitFor(); assert.equal(await page.locator('.section').count(), 3); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await page.screenshot({ path: fileURLToPath(new URL('today-empty.png', out)), fullPage: true }); });
  await check('custom exercise / category / favorite', async () => {
    await nav('exercises'); await click('＋ 新增自訂動作');
    await page.getByLabel('動作名稱', { exact: true }).fill('Cable Fly'); await page.getByLabel('分類（可輸入新分類）').fill('Cable'); await page.locator('[name="increment"]').fill('1.25'); await page.getByLabel('設為常用動作', { exact: true }).check(); await click('新增動作'); await waitToast('動作已新增');
    let d = await state(); assert.ok(d.exercises.some(e => e.name === 'Cable Fly' && e.favorite && e.weightIncrement === 1.25)); assert.ok(d.categories.includes('Cable'));
    await click('取消常用 Cable Fly'); await click('設為常用 Cable Fly');
  });
  await check('edit custom exercise', async () => { await click('編輯 Cable Fly'); await page.getByLabel('動作名稱', { exact: true }).fill('Cable Fly Custom'); await click('儲存變更'); await waitToast('動作已更新'); assert.ok((await state()).exercises.some(e => e.name === 'Cable Fly Custom')); });
  await check('warm-up fields and save', async () => { await nav('today'); await click('＋ 新增熱身項目'); await page.getByRole('button', { name: /^Treadmill Warm-up/ }).click(); await page.getByRole('spinbutton', { name: '速度', exact: true }).fill('6'); await click('坡度 增加 1'); await click('坡度 增加 1'); await click('坡度 減少 1'); await page.getByRole('spinbutton', { name: '坡度', exact: true }).fill('3.5'); await click('✓ 完成熱身'); await page.getByRole('heading', { name: '今天，好好練。' }).waitFor(); const e = (await state()).workouts[0].warmupEntries[0]; assert.equal(e.speed, 6); assert.equal(e.duration, 5); assert.equal(e.incline, 3.5); assert.ok(e.completed); });
  await check('strength quick controls / repeated sets / RPE', async () => {
    await click('＋ 新增重訓動作'); await page.locator('.list-main[data-action=choose]').filter({ hasText: /^Chest Press/ }).click();
    await page.getByRole('spinbutton', { name: '重量', exact: true }).fill('40'); await click('重量 增加 5'); await click('9'); await page.locator('summary').click(); await page.getByLabel('備註（選填）', { exact: true }).fill('椅子高度 4');
    await click('✓ 完成這組'); await waitToast('第 1 組完成'); await click('✓ 完成這組'); await waitToast('第 2 組完成'); await click('次數 減少 1'); await click('✓ 完成這組'); await waitToast('第 3 組完成');
    const e = (await state()).workouts[0].strengthEntries[0]; assert.deepEqual(e.sets.map(s => s.reps), [10, 10, 9]); assert.ok(e.sets.every(s => s.weight === 45 && s.rpe === 9)); await page.screenshot({ path: fileURLToPath(new URL('record.png', out)), fullPage: true });
  });
  await check('edit and delete set', async () => { await click('編輯第 2 組'); await page.getByRole('spinbutton', { name: '次數', exact: true }).fill('11'); await click('儲存這組變更'); await waitToast('這組已更新'); assert.equal((await state()).workouts[0].strengthEntries[0].sets[1].reps, 11); await click('刪除第 2 組'); await page.locator('.set-row').nth(2).waitFor({ state: 'detached' }); assert.equal((await state()).workouts[0].strengthEntries[0].sets.length, 2); });
  await check('cardio fields and save', async () => { await nav('today'); await click('＋ 新增有氧項目'); await page.locator('.list-main[data-action=choose]').filter({ hasText: /^Treadmill/ }).click(); await page.getByRole('spinbutton', { name: '速度', exact: true }).fill('8'); await click('坡度 增加 1'); await page.getByRole('spinbutton', { name: '時間', exact: true }).fill('10'); await page.getByLabel('距離 km（選填）').fill('1.3'); await click('✓ 完成有氧'); await waitToast('已儲存'); await page.getByRole('heading', { name: '今天，好好練。' }).waitFor(); const e = (await state()).workouts[0].cardioEntries[0]; assert.equal(e.speed, 8); assert.equal(e.incline, 1); assert.equal(e.distance, 1.3); });
  await check('reorder exercises', async () => { await click('＋ 新增重訓動作'); await page.locator('.list-main[data-action=choose]').filter({ hasText: /^Cable Fly Custom/ }).click(); await click('✓ 完成這組'); await waitToast('第 1 組完成'); await nav('today'); await click('Cable Fly Custom 上移'); assert.equal((await state()).workouts[0].strengthEntries[0].exerciseName, 'Cable Fly Custom'); });
  await check('refresh persistence and copy actual clipboard', async () => { await page.reload(); await page.getByRole('heading', { name: '今天，好好練。' }).waitFor(); await click('複製給 ChatGPT ↗'); await waitToast('已複製，可以貼到 ChatGPT'); const text = await page.evaluate(() => navigator.clipboard.readText()); for (const s of ['【熱身】', '【重訓】', '【有氧】', '45 kg × 9', 'RPE 9', '坡度 1%', '坡度 3.5%', '椅子高度 4']) assert.ok(text.includes(s), s); await page.screenshot({ path: fileURLToPath(new URL('today-recorded.png', out)), fullPage: true }); });
  await check('history and exercise history', async () => { await nav('history'); await page.locator('[data-action="history"]').first().click(); await page.getByText(/坡度 3\.5%/).first().waitFor(); await page.locator('.entry-link[data-action=exercise-history]').filter({ hasText: /^Chest Press/ }).click(); await page.getByText('最近 10 次訓練').waitFor(); assert.ok((await page.locator('#app').innerText()).includes('45 kg × 9')); });
  let backup;
  await check('JSON export actual download', async () => { await nav('settings'); const download = page.waitForEvent('download'); await click('↓ 匯出 JSON 備份'); backup = JSON.parse(await readFile(await (await download).path(), 'utf8')); assert.equal(backup.schemaVersion, 1); assert.equal(backup.workouts[0].warmupEntries[0].incline, 3.5); assert.equal(backup.workouts[0].strengthEntries.length, 2); });
  await check('JSON import and automatic previous values', async () => {
    const prior = structuredClone(backup), dt = new Date(); dt.setDate(dt.getDate() - 2); const prevDate = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    prior.workouts[0].date = prevDate;
    await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(prior)) }); await waitToast('備份已匯入');
    await nav('today'); await click('＋ 新增熱身項目'); await page.getByRole('button', { name: /^Treadmill Warm-up/ }).click(); assert.equal(await page.getByRole('spinbutton', { name: '坡度', exact: true }).inputValue(), '3.5'); await click('✓ 完成熱身'); await waitToast('已儲存');
    await nav('today'); await click('＋ 新增重訓動作'); await page.locator('.list-main[data-action=choose]').filter({ hasText: /^Chest Press/ }).click(); assert.equal(await page.getByRole('spinbutton', { name: '重量', exact: true }).inputValue(), '45'); assert.equal(await page.getByRole('spinbutton', { name: '次數', exact: true }).inputValue(), '10'); assert.ok((await page.locator('.previous').innerText()).includes('45 kg · 10 / 9 reps')); await click('✓ 完成這組'); await waitToast('第 1 組完成');
  });
  await check('invalid import leaves data intact', async () => { await nav('settings'); const before = await state(); await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":1}') }); await waitToast('備份格式錯誤'); assert.deepEqual(await state(), before); });
  await check('units / theme', async () => { await page.getByLabel('重量單位').selectOption('lb'); await page.getByLabel('顯示主題').selectOption('light'); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light'); await nav('today'); await page.getByText('99.21 lb × 10 · RPE 9', { exact: true }).waitFor(); await nav('settings'); await page.getByLabel('重量單位').selectOption('kg'); await page.getByLabel('顯示主題').selectOption('dark'); });
  await check('delete custom exercise preserves history', async () => { await nav('exercises'); await click('編輯 Cable Fly Custom'); await click('刪除這個動作'); await waitToast('已刪除動作'); const d = await state(); assert.ok(!d.exercises.some(e => e.name === 'Cable Fly Custom')); assert.ok(d.workouts.some(w => w.strengthEntries.some(e => e.exerciseName === 'Cable Fly Custom'))); });
  await check('manifest / icon / service worker app shell', async () => {
    const manifest = await (await context.request.get('http://127.0.0.1:4173/manifest.json')).json(); assert.equal(manifest.display, 'standalone'); assert.equal(manifest.start_url, './'); for (const i of manifest.icons) assert.equal((await context.request.get('http://127.0.0.1:4173/' + i.src.slice(2))).status(), 200);
    await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller); assert.ok(await page.evaluate(async () => !!(await caches.match(new URL('./app.js', location.href)))));
  });
  await check('offline reload and write / reload', async () => {
    await context.setOffline(true); await nav('today'); await page.reload(); await page.getByRole('heading', { name: '今天，好好練。' }).waitFor(); await click('＋ 記錄下一組'); await click('✓ 完成這組'); await waitToast('第 2 組完成'); await page.reload(); await page.getByText('今天已完成 · 2 組').waitFor(); await context.setOffline(false);
  });
  await check('320px / 390px responsive no horizontal overflow', async () => { for (const width of [320, 390]) { await page.setViewportSize({ width, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await nav('today'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); } });
  await check('clear all and restore backup', async () => { await nav('settings'); await click('清除所有資料'); await waitToast('所有資料已清除'); assert.equal((await state()).workouts.length, 0); assert.equal((await state()).exercises.length, 0); await page.locator('#import-file').setInputFiles({ name: 'restore.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) }); await waitToast('備份已匯入'); assert.equal((await state()).workouts.length, 1); });
  assert.deepEqual(errors, []); console.log('PASS no console or runtime errors');
  await writeFile(new URL('browser-results.json', out), JSON.stringify({ passed: results, errors, testedAt: new Date().toISOString(), browser: await browser.version() }, null, 2));
} catch (error) { await page.screenshot({ path: fileURLToPath(new URL('failure.png', out)), fullPage: true }); console.error('FAILED at', page.url(), error); console.error('Console errors:', errors); process.exitCode = 1; }
finally { await browser.close(); }
