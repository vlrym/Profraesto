import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData } from '../config/demo-data.js';
import { validateScheduleEntry } from '../utils/scheduling.js';

test('fresh page data is independent of all changes in a previous instance', () => {
  const original = createDemoData();
  const running = createDemoData();
  running.professors[0].name = 'Edited faculty';
  running.professors[0].subjects.push('New subject');
  running.professors[0].schedule[0].room = '999';
  running.professors[0].events.push({ id: 'new-event' });
  running.professors[0].exceptions.push({ id: 'new-exception' });
  running.professors[0].override = { status: 'unavailable', until: null };
  running.professors.pop();
  running.appointments.push({ id: 'new-appointment' });
  running.notifications.push({ id: 'new-notification' });
  running.favoriteIds.push('demo-maria');
  assert.deepEqual(createDemoData(), original);
});

test('initial sample faculty have valid, uniquely identified weekly entries', () => {
  const data = createDemoData();
  assert.equal(data.professors.length, 2);
  assert.deepEqual(data.appointments, []);
  const ids = data.professors.flatMap(p => [p.id, ...p.schedule.map(entry => entry.id)]);
  assert.equal(new Set(ids).size, ids.length);
  for (const professor of data.professors) {
    for (const entry of professor.schedule) assert.equal(validateScheduleEntry(entry), '');
  }
});
