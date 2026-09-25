import test from 'node:test';
import assert from 'node:assert/strict';
import { initialData, uid, dayKey, ensureWorkout, validateData, lastEntry, workoutText, toDisplay, toKg } from '../dist/model.js';
const fixture = () => {
  const data = initialData(), ex = data.exercises.find(e => e.name === 'Chest Press');
  const w = ensureWorkout(data, '2026-09-23');
  w.strengthEntries.push({ id: uid(), exerciseId: ex.id, exerciseName: ex.name, note: '椅子高度 4', order: 0, sets: [10, 10, 9].map(reps => ({ id: uid(), weight: 45, reps, rpe: 9, timestamp: new Date().toISOString() })) });
  return { data, ex, w };
};
test('seed data and complete backup round trip are valid', () => {
  const { data } = fixture(); assert.equal(data.exercises.length, 22); assert.deepEqual(validateData(JSON.parse(JSON.stringify(data))), data);
});
test('last workout excludes today and future; returns prior first set', () => {
  const { data, ex } = fixture(); ensureWorkout(data, '2026-09-25');
  assert.equal(lastEntry(data, ex.id, 'strength', '2026-09-25').sets[0].weight, 45);
  assert.equal(lastEntry(data, ex.id, 'strength', '2026-09-23'), null);
});
test('unit conversion does not reinterpret stored weight', () => {
  assert.equal(toDisplay(45, 'lb'), 99.21); assert.ok(Math.abs(toKg(99.21, 'lb') - 45) < .01);
});
test('text export includes sets, RPE, notes and all stages', () => {
  const { w } = fixture(), text = workoutText(w);
  for (const s of ['2026/09/23', '【熱身】', '【重訓】', '【有氧】', '45 kg × 9', 'RPE 9', '椅子高度 4']) assert.ok(text.includes(s));
});
test('deleted exercise does not invalidate historical snapshot', () => { const { data } = fixture(); data.exercises = []; assert.doesNotThrow(() => validateData(data)); });
test('invalid imports rejected before mutation', () => {
  const { data } = fixture();
  for (const mutate of [d => d.schemaVersion = 2, d => d.exercises[0].weightIncrement = -1, d => d.workouts[0].date = '2026-02-30', d => d.workouts[0].strengthEntries[0].sets[0].reps = 1.5, d => d.workouts[0].strengthEntries[0].sets[0].weight = null, d => d.exercises.push(d.exercises[0]), d => d.settings.theme = 'bad']) {
    const bad = structuredClone(data); mutate(bad); assert.throws(() => validateData(bad));
  }
});
test('local calendar date is used', () => { assert.equal(dayKey(new Date(2026, 8, 25, 0, 5)), '2026-09-25'); });
