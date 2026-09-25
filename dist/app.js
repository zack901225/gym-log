import { TYPES, initialData, uid, dayKey, round, toDisplay, toKg, entriesKey, ensureWorkout, lastEntry, details, workoutText, validateData } from './model.js';
import { openDB, readData, writeData } from './storage.js';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = { warmup: '熱身', strength: '重訓', cardio: '有氧' };
const english = { warmup: 'Warm-up', strength: 'Strength', cardio: 'Cardio' };
let data, busy = false, filter = '全部', toastTimer, editSetId = null, recordDraft = null, activeDay = dayKey(), channel, swReady = false;
const unit = () => data.settings.unit;
const route = () => location.hash.slice(1).split('/').map(decodeURIComponent);
const go = (...parts) => { location.hash = parts.map(encodeURIComponent).join('/'); };
const workout = date => data.workouts.find(w => w.date === date);
const getEntry = (date, type, id, state = data) => state.workouts.find(w => w.date === date)?.[entriesKey(type)]?.find(e => e.id === id);
const exercise = id => data.exercises.find(e => e.id === id);
const back = (dest = 'today', label = '返回') => `<button class="back" data-action="go" data-dest="${esc(dest)}">← ${label}</button>`;
const heading = (title, subtitle = '', eyebrow = '') => `<div class="page-heading">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1>${esc(title)}</h1>${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ''}</div>`;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500); }
function applyTheme() {
  const theme = data.settings.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : data.settings.theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#141716' : '#f6f7f2';
}
async function mutate(change, { rerender = true } = {}) {
  if (busy) return false;
  busy = true;
  try {
    const next = structuredClone(data);
    change(next); next.revision = data.revision + 1;
    const validated = validateData(next);
    await writeData(validated, data.revision); data = validated; channel?.postMessage(data.revision); applyTheme();
    if (rerender) render(); return true;
  } catch (error) {
    try { data = validateData(await readData()); } catch {}
    toast(error.message || '儲存失敗，這次變更未寫入。'); render(); return false;
  } finally { busy = false; }
}
function entryCard(e, type, date, index, total, readonly) {
  const summary = details(e, type, unit());
  return `<article class="card"><div class="entry-top"><button class="entry-link" data-action="${readonly ? 'exercise-history' : 'record'}" data-id="${esc(readonly ? e.exerciseId : e.id)}" data-type="${type}" data-date="${date}">${esc(e.exerciseName)}<small>${type === 'strength' ? e.sets.length + ' 組已完成' : e.completed ? '已完成' : '尚未記錄'}</small></button>${readonly ? '' : `<div class="entry-controls"><button class="icon-btn" aria-label="${esc(e.exerciseName)} 上移" data-action="move" data-dir="-1" data-id="${esc(e.id)}" data-type="${type}" ${index === 0 ? 'disabled' : ''}>↑</button><button class="icon-btn" aria-label="${esc(e.exerciseName)} 下移" data-action="move" data-dir="1" data-id="${esc(e.id)}" data-type="${type}" ${index === total - 1 ? 'disabled' : ''}>↓</button></div>`}</div>${type === 'strength' ? `<div class="sets-preview">${summary.map(s => `<span class="set-chip">${esc(s)}</span>`).join('')}</div>` : e.completed ? `<p class="metric-summary">${esc(summary.join(' · '))}</p>` : ''}${e.note ? `<p class="note">${esc(e.note)}</p>` : ''}${readonly ? '' : `<button class="card-action" data-action="record" data-id="${esc(e.id)}" data-type="${type}" data-date="${date}">${type === 'strength' ? '＋ 記錄下一組' : e.completed ? '編輯紀錄' : '開始記錄'}</button>`}</article>`;
}
function sections(w, readonly = false) {
  return TYPES.map((type, i) => {
    const entries = w?.[entriesKey(type)] || [];
    return `<section class="section ${type}"><div class="section-title"><span class="section-number">0${i + 1}</span><h2>${labels[type]}<small>${english[type]}</small></h2><span class="count">${entries.length} 個動作</span></div>${entries.length ? entries.map((e, index) => entryCard(e, type, w.date, index, entries.length, readonly)).join('') : `<div class="empty compact">${readonly ? '未記錄' : type === 'strength' ? '從常用動作開始，記下今天的第一組。' : '準備好時，加入你的' + labels[type] + '項目。'}</div>`}${readonly ? '' : `<button class="add-button" data-action="pick" data-type="${type}">＋ 新增${labels[type]}${type === 'strength' ? '動作' : '項目'}</button>`}</section>`;
  }).join('');
}
function copyButton(date) { return `<div class="copy-block"><button class="primary wide" data-action="copy" data-date="${date}">複製給 ChatGPT ↗</button><p class="footnote">紀錄保存在這台裝置 · 離線也能好好練</p></div>`; }
function todayPage() {
  const date = dayKey(), w = workout(date);
  return `<div class="page-heading"><p class="eyebrow">SHOW UP. ONE SET AT A TIME.</p><div class="heading-row"><h1>今天，好好練。</h1><span class="date">${date.slice(5).replace('-', ' / ')}</span></div><p class="subtitle">少一點打字，多專注一組。</p><label class="session-label"><span class="badge">${new Date().toLocaleDateString('zh-TW', { weekday: 'short' })}</span><input id="workout-title" maxlength="100" aria-label="今天訓練名稱" placeholder="今天練什麼？（選填）" value="${esc(w?.title || '')}"></label></div>${sections(w)}${copyButton(date)}`;
}
function historyPage(date) {
  if (date) { const w = workout(date); return w ? back('history', '歷史紀錄') + heading(date.replaceAll('-', ' / '), w.title || '健身訓練', 'WORKOUT HISTORY') + sections(w, true) + copyButton(date) : back('history') + heading('找不到這天的紀錄'); }
  const rows = [...data.workouts].filter(w => TYPES.some(t => w[entriesKey(t)].length)).sort((a, b) => b.date.localeCompare(a.date));
  return heading('每次都有累積。', '按日期回顧你的訓練。', 'HISTORY') + (rows.length ? rows.map(w => `<button class="card wide list-main" data-action="history" data-date="${w.date}"><div class="heading-row"><span class="history-date">${w.date.replaceAll('-', ' / ')}</span><span>↗</span></div><small>${esc(w.title || '健身訓練')} · ${w.strengthEntries.reduce((n, e) => n + e.sets.length, 0)} 組重訓 · ${TYPES.reduce((n, t) => n + w[entriesKey(t)].length, 0)} 個動作</small></button>`).join('') : `<div class="empty"><strong>第一筆紀錄，從今天開始。</strong>完成的訓練會依日期保存在這裡。</div>`);
}
function exerciseHistoryPage(id) {
  const rows = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date)).flatMap(w => TYPES.flatMap(type => w[entriesKey(type)].filter(e => e.exerciseId === id && (type === 'strength' ? e.sets.length : e.completed)).map(e => ({ w, type, e }))));
  return back('exercises', '動作庫') + heading(exercise(id)?.name || rows[0]?.e.exerciseName || '動作歷史', '最近 10 次訓練', 'EXERCISE HISTORY') + (rows.length ? rows.slice(0, 10).map(({ w, type, e }) => `<div class="card"><div class="heading-row"><h3>${w.date.replaceAll('-', ' / ')}</h3><button class="icon-btn" aria-label="查看當日紀錄" data-action="history" data-date="${w.date}">↗</button></div><p class="note">${esc(details(e, type, unit()).join('\n'))}</p>${e.note ? `<p class="note">備註：${esc(e.note)}</p>` : ''}</div>`).join('') : `<div class="empty">還沒有完成的紀錄，下次訓練從這裡開始。</div>`);
}
function exerciseListPage(pickType) {
  let items = data.exercises.filter(e => !pickType || e.type === pickType);
  const cats = ['全部', ...data.categories.filter(c => items.some(e => e.category === c))];
  if (!cats.includes(filter)) filter = '全部';
  items = items.filter(e => filter === '全部' || e.category === filter);
  const itemRow = e => `<div class="list-row"><button class="icon-btn ${e.favorite ? 'favorite' : ''}" aria-label="${e.favorite ? '取消常用' : '設為常用'} ${esc(e.name)}" aria-pressed="${e.favorite}" data-action="favorite" data-id="${esc(e.id)}">${e.favorite ? '★' : '☆'}</button><button class="list-main" data-action="${pickType ? 'choose' : 'exercise-history'}" data-id="${esc(e.id)}">${esc(e.name)}<small>${esc(e.category)} · ${labels[e.type]}${e.type === 'strength' ? ` · ±${toDisplay(e.weightIncrement, unit())} ${unit()}` : ''}</small></button><button class="icon-btn" aria-label="${pickType ? '加入' : '編輯'} ${esc(e.name)}" data-action="${pickType ? 'choose' : 'edit-exercise'}" data-id="${esc(e.id)}">${pickType ? '＋' : '✎'}</button></div>`;
  return (pickType ? back('today', '今天訓練') : '') + heading(pickType ? `加入${labels[pickType]}動作` : '你的動作庫。', pickType ? '常用優先，點一下就開始。' : '保留常用，也能加入你自己的動作。', pickType ? english[pickType] : 'EXERCISES') + `<div class="chips" aria-label="動作分類">${cats.map(c => `<button class="chip ${c === filter ? 'selected' : ''}" data-action="filter" data-category="${esc(c)}">${esc(c)}</button>`).join('')}</div>` + (items.some(e => e.favorite) ? `<h2 class="block-title">★ 常用動作</h2>${items.filter(e => e.favorite).map(itemRow).join('')}` : '') + (items.some(e => !e.favorite) ? `<h2 class="block-title">其他動作</h2>${items.filter(e => !e.favorite).map(itemRow).join('')}` : '') + (!items.length ? `<div class="empty">這裡還沒有動作，新增一個吧。</div>` : '') + `<div class="toolbar"><button class="primary wide" data-action="new-exercise" data-type="${pickType || 'strength'}">＋ 新增自訂動作</button></div>`;
}
function exerciseFormPage(id, type = 'strength', returnType = '') {
  const e = id === 'new' ? null : exercise(id);
  if (id !== 'new' && !e) return back('exercises') + heading('找不到這個動作');
  return back(returnType ? `pick/${returnType}` : 'exercises', '動作清單') + heading(e ? '編輯動作' : '新增你的動作', '名稱只需輸入一次，以後點選就能記錄。') + `<form id="exercise-form" data-id="${esc(e?.id || '')}" data-return="${esc(returnType)}"><label class="field">動作名稱<input name="name" maxlength="100" required value="${esc(e?.name || '')}" placeholder="例如 Cable Fly"></label><label class="field">分類（可輸入新分類）<input name="category" list="categories" maxlength="60" required value="${esc(e?.category || (type === 'warmup' ? 'Warm-up' : type === 'cardio' ? 'Cardio' : 'Other'))}"><datalist id="categories">${data.categories.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label><label class="field">紀錄類型<select name="type">${TYPES.map(t => `<option value="${t}" ${(e?.type || type) === t ? 'selected' : ''}>${labels[t]} · ${english[t]}</option>`).join('')}</select></label><label class="field">常用重量增減幅度（${unit()}）<input name="increment" type="number" inputmode="decimal" min="0.01" max="${toDisplay(1000, unit())}" step="0.01" required value="${toDisplay(e?.weightIncrement || 2.5, unit())}"></label><label class="field-inline"><input name="favorite" type="checkbox" ${e?.favorite ? 'checked' : ''}>設為常用動作</label><button class="primary wide" type="submit">${e ? '儲存變更' : '新增動作'}</button></form>${e ? `<hr class="divider"><button class="danger wide" data-action="delete-exercise" data-id="${esc(e.id)}">刪除這個動作</button><p class="footnote">歷史訓練紀錄會保留。</p>` : ''}`;
}
function counter(name, label, value, step, max, suffix, simple = false, min = 0, integer = false) {
  const changes = simple ? [-step, step] : name === 'reps' ? [-5, -1, 1, 5] : [-step * 2, -step, step, step * 2];
  const btn = n => `<button type="button" data-action="step" data-field="${name}" data-step="${round(n)}" aria-label="${label} ${n > 0 ? '增加' : '減少'} ${round(Math.abs(n))}">${n > 0 ? '+' : '−'}${round(Math.abs(n))}</button>`;
  const middle = `<div class="number"><input name="${name}" aria-label="${label}" type="number" inputmode="${integer ? 'numeric' : 'decimal'}" min="${min}" max="${max}" step="${integer ? 1 : '0.01'}" required value="${round(value)}"><small>${suffix}</small></div>`;
  return `<div class="counter"><div class="counter-label"><span>${label}</span><span>點數字可輸入</span></div><div class="stepper ${simple ? 'simple' : ''}">${changes.slice(0, simple ? 1 : 2).map(btn).join('')}${middle}${changes.slice(simple ? 1 : 2).map(btn).join('')}</div></div>`;
}
function previousSummary(entry, type) {
  if (type === 'strength' && entry.sets.length && entry.sets.every(s => s.weight === entry.sets[0].weight)) {
    return `${toDisplay(entry.sets[0].weight, unit())} ${unit()} · ${entry.sets.map(s => s.reps).join(' / ')} reps`;
  }
  return details(entry, type, unit()).join(' / ');
}
function recordPage(date, type, id) {
  const e = getEntry(date, type, id);
  if (!e || !TYPES.includes(type)) return back() + heading('找不到這筆紀錄');
  const x = exercise(e.exerciseId), last = lastEntry(data, e.exerciseId, type, date);
  const editing = type === 'strength' && editSetId ? e.sets.find(s => s.id === editSetId) : null;
  const seed = type === 'strength' ? editing || e.sets.at(-1) || last?.sets?.[0] || { weight: 0, reps: 10, rpe: null } : {};
  const draft = recordDraft?.id === id && !editing ? recordDraft : null;
  const weight = draft?.weight ?? toDisplay(seed.weight || 0, unit()), reps = draft?.reps ?? seed.reps, rpe = draft ? draft.rpe : seed.rpe;
  const current = e.completed ? e : last || e;
  const formData = `data-date="${date}" data-type="${type}" data-id="${esc(id)}"`;
  return back(date === dayKey() ? 'today' : `history/${date}`, '訓練紀錄') + `<p class="eyebrow">${english[type]} · ${date.replaceAll('-', ' / ')}</p>${heading(e.exerciseName)}<div class="previous"><small>上次訓練${last ? ' · ' + last.date.replaceAll('-', '/') : ''}</small><p>${last ? esc(previousSummary(last, type)) : '第一次記錄，從舒服的強度開始。'}</p>${last?.note ? `<p class="note">${esc(last.note)}</p>` : ''}</div><form id="record-form" ${formData}>${type === 'strength' ? `${editing ? `<div class="badge">正在編輯第 ${e.sets.indexOf(editing) + 1} 組</div>` : ''}${counter('weight', '重量', weight, toDisplay(x?.weightIncrement || 2.5, unit()), toDisplay(10000, unit()), unit())}${counter('reps', '次數', reps, 1, 10000, 'reps', false, 1, true)}<div class="counter-label"><span>RPE · 自覺用力程度（選填）</span></div><div class="rpe">${[7, 8, 9, 10].map(n => `<button type="button" aria-pressed="${rpe === n}" class="${rpe === n ? 'selected' : ''}" data-action="rpe" data-value="${n}">${n}</button>`).join('')}<input name="rpe" type="hidden" value="${rpe || ''}"></div>` : `${counter('speed', '速度', current.speed || 0, .5, 200, 'km/h', true)}${type === 'cardio' ? counter('incline', '坡度', current.incline || 0, 1, 100, '%', true) : ''}${counter('duration', '時間', current.duration || (e.completed ? 0 : 5), 1, 10000, 'min', true)}${type === 'warmup' ? counter('reps', '次數', current.reps || 0, 1, 10000, 'reps', true, 0, true) + counter('sets', '組數', current.sets || 0, 1, 1000, 'sets', true, 0, true) : `<label class="field">距離 km（選填）<input name="distance" type="number" inputmode="decimal" min="0" max="10000" step="0.01" value="${current.distance ?? ''}" placeholder="留白也可以"></label>`}`}<button class="primary wide record-button" type="submit">${type === 'strength' ? editing ? '儲存這組變更' : '✓ 完成這組' : `✓ ${e.completed ? '儲存' : '完成'}${labels[type]}`}</button><details class="notes"><summary>備註（選填）</summary><label class="field">備註（選填）<textarea name="note" maxlength="2000" placeholder="椅子高度、身體感受，或下次提醒">${esc(e.note)}</textarea></label><button type="button" class="wide" data-action="save-note">只儲存備註</button></details>${editing ? `<button type="button" class="wide" style="margin-top:10px" data-action="cancel-edit">取消編輯</button>` : ''}</form>${type === 'strength' ? `<h2 class="block-title">今天已完成 · ${e.sets.length} 組</h2>${e.sets.length ? e.sets.map((s, i) => `<div class="set-row"><span class="set-index">${String(i + 1).padStart(2, '0')}</span><div class="set-value">${toDisplay(s.weight, unit())} ${unit()} × ${s.reps}${s.rpe ? ` <small>RPE ${s.rpe}</small>` : ''}</div><button class="icon-btn" aria-label="編輯第 ${i + 1} 組" data-action="edit-set" data-id="${esc(s.id)}">✎</button><button class="icon-btn danger" aria-label="刪除第 ${i + 1} 組" data-action="delete-set" data-id="${esc(s.id)}">×</button></div>`).join('') : `<p class="notice">完成第一組後，下一組會保留相同數值。</p>`}` : ''}<div class="toolbar"><button class="wide" data-action="exercise-history" data-id="${esc(e.exerciseId)}">查看這個動作的歷史 ↗</button></div><button class="wide danger" data-action="delete-entry" ${formData}>移除此訓練項目</button>`;
}
function offlineLabel() { return swReady ? '✓ 離線資源已備妥' : isSecureContext ? '離線資源準備中；請保持連線直到完成。' : '需使用 HTTPS 或 localhost 才能啟用離線模式。'; }
function settingsPage() {
  return heading('照你的習慣。', '資料留在這台裝置，由你掌握。', 'SETTINGS') + `<section class="card"><div class="settings-row"><label for="units">重量單位</label><select id="units"><option ${unit() === 'kg' ? 'selected' : ''}>kg</option><option ${unit() === 'lb' ? 'selected' : ''}>lb</option></select></div><div class="settings-row"><label for="theme">顯示主題</label><select id="theme">${[['dark', '深色'], ['light', '淺色'], ['system', '跟隨系統']].map(([v, t]) => `<option value="${v}" ${data.settings.theme === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div><p class="notice">切換單位會換算重量；速度與距離維持 km/h、km。</p></section><h2 class="block-title">資料備份</h2><div class="card"><button class="wide" data-action="export">↓ 匯出 JSON 備份</button><button class="wide" data-action="import" style="margin-top:10px">↑ 匯入 JSON 備份</button><input type="file" accept=".json,application/json" id="import-file" hidden><p class="notice" style="margin-top:14px">匯入會取代目前資料，請先匯出備份。Safari 與主畫面 App 的儲存空間可能分開；建議固定從同一個入口使用。</p></div><h2 class="block-title">加入 iPhone 主畫面</h2><div class="card"><ol class="install-steps"><li>用 Safari 開啟部署後的 HTTPS 網址。</li><li>點分享按鈕 →「加入主畫面」。</li><li>從主畫面開啟，連線載入一次後即可離線使用。</li></ol><p id="offline-state" class="notice">${offlineLabel()}</p></div><p class="notice">紀錄保存在此瀏覽器的 IndexedDB。清除網站資料、移除 App 或裝置空間不足可能造成資料遺失，請定期匯出備份。</p><hr class="divider"><button class="wide danger" data-action="clear">清除所有資料</button><p class="footnote">好好練 · v1.0 · 無帳號，無雲端同步</p>`;
}
function render() {
  if (!data) return;
  let r; try { r = route(); } catch { r = ['today']; }
  const [page, a, b, c] = r, current = page || 'today'; let html;
  if (current === 'today') html = todayPage();
  else if (current === 'history') html = historyPage(a);
  else if (current === 'exercises') html = exerciseListPage();
  else if (current === 'pick' && TYPES.includes(a)) html = exerciseListPage(a);
  else if (current === 'exercise') html = exerciseFormPage(a, b, c);
  else if (current === 'exercise-history') html = exerciseHistoryPage(a);
  else if (current === 'record') html = recordPage(a, b, c);
  else if (current === 'settings') html = settingsPage();
  else if (current === 'copy') html = back(a === dayKey() ? 'today' : `history/${a}`) + heading('帶著紀錄，繼續聊。', '若無法自動複製，可長按下方文字全選複製。') + `<textarea class="text-output" readonly aria-label="ChatGPT 訓練紀錄">${esc(workoutText(workout(a), unit()))}</textarea><div class="toolbar"><button class="primary wide" data-action="copy-again" data-date="${esc(a)}">複製文字</button></div>`;
  else html = back() + heading('找不到這個頁面');
  $('#app').innerHTML = html;
  document.body.classList.toggle('recording', current === 'record');
  const nav = ['today', 'pick', 'record', 'copy'].includes(current) ? 'today' : ['exercise', 'exercise-history'].includes(current) ? 'exercises' : current;
  document.querySelectorAll('[data-nav]').forEach(a => { a.classList.toggle('active', a.dataset.nav === nav); if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
async function chooseExercise(id) {
  const x = exercise(id); if (!x) return;
  const date = dayKey(), key = entriesKey(x.type), existing = workout(date)?.[key].find(e => e.exerciseId === id);
  if (existing) { go('record', date, x.type, existing.id); return; }
  const entryId = uid();
  if (await mutate(next => {
    const e = { id: entryId, exerciseId: id, exerciseName: x.name, note: '', order: 0 };
    if (x.type === 'strength') e.sets = [];
    else { Object.assign(e, { duration: 0, speed: 0, completed: false }); if (x.type === 'warmup') Object.assign(e, { reps: 0, sets: 0 }); else Object.assign(e, { incline: 0, distance: null }); }
    const list = ensureWorkout(next, date)[key]; e.order = list.length; list.push(e);
  }, { rerender: false })) go('record', date, x.type, entryId);
}
async function copyText(date, fallback = true) {
  const w = workout(date);
  if (!w || !TYPES.some(t => w[entriesKey(t)].some(e => t === 'strength' ? e.sets.length : e.completed))) { toast('先完成一筆訓練，再複製紀錄。'); return; }
  try { await navigator.clipboard.writeText(workoutText(w, unit())); toast('已複製，可以貼到 ChatGPT'); }
  catch {
    if (fallback) { go('copy', date); toast('請在下方長按文字，全選後複製。'); }
    else { const area = $('.text-output'); area.focus(); area.select(); area.setSelectionRange(0, area.value.length); toast('文字已選取，請使用系統的複製功能。'); }
  }
}
function exportData() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), a = document.createElement('a');
  a.href = url; a.download = `好好練-${dayKey()}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('備份已產生，請保存 JSON 檔案。');
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled || !data) return;
  const { action, id, type, date, dest } = button.dataset;
  if (action === 'step') {
    const input = document.querySelector(`[name="${button.dataset.field}"]`);
    input.value = round(Math.max(Number(input.min), Math.min(Number(input.max), (Number(input.value) || 0) + Number(button.dataset.step)))); return;
  }
  if (action === 'rpe') { const input = $('[name="rpe"]'); input.value = input.value === button.dataset.value ? '' : button.dataset.value; document.querySelectorAll('[data-action="rpe"]').forEach(b => { b.classList.toggle('selected', b.dataset.value === input.value); b.setAttribute('aria-pressed', b.dataset.value === input.value); }); return; }
  if (action === 'go') { location.hash = dest; return; }
  if (action === 'pick') { filter = '全部'; go('pick', type); return; }
  if (action === 'filter') { filter = button.dataset.category; render(); return; }
  if (action === 'record') { go('record', date, type, id); return; }
  if (action === 'history') { go('history', date); return; }
  if (action === 'exercise-history') { go('exercise-history', id); return; }
  if (action === 'new-exercise') { const r = route(); go('exercise', 'new', type, r[0] === 'pick' ? r[1] : ''); return; }
  if (action === 'edit-exercise') { go('exercise', id); return; }
  if (action === 'choose') { await chooseExercise(id); return; }
  if (action === 'favorite') { await mutate(next => { const e = next.exercises.find(e => e.id === id); e.favorite = !e.favorite; }); return; }
  if (action === 'copy' || action === 'copy-again') { await copyText(date, action === 'copy'); return; }
  if (action === 'export') { exportData(); return; }
  if (action === 'import') { $('#import-file').click(); return; }
  if (action === 'delete-exercise') {
    if (!confirm('刪除這個動作？過去的訓練紀錄會保留。')) return;
    if (await mutate(next => { next.exercises = next.exercises.filter(e => e.id !== id); }, { rerender: false })) { go('exercises'); toast('已刪除動作，歷史紀錄已保留。'); } return;
  }
  if (action === 'clear') {
    if (!confirm('確定清除所有訓練、動作與設定？此操作無法復原，建議先匯出備份。')) return;
    if (await mutate(next => Object.assign(next, { ...initialData(), exercises: [] }))) toast('所有資料已清除，可在動作庫新增動作。'); return;
  }
  if (action === 'move') {
    await mutate(next => { const list = ensureWorkout(next, dayKey())[entriesKey(type)]; const i = list.findIndex(e => e.id === id), j = i + Number(button.dataset.dir); if (i < 0 || j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; list.forEach((e, n) => e.order = n); }); return;
  }
  if (action === 'edit-set') { editSetId = id; render(); window.scrollTo(0, 0); return; }
  if (action === 'cancel-edit') { editSetId = null; render(); return; }
  if (action === 'save-note') {
    const form = $('#record-form'), { date: dt, type: ty, id: entryId } = form.dataset, note = form.elements.note.value;
    if (await mutate(next => { getEntry(dt, ty, entryId, next).note = note; }, { rerender: false })) toast('備註已儲存'); return;
  }
  if (action === 'delete-set') {
    if (!confirm('刪除這一組紀錄？')) return;
    const [, dt, ty, entryId] = route(); editSetId = null;
    await mutate(next => { const e = getEntry(dt, ty, entryId, next); e.sets = e.sets.filter(s => s.id !== id); }); return;
  }
  if (action === 'delete-entry') {
    if (!confirm('移除此項目及其中的紀錄？')) return;
    if (await mutate(next => { const w = next.workouts.find(w => w.date === date); w[entriesKey(type)] = w[entriesKey(type)].filter(e => e.id !== id); }, { rerender: false })) go('today');
  }
});
document.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target; if (!form.reportValidity() || busy) return;
  const fd = new FormData(form);
  if (form.id === 'exercise-form') {
    const name = fd.get('name').trim(), category = fd.get('category').trim();
    if (!name || !category) { toast('請填寫動作名稱與分類。'); return; }
    const fields = { name, category, type: fd.get('type'), favorite: fd.has('favorite'), weightIncrement: toKg(Number(fd.get('increment')), unit()) };
    const id = form.dataset.id, returnType = form.dataset.return;
    if (await mutate(next => { if (id) Object.assign(next.exercises.find(e => e.id === id), fields); else next.exercises.push({ ...fields, id: uid(), createdAt: new Date().toISOString() }); if (!next.categories.includes(category)) next.categories.push(category); }, { rerender: false })) { filter = '全部'; go(...(returnType ? ['pick', returnType] : ['exercises'])); toast(id ? '動作已更新' : '動作已新增'); }
  }
  if (form.id === 'record-form') {
    const { date, type, id } = form.dataset, note = fd.get('note').trim(), editing = editSetId;
    const values = Object.fromEntries([...fd].filter(([k]) => k !== 'note').map(([k, v]) => [k, v === '' ? null : Number(v)]));
    if (type !== 'strength' && !values.duration && !values.reps && !values.sets && !values.distance && !note) { toast('請記錄時間、次數、組數、距離或備註。'); return; }
    if (type === 'strength') recordDraft = { id, weight: values.weight, reps: values.reps, rpe: values.rpe };
    form.querySelector('[type="submit"]').disabled = true;
    const ok = await mutate(next => {
      const e = getEntry(date, type, id, next); e.note = note;
      if (type === 'strength') {
        const set = { weight: toKg(values.weight, unit()), reps: values.reps, rpe: values.rpe };
        if (editing) Object.assign(e.sets.find(s => s.id === editing), set);
        else e.sets.push({ ...set, id: uid(), timestamp: new Date().toISOString() });
      } else Object.assign(e, values, { completed: true });
    }, { rerender: false });
    if (ok) { editSetId = null; render(); toast(type === 'strength' ? editing ? '這組已更新' : `第 ${getEntry(date, type, id).sets.length} 組完成 ✓` : '已儲存'); if (type !== 'strength') go('today'); }
  }
});
document.addEventListener('change', async event => {
  const input = event.target;
  if (input.id === 'units' || input.id === 'theme') {
    const key = input.id === 'units' ? 'unit' : 'theme', value = input.value; recordDraft = null;
    await mutate(next => { next.settings[key] = value; });
  }
  if (input.id === 'workout-title') { const value = input.value.trim(); await mutate(next => { ensureWorkout(next, dayKey()).title = value; }, { rerender: false }); }
  if (input.id === 'import-file' && input.files[0]) {
    try {
      const file = input.files[0]; if (file.size > 20 * 1024 * 1024) throw new Error('備份檔案超過 20 MB，請確認選擇正確檔案。');
      const incoming = validateData(JSON.parse(await file.text()));
      if (!confirm(`將匯入 ${incoming.workouts.length} 天訓練與 ${incoming.exercises.length} 個動作，並取代目前全部資料。是否繼續？`)) return;
      if (await mutate(next => Object.assign(next, incoming))) { recordDraft = null; toast('備份已匯入'); }
    } catch (error) { toast(error instanceof SyntaxError ? '無法讀取 JSON，原有資料未變更。' : error.message); }
    finally { input.value = ''; }
  }
});
window.addEventListener('hashchange', () => { editSetId = null; recordDraft = null; render(); window.scrollTo(0, 0); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => data && applyTheme());
function connectionStatus() { $('#connection').textContent = navigator.onLine ? '本機紀錄' : '離線模式'; }
window.addEventListener('online', connectionStatus); window.addEventListener('offline', connectionStatus);
async function syncOnResume() {
  if (document.hidden || !data || busy) return;
  try { const fresh = await readData(); if (fresh && fresh.revision !== data.revision) { data = validateData(fresh); applyTheme(); render(); } } catch {}
  if (dayKey() !== activeDay) { activeDay = dayKey(); if (!location.hash || location.hash === '#today') render(); }
}
document.addEventListener('visibilitychange', syncOnResume);
setInterval(() => { if (activeDay !== dayKey()) syncOnResume(); }, 30000);
async function start() {
  try {
    await openDB(); const saved = await readData(); data = saved ? validateData(saved) : initialData();
    if (!saved) { data.revision = 1; await writeData(data, 0); }
    if ('BroadcastChannel' in window) { channel = new BroadcastChannel('one-more-set-sync'); channel.onmessage = syncOnResume; }
    applyTheme(); connectionStatus(); render();
    if ('serviceWorker' in navigator && isSecureContext) {
      navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => { swReady = true; const status = $('#offline-state'); if (status) status.textContent = offlineLabel(); }).catch(() => toast('離線快取尚未完成，請連線重新開啟。'));
    }
    const context = document.modelContext;
    if (context?.registerTool) {
      try { await context.registerTool({ name: 'read_today_workout', title: '讀取今天訓練', description: '讀取目前裝置今天的已完成訓練，提供與複製給 ChatGPT 相同的純文字。', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: input => { if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('不接受參數'); return { date: dayKey(), text: workoutText(workout(dayKey()), unit()) }; } }); } catch {}
    }
  } catch (error) {
    $('#app').innerHTML = `<div class="error-box"><h2>無法開啟本機資料</h2><p>請允許瀏覽器使用網站儲存空間，再重新整理。既有資料未被覆寫。</p><p>${esc(error.message)}</p><button onclick="location.reload()">重新整理</button></div>`;
  }
}
start();
