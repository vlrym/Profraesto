import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData } from '../config/demo-data.js';
import { getProfessorAvailability, getManualOverride, toTimestamp } from '../utils/scheduling.js';

const at = (time, date = '2026-10-26') => toTimestamp(date, time);
const faculty = (setAt, until = null, status = 'available') => ({
  ...createDemoData().professors[0], schedule: [], override: { status, setAt, until },
});
const status = (p, now, appointments = [], policy) => getProfessorAvailability(p, now, appointments, policy);

test('unconfirmed is automatic; unknown overrides and office/consult windows cannot assert presence', () => {
  const p = faculty(at('08:00'), null, 'unknown');
  p.schedule = ['office', 'consult'].map(type => ({ id:type, type, day:1, start:'08:00', end:'17:00', label:'SHL 401' }));
  assert.equal(getManualOverride(p, at('08:00')), null);
  assert.equal(status(p, at('08:00')).reason, 'Status Unconfirmed');
});

test('Available expires at six hours even when saved until changed or for a longer duration', () => {
  for (const until of [null, at('23:00')]) {
    const p = faculty(at('08:00'), until);
    assert.equal(status(p, at('13:59')).status, 'available');
    assert.equal(status(p, at('14:00')).status, 'unknown');
    assert.equal(status(p, at('13:00')).until, at('14:00'));
  }
});

test('shorter explicit expiry applies and a new confirmation renews Available', () => {
  const p = faculty(at('08:00'), at('08:30'));
  assert.equal(status(p, at('08:30')).status, 'unknown');
  p.override = { status:'available', setAt:at('08:30'), until:null };
  assert.equal(status(p, at('08:30')).status, 'available');
  assert.equal(status(p, at('08:00')).status, 'unknown');
});

test('daily cutoff expires yesterday confirmation even if inactivity threshold is longer', () => {
  const policy = { inactivityMinutes:48*60, dayStart:'07:30' };
  const p = faculty(at('23:00'));
  assert.equal(status(p, at('07:29', '2026-10-27'), [], policy).status, 'available');
  assert.equal(status(p, at('07:30', '2026-10-27'), [], policy).status, 'unknown');
  assert.equal(status(p, at('08:00', '2026-10-28'), [], policy).status, 'unknown');
});

test('early same-day confirmations count; cutoff and inactivity are configurable in Manila time', () => {
  const policy = { inactivityMinutes:60, dayStart:'08:00' };
  const p = faculty(at('07:30'));
  assert.equal(status(p, at('08:00'), [], policy).status, 'available');
  assert.equal(status(p, at('08:30'), [], policy).status, 'unknown');
  const late = faculty(at('23:30'));
  assert.equal(status(late, at('00:00','2026-10-27')).status, 'available');
});

test('indefinite Unavailable survives timeout and multiple daily cutoffs; timed overrides expire', () => {
  const p = faculty(at('08:00'), null, 'unavailable');
  assert.equal(status(p, at('08:00','2026-11-02')).status, 'unavailable');
  p.override.until = at('09:00');
  assert.equal(status(p, at('09:00')).status, 'unknown');
});

test('classes, meetings and approved consultations override Available and end in unconfirmed after expiry', () => {
  for (const type of ['class', 'meeting', 'appointment']) {
    const p = faculty(at('02:00'));
    // Confirmation is active at the event start, then expires during it.
    p.override.setAt = at('03:30');
    const event = { id:'event', type, day:1, date:'2026-10-26', start:'09:00', end:'10:30', label:'Activity', building:'SHL', room:'401' };
    if (type === 'class') p.schedule = [event];
    if (type === 'meeting') p.events = [event];
    const appointments = type === 'appointment' ? [{ id:'visit', professorId:p.id, status:'Approved', date:'2026-10-26', time:'09:00', student:'Alex' }] : [];
    const end = type === 'appointment' ? '09:30' : '10:30';
    const expected = type === 'class' ? 'teaching' : type === 'appointment' ? 'consultation' : 'meeting';
    assert.equal(status(p, at('09:00'), appointments).status, expected);
    if (type === 'appointment') assert.equal(status(p, at('09:00'), appointments).reason, 'In a Consultation');
    assert.equal(status(p, at(end), appointments).status, 'unknown');
  }
});

test('manual Meeting and Busy respect their selected duration without becoming selectable unknown', () => {
  for (const value of ['meeting', 'busy']) {
    const p = faculty(at('08:00'), at('09:00'), value);
    assert.equal(status(p, at('08:00')).status, value);
    assert.equal(status(p, at('09:00')).status, 'unknown');
  }
});
