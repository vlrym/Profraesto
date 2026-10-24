import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData } from '../config/demo-data.js';
import { getPhilippineNow } from '../utils/time.js';
import { getProfessorAvailability, getOpenSlots, getNextScheduledClass, validateScheduleEntry, hasScheduleConflict, formatRoomLocation, isSlotTaken, validateConsultationRequest, reconcileAppointments, appointmentConflicts, isValidDate, toTimestamp } from '../utils/scheduling.js';
import { loadData, saveData, normalizeData, STORE_KEY } from '../src/storage.js';

const at = time => toTimestamp('2026-10-26', time); // Monday, PHT
const professor = () => createDemoData().professors[0];
const booking = (changes = {}) => ({ id: 'a1', professorId: 'demo-maria', student: 'Student 1 Demo', date: '2026-10-26', time: '13:00', description: 'Discuss thesis topic', status: 'Pending', ...changes });
const block = (changes = {}) => ({ id: 'b1', kind: 'block', startDate: '2026-10-26', endDate: '2026-10-26', reason: 'Meeting', ...changes });

test('Manila date differs from UTC at the date boundary', () => {
  assert.deepEqual(getPhilippineNow(Date.parse('2026-10-25T16:00:00Z')), { date: '2026-10-26', minutes: 0 });
});
test('class starts automatically at 09:00 in SHL 305', () => {
  assert.equal(getProfessorAvailability(professor(), at('08:59')).status, 'unknown');
  assert.equal(getProfessorAvailability(professor(), at('09:00')).reason, 'Teaching in SHL 305');
});
test('class end is excluded and never implies Available', () => {
  assert.equal(getProfessorAvailability(professor(), at('10:29')).status, 'busy');
  assert.equal(getProfessorAvailability(professor(), at('10:30')).status, 'unknown');
});
test('a professor can teach in both SHL and JPL', () => {
  const p = professor(); p.schedule.push({ id: 'other', type: 'class', day: 1, start: '11:00', end: '12:00', label: 'Physics', building: 'JPL', room: '301' });
  assert.equal(getProfessorAvailability(p, at('11:00')).reason, 'Teaching in JPL 301');
});
test('exception overrides teaching; timed exception ends precisely', () => {
  const p = professor(); p.exceptions = [block({ start: '09:15', end: '09:45' })];
  assert.equal(getProfessorAvailability(p, at('09:15')).status, 'unavailable');
  assert.equal(getProfessorAvailability(p, at('09:45')).reason, 'Teaching in SHL 305');
});
test('approved ongoing consultations override available status', () => {
  const p = { ...professor(), status: 'available', updatedAt: at('12:00') };
  assert.equal(getProfessorAvailability(p, at('13:00'), [booking({ status: 'Approved' })]).reason, 'In a confirmed consultation');
  assert.equal(getProfessorAvailability(p, at('13:30'), [booking({ status: 'Approved' })]).status, 'available');
});
test('manual confirmation expires; expired timer does not imply presence', () => {
  const p = { ...professor(), status: 'available', updatedAt: at('11:00') };
  assert.equal(getProfessorAvailability(p, at('12:59')).status, 'available');
  assert.equal(getProfessorAvailability(p, at('13:00')).status, 'unknown');
  p.returnAt = at('11:30');
  assert.equal(getProfessorAvailability(p, at('11:30')).status, 'unknown');
});
test('manual unavailability overrides classes during its confirmation', () => {
  const p = { ...professor(), status: 'unavailable', updatedAt: at('09:00') };
  assert.equal(getProfessorAvailability(p, at('09:10')).status, 'unavailable');
});
test('one-date cancelled class does not teach, following week still does', () => {
  const p = professor(); p.exceptions = [block({ kind: 'cancel-class', classId: 'demo-maria-1-class' })];
  assert.equal(getProfessorAvailability(p, at('09:00')).status, 'unknown');
  assert.equal(getProfessorAvailability(p, toTimestamp('2026-11-02','09:00')).status, 'busy');
});
test('whole-day blocks include all of the end date and stop at midnight', () => {
  const p = professor(); p.exceptions = [block()];
  assert.equal(getProfessorAvailability(p, at('23:59')).status, 'unavailable');
  assert.equal(getProfessorAvailability(p, toTimestamp('2026-10-27','00:00')).status, 'unknown');
});
test('next class skips a cancelled occurrence', () => {
  const p = professor(); p.exceptions = [block({ kind:'cancel-class', classId:'demo-maria-1-class' })];
  assert.equal(getNextScheduledClass(p, at('08:00')).date, '2026-10-27');
});
test('exactly three room digits and centralized building options', () => {
  assert.equal(formatRoomLocation('SHL', '305'), 'SHL 305');
  for (const room of ['30','3000','ABC',' 305']) assert.equal(formatRoomLocation('SHL', room), '');
  assert.equal(formatRoomLocation('OTHER','305'), '');
});
test('schedule validation preserves commas in a class name', () => {
  const entry = { ...professor().schedule[0], label:'Signals, Systems and Control' };
  assert.equal(validateScheduleEntry(entry), '');
  for (const change of [{ label:'' }, { start:'' }, { start:'10:00', end:'09:00' }, { start:'25:00' }, { room:'12' }, { day:7 }]) assert.ok(validateScheduleEntry({ ...entry, ...change }));
});
test('overlapping classes rejected; touching classes and edits allowed', () => {
  const p = professor(); const entry = p.schedule[0];
  assert.equal(hasScheduleConflict(p.schedule, entry), false);
  assert.equal(hasScheduleConflict(p.schedule, { ...entry, id:'new', start:'10:00', end:'11:00' }), true);
  assert.equal(hasScheduleConflict(p.schedule, { ...entry, id:'new', start:'10:30', end:'11:00' }), false);
});
test('past bookings and malformed dates rejected', () => {
  assert.ok(validateConsultationRequest(professor(), booking(), [], at('13:00')));
  assert.equal(isValidDate('2026-02-30'), false);
  assert.ok(validateConsultationRequest(professor(), booking({ date:'' }), [], at('08:00')));
});
test('booking validates reason, faculty record, class and blocked times', () => {
  assert.equal(validateConsultationRequest(professor(), booking(), [], at('08:00')), '');
  for (const a of [booking({ description:'' }), booking({ description:'x'.repeat(1001) }), booking({ time:'09:00' })]) assert.ok(validateConsultationRequest(professor(), a, [], at('08:00')));
  assert.ok(validateConsultationRequest(null, booking(), [], at('08:00')));
  const p = professor(); p.exceptions = [block({ start:'13:15', end:'13:45' })];
  assert.ok(validateConsultationRequest(p, booking(), [], at('08:00')));
});
test('pending reservations prevent duplicate submission and overlapping starts', () => {
  assert.ok(validateConsultationRequest(professor(), booking(), [booking()], at('08:00')));
  assert.equal(isSlotTaken([booking()], 'demo-maria', '2026-10-26','13:15'), true);
  assert.equal(isSlotTaken([booking()], 'demo-maria', '2026-10-26','13:30'), false);
  assert.equal(isSlotTaken([booking()], 'demo-maria', '2026-10-26','13:00', 'a1'), false);
});
test('student cannot book two professors at overlapping times', () => {
  assert.equal(isSlotTaken([booking()], 'demo-paolo', '2026-10-26','13:00', null, 'Student 1 Demo'), true);
});
test('cancelled and declined consultations release reservation', () => {
  for (const status of ['Cancelled','Rejected','Completed','Needs action']) assert.equal(isSlotTaken([booking({ status })], 'demo-maria','2026-10-26','13:00'), false);
});
test('proposed alternatives reserve only the suggested slot', () => {
  const a = booking({ status:'Proposed', proposal:{ date:'2026-10-26', time:'14:00' } });
  assert.equal(isSlotTaken([a], 'demo-maria','2026-10-26','14:15'), true);
  assert.equal(isSlotTaken([a], 'demo-maria','2026-10-26','13:00'), false);
});
test('slots exclude past, classes and timed blocks without blocking the entire day', () => {
  const p = professor(); p.exceptions = [block({ start:'13:00', end:'14:00' })];
  const slots = getOpenSlots(p, at('13:15')).filter(s => s.date === '2026-10-26');
  assert.deepEqual(slots.map(s=>s.time), ['14:00','14:30']);
});
test('changed consultation hours remove misleading approval', () => {
  const p = professor(); p.schedule = p.schedule.filter(x => !(x.type === 'consult' && x.day === 1));
  const updated = reconcileAppointments(p, [booking({ status:'Approved' })], at('08:00'));
  assert.equal(updated[0].status, 'Needs action');
  assert.match(updated[0].response, /new time/);
});
test('deactivation and new blocks affect ongoing bookings, preserving history', () => {
  for (const p of [{ ...professor(), active:false }, { ...professor(), exceptions:[block()] }]) {
    assert.equal(reconcileAppointments(p, [booking({ status:'Approved' })], at('13:10'))[0].status,'Needs action');
    assert.equal(reconcileAppointments(p, [booking({ status:'Completed' })], at('13:10'))[0].status,'Completed');
  }
});
test('missing faculty is handled safely and no slots exist', () => {
  assert.equal(getProfessorAvailability(null).status, 'unavailable');
  assert.deepEqual(getOpenSlots(null), []);
  assert.ok(appointmentConflicts(null, booking()));
});
test('corrupt storage backs up raw data; missing storage starts empty', () => {
  const memory = new Map([[STORE_KEY, '{broken']]);
  const storage = { getItem:k=>memory.get(k), setItem:(k,v)=>memory.set(k,v) };
  assert.deepEqual(loadData(storage).professors, []);
  assert.equal(memory.get(STORE_KEY+'-backup'), '{broken');
  memory.delete(STORE_KEY);
  assert.deepEqual(loadData(storage).appointments, []);
});
test('malformed nested saved records cannot crash rendering', () => {
  const data = createDemoData();
  data.professors.push(null, { id:'missing', name:null });
  data.professors[0].schedule.push(null, { id:'bad', type:'class', start:'xx' });
  data.appointments = [null, { id:'bad', date:'bad' }]; data.notifications = [null, { text:5 }];
  const clean = normalizeData(data);
  assert.equal(clean.professors.length, 2);
  assert.equal(clean.professors[0].schedule.length, 10);
  assert.equal(clean.appointments.length, 0);
});
test('legacy class without room remains visible for repair', () => {
  const data = createDemoData(); delete data.professors[0].schedule[0].building; delete data.professors[0].schedule[0].room;
  assert.equal(getProfessorAvailability(normalizeData(data).professors[0], at('09:00')).reason, 'Teaching · room not yet specified');
});
test('storage denial is reported as failure', () => {
  assert.equal(saveData(createDemoData(), { setItem() { throw Error('denied'); } }), false);
});
test('manual unavailability blocks and invalidates overlapping consultations', () => {
  const p = { ...professor(), status:'unavailable', updatedAt:at('12:50'), returnAt:at('13:20') };
  assert.ok(appointmentConflicts(p, booking()));
  assert.equal(appointmentConflicts(p, booking({ time:'13:30' })), '');
  assert.equal(reconcileAppointments(p,[booking({status:'Approved'})],at('12:50'))[0].status, 'Needs action');
});
test('old overlapping approved reservations and missing faculty require action', () => {
  const data = createDemoData();
  data.appointments = [booking({status:'Approved',createdAt:1}),booking({id:'a2',status:'Approved',time:'13:15',createdAt:2}),booking({id:'a3',professorId:'missing',status:'Approved',createdAt:3})];
  const clean = normalizeData(data);
  assert.deepEqual(clean.appointments.map(a=>a.status),['Approved','Needs action','Needs action']);
});
test('backup quota failure preserves usable data and pauses persistent writes', () => {
  const original = createDemoData();
  original.professors[0].subjects = null;
  const raw = JSON.stringify(original);
  const storage = { getItem:()=>raw, setItem(){throw Error('quota exceeded');} };
  assert.equal(loadData(storage).professors.length,2);
  assert.equal(saveData(createDemoData(),storage),false);
  assert.equal(storage.getItem(STORE_KEY),raw);
  loadData({getItem:()=>null});
});
