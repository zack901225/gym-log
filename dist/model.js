export const TYPES = ['warmup', 'strength', 'cardio'];
export const CATEGORIES = ['Chest', 'Back', 'Shoulder', 'Legs', 'Biceps', 'Triceps', 'Core', 'Cardio', 'Warm-up', 'Other'];
export const uid = () => crypto.randomUUID();
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const toDisplay = (kg, unit) => round(kg * (unit === 'lb' ? 2.2046226218 : 1));
export const toKg = (weight, unit) => unit === 'lb' ? weight / 2.2046226218 : weight;
export const entriesKey = type => `${type}Entries`;
export function initialData() {
  const groups = [
    ['Chest', 'strength', ['Chest Press', 'Incline Chest Press', 'Pec Deck']],
    ['Back', 'strength', ['Lat Pulldown', 'Seated Row', 'Cable Row']],
    ['Shoulder', 'strength', ['Shoulder Press', 'Lateral Raise', 'Rear Delt Fly']],
    ['Legs', 'strength', ['Leg Press', 'Leg Extension', 'Leg Curl']],
    ['Biceps', 'strength', ['Biceps Curl']], ['Triceps', 'strength', ['Triceps Pushdown']],
    ['Warm-up', 'warmup', ['Treadmill Warm-up', 'Shoulder Mobility', 'Dynamic Stretching', 'Band Pull Apart']],
    ['Cardio', 'cardio', ['Treadmill', 'Walking', 'Running', 'Cycling']]
  ];
  return { schemaVersion: 1, revision: 0, settings: { unit: 'kg', theme: 'dark' }, categories: [...CATEGORIES], workouts: [], exercises: groups.flatMap(([category, type, names]) => names.map(name => ({ id: uid(), name, category, type, favorite: ['Chest Press', 'Lat Pulldown', 'Shoulder Press', 'Leg Press'].includes(name), weightIncrement: 2.5, createdAt: new Date().toISOString() }))) };
}
export function ensureWorkout(data, date) {
  let workout = data.workouts.find(w => w.date === date);
  if (!workout) { workout = { id: uid(), date, title: '', warmupEntries: [], strengthEntries: [], cardioEntries: [] }; data.workouts.push(workout); }
  return workout;
}
export function lastEntry(data, exerciseId, type, beforeDate) {
  for (const w of [...data.workouts].filter(w => w.date < beforeDate).sort((a, b) => b.date.localeCompare(a.date))) {
    const entry = [...w[entriesKey(type)]].reverse().find(e => e.exerciseId === exerciseId && (type === 'strength' ? e.sets.length : e.completed));
    if (entry) return { ...entry, date: w.date };
  }
  return null;
}
export function details(entry, type, unit = 'kg') {
  if (type === 'strength') return entry.sets.map(s => `${toDisplay(s.weight, unit)} ${unit} × ${s.reps}${s.rpe ? ` · RPE ${s.rpe}` : ''}`);
  const out = [];
  if (entry.speed) out.push(`${entry.speed} km/h`);
  if (type === 'cardio' || entry.speed || entry.incline) out.push(`坡度 ${entry.incline || 0}%`);
  if (entry.duration) out.push(`${entry.duration} min`);
  if (type === 'warmup') { if (entry.reps) out.push(`${entry.reps} reps`); if (entry.sets) out.push(`${entry.sets} sets`); }
  if (type === 'cardio' && entry.distance !== null && entry.distance > 0) out.push(`${entry.distance} km`);
  return out;
}
export function workoutText(workout, unit = 'kg') {
  if (!workout) return '';
  const sections = [['warmup', '熱身'], ['strength', '重訓'], ['cardio', '有氧']].map(([type, label]) => {
    const rows = workout[entriesKey(type)].filter(e => type === 'strength' ? e.sets.length : e.completed);
    return `【${label}】\n\n` + (rows.length ? rows.map(e => `${e.exerciseName}\n${details(e, type, unit).join('\n')}${e.note ? '\n備註：' + e.note : ''}`).join('\n\n') : '未記錄');
  });
  return `${workout.date.replaceAll('-', '/')} ${workout.title || '健身訓練'}\n\n${sections.join('\n\n')}`;
}
export function validateData(input) {
  const fail = message => { throw new Error(`備份格式錯誤：${message}`); };
  const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const str = (v, max = 200, allowEmpty = false) => typeof v === 'string' && v.length <= max && (allowEmpty || v.trim().length > 0);
  const num = (v, max, integer = false) => Number.isFinite(v) && v >= 0 && v <= max && (!integer || Number.isInteger(v));
  const ids = new Set();
  const id = v => { if (!str(v, 100) || ids.has(v)) fail('ID 無效或重複'); ids.add(v); };
  if (!obj(input) || input.schemaVersion !== 1) fail('不支援的資料版本');
  if (!obj(input.settings) || !['kg', 'lb'].includes(input.settings.unit) || !['dark', 'light', 'system'].includes(input.settings.theme)) fail('設定無效');
  if (!Array.isArray(input.categories) || input.categories.length > 500 || input.categories.some(c => !str(c, 60))) fail('分類無效');
  if (!Array.isArray(input.exercises) || input.exercises.length > 10000 || !Array.isArray(input.workouts) || input.workouts.length > 50000) fail('清單無效或過大');
  const data = { schemaVersion: 1, revision: Number.isSafeInteger(input.revision) && input.revision >= 0 ? input.revision : 0, settings: { unit: input.settings.unit, theme: input.settings.theme }, categories: [...new Set(input.categories)], exercises: [], workouts: [] };
  for (const e of input.exercises) {
    if (!obj(e)) fail('動作無效'); id(e.id);
    if (!str(e.name, 100) || !str(e.category, 60) || !TYPES.includes(e.type) || typeof e.favorite !== 'boolean' || !num(e.weightIncrement, 1000) || e.weightIncrement <= 0 || !str(e.createdAt, 50)) fail('動作欄位無效');
    data.exercises.push({ id: e.id, name: e.name, category: e.category, type: e.type, favorite: e.favorite, weightIncrement: e.weightIncrement, createdAt: e.createdAt });
    if (!data.categories.includes(e.category)) data.categories.push(e.category);
  }
  const dates = new Set();
  for (const w of input.workouts) {
    if (!obj(w)) fail('訓練無效'); id(w.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date) || !Number.isFinite(Date.parse(w.date)) || new Date(w.date).toISOString().slice(0, 10) !== w.date || dates.has(w.date) || !str(w.title, 100, true)) fail('訓練日期或標題無效');
    dates.add(w.date);
    const clean = { id: w.id, date: w.date, title: w.title };
    for (const type of TYPES) {
      const key = entriesKey(type);
      if (!Array.isArray(w[key]) || w[key].length > 1000) fail('訓練項目無效');
      clean[key] = w[key].map((e, order) => {
        if (!obj(e)) fail('訓練項目無效'); id(e.id);
        if (!str(e.exerciseId, 100) || !str(e.exerciseName, 100) || !str(e.note, 2000, true)) fail('項目名稱或備註無效');
        const row = { id: e.id, exerciseId: e.exerciseId, exerciseName: e.exerciseName, note: e.note, order };
        if (type === 'strength') {
          if (!Array.isArray(e.sets) || e.sets.length > 1000) fail('組數無效');
          row.sets = e.sets.map(s => {
            if (!obj(s)) fail('組數無效'); id(s.id);
            if (!num(s.weight, 10000) || !num(s.reps, 10000, true) || s.reps < 1 || !(s.rpe === null || (num(s.rpe, 10) && s.rpe >= 1)) || !str(s.timestamp, 50)) fail('重量、次數或 RPE 無效');
            return { id: s.id, weight: s.weight, reps: s.reps, rpe: s.rpe, timestamp: s.timestamp };
          });
        } else {
          if (!num(e.duration, 10000) || !num(e.speed, 200) || typeof e.completed !== 'boolean') fail('時間或速度無效');
          Object.assign(row, { duration: e.duration, speed: e.speed, completed: e.completed });
          if (type === 'warmup') {
            if (!num(e.reps, 10000, true) || !num(e.sets, 1000, true)) fail('熱身次數無效');
            // Version 1 backups and existing workouts may predate warm-up incline.
            const incline = e.incline === undefined ? 0 : e.incline;
            if (!num(incline, 100)) fail('熱身坡度無效');
            Object.assign(row, { reps: e.reps, sets: e.sets, incline });
          } else {
            if (!num(e.incline, 100) || !(e.distance === null || num(e.distance, 10000))) fail('坡度或距離無效');
            Object.assign(row, { incline: e.incline, distance: e.distance });
          }
        }
        return row;
      });
    }
    data.workouts.push(clean);
  }
  return data;
}
