import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData } from '../config/demo-data.js';
import { getCalendarRange, getWeekStart, navigateCalendar, getCalendarEvents, getNextScheduledActivity, layoutTimedEvents } from '../utils/calendar.js';
import { getProfessorAvailability, getOpenSlots, validateCalendarEvent, appointmentConflicts, reconcileAppointments, toTimestamp } from '../utils/scheduling.js';

const professor = () => ({ ...createDemoData().professors[0], events:[], override:null });
const at = (time, date = '2026-10-26') => toTimestamp(date,time);
const meeting = (changes = {}) => ({ id:'meeting1', type:'meeting', label:'Department meeting', date:'2026-10-26', endDate:'2026-10-26', start:'15:00', end:'16:00', ...changes });
const appointment = (changes = {}) => ({ id:'visit1', professorId:'demo-maria', student:'Student 1 Demo', status:'Approved', category:'Academic Concern', description:'Discuss thesis', date:'2026-10-26', time:'13:00', ...changes });

test('Monday-based week and 42-day month grid cross year boundaries', () => {
  assert.equal(getWeekStart('2027-01-03'),'2026-12-28');
  assert.equal(getCalendarRange('2026-11-01','month').start,'2026-10-26');
  assert.equal(getCalendarRange('2026-11-01','month').days.length,42);
  assert.deepEqual(getCalendarRange('2026-10-26','day').days,['2026-10-26']);
});
test('calendar previous/next moves by day, week or month without month-end skipping', () => {
  assert.equal(navigateCalendar('2026-01-31','month',1),'2026-02-01');
  assert.equal(navigateCalendar('2026-12-31','month',1),'2027-01-01');
  assert.equal(navigateCalendar('2026-10-26','week',-1),'2026-10-19');
  assert.equal(navigateCalendar('2026-10-26','day',1),'2026-10-27');
});
test('calendar expands recurring classes while meetings occur on one date', () => {
  const p = professor(); p.events = [meeting()];
  const events = getCalendarEvents(p,'2026-10-26','2026-11-02');
  assert.equal(events.filter(x=>x.type==='class' && x.day===1).length,2);
  assert.equal(events.filter(x=>x.type==='meeting').length,1);
});
test('one-time meeting begins and ends automatically', () => {
  const p = professor(); p.events = [meeting()];
  assert.equal(getProfessorAvailability(p,at('14:59')).status,'unknown');
  assert.equal(getProfessorAvailability(p,at('15:00')).status,'meeting');
  assert.equal(getProfessorAvailability(p,at('16:00')).status,'unknown');
});
test('meetings reject overlapping classes and meetings, allow an adjacent event and self-edit', () => {
  const p = professor(); p.events = [meeting()];
  assert.ok(validateCalendarEvent(p,meeting({id:'another',start:'09:30',end:'10:00'})));
  assert.ok(validateCalendarEvent(p,meeting({id:'another',start:'15:30',end:'16:30'})));
  assert.equal(validateCalendarEvent(p,meeting()),'');
  assert.equal(validateCalendarEvent(p,meeting({id:'another',start:'16:00',end:'17:00'})),'');
});
test('cancelled occurrence does not cause a meeting conflict and can be restored', () => {
  const p = professor(); p.exceptions = [{id:'cancel',kind:'cancel-class',classId:'demo-maria-1-class',startDate:'2026-10-26',endDate:'2026-10-26',reason:'Cancelled'}];
  assert.equal(validateCalendarEvent(p,meeting({start:'09:00',end:'10:00'})),'');
  assert.equal(getCalendarEvents(p,'2026-10-26','2026-10-26').filter(x=>x.type==='cancelled-class').length,1);
  p.exceptions=[];
  assert.equal(getProfessorAvailability(p,at('09:00')).reason,'Teaching at SHL 305');
});
test('meeting validation rejects invalid dates, empty names and invalid time ranges', () => {
  for (const change of [{label:''},{date:''},{end:'14:00'},{start:''},{date:'2026-02-30'},{endDate:'2026-11-02'}]) assert.ok(validateCalendarEvent(professor(),meeting(change)));
});
test('overnight meeting is clipped to each calendar day and ends at correct Manila instant', () => {
  const p = professor(); p.events = [meeting({start:'23:30',endDate:'2026-10-27',end:'00:30'})];
  assert.equal(validateCalendarEvent(p,p.events[0]),'');
  assert.deepEqual(getCalendarEvents(p,'2026-10-26','2026-10-27').filter(x=>x.type==='meeting').map(x=>[x.date,x.start,x.end]),[['2026-10-26','23:30','24:00'],['2026-10-27','00:00','00:30']]);
  assert.equal(getProfessorAvailability(p,at('00:29','2026-10-27')).status,'meeting');
  assert.equal(getProfessorAvailability(p,at('00:30','2026-10-27')).status,'unknown');
});
test('configured office hours permit Available, ordinary consultation windows do not', () => {
  const p = professor();
  assert.equal(getProfessorAvailability(p,at('13:00')).status,'unknown');
  p.schedule.push({id:'office',type:'office',day:1,start:'11:00',end:'12:00',label:'SHL 305'});
  assert.equal(getProfessorAvailability(p,at('11:00')).status,'available');
  assert.match(getProfessorAvailability(p,at('11:00')).detail,/presence not confirmed/);
  assert.equal(getOpenSlots(p,at('08:00')).some(x=>x.date==='2026-10-26'&&x.time==='11:00'),true);
});
test('class, meeting and approved consultation take precedence over office hours', () => {
  const p = professor(); p.schedule.push({id:'office',type:'office',day:1,start:'08:00',end:'17:00',label:'SHL 305'}); p.events=[meeting()];
  assert.equal(getProfessorAvailability(p,at('09:00')).status,'teaching');
  assert.equal(getProfessorAvailability(p,at('15:00')).status,'meeting');
  assert.equal(getProfessorAvailability(p,at('13:00'),[appointment()]).status,'consultation');
});
test('pending and cancelled consultations never claim In Consultation', () => {
  for (const status of ['Pending','Cancelled','Needs action']) assert.equal(getProfessorAvailability(professor(),at('13:00'),[appointment({status})]).status,'unknown');
});
test('until-changed override has no two-hour expiry; explicit unavailable wins', () => {
  const p = professor(); p.override={status:'unavailable',setAt:at('08:00'),until:null};
  assert.equal(getProfessorAvailability(p,at('09:00')).status,'unavailable');
  assert.equal(getProfessorAvailability(p,at('18:00','2026-11-01')).status,'unavailable');
  assert.ok(appointmentConflicts(p,appointment()));
  p.override=null;
  assert.equal(getProfessorAvailability(p,at('09:00')).status,'teaching');
});
test('manual Available does not suppress a scheduled class and survives beyond two hours', () => {
  const p = professor(); p.override={status:'available',setAt:at('08:00'),until:null};
  assert.equal(getProfessorAvailability(p,at('09:00')).status,'teaching');
  assert.equal(getProfessorAvailability(p,at('18:00')).status,'available');
});
test('selected-time and rest-of-day overrides stop at their exclusive end', () => {
  const p = professor(); p.override={status:'unavailable',setAt:at('11:00'),until:at('11:30')};
  assert.equal(getProfessorAvailability(p,at('11:29')).status,'unavailable');
  assert.equal(getProfessorAvailability(p,at('11:30')).status,'unknown');
  p.override.until=at('00:00','2026-10-27');
  assert.equal(getProfessorAvailability(p,at('23:59')).status,'unavailable');
  assert.equal(getProfessorAvailability(p,at('00:00','2026-10-27')).status,'unknown');
});
test('unavailable event overrides teaching and ends without refresh', () => {
  const p = professor(); p.events=[meeting({type:'unavailable',start:'09:15',end:'09:45'})];
  assert.equal(getProfessorAvailability(p,at('09:15')).status,'unavailable');
  assert.equal(getProfessorAvailability(p,at('09:45')).status,'teaching');
});
test('meetings remove bookable times and flag previously approved consultations', () => {
  const p = professor(); p.events=[meeting({start:'13:15',end:'13:45'})];
  assert.equal(getOpenSlots(p,at('08:00')).some(x=>x.date==='2026-10-26'&&['13:00','13:30'].includes(x.time)),false);
  assert.equal(reconcileAppointments(p,[appointment()],at('08:00'))[0].status,'Needs action');
  p.events=[];
  assert.equal(getOpenSlots(p,at('08:00')).some(x=>x.date==='2026-10-26'&&x.time==='13:00'),true);
});
test('next scheduled activity includes a confirmed visit ahead of the next class', () => {
  const next = getNextScheduledActivity(professor(),at('10:30'),[appointment()]);
  assert.equal(next.type,'appointment');
  assert.equal(next.start,'13:00');
});
test('approved and pending appointments are projected once, without modifying saved schedules', () => {
  const p=professor(); const length=p.schedule.length;
  const events=getCalendarEvents(p,'2026-10-26','2026-10-26',[appointment(),appointment({id:'pending',time:'13:30',status:'Pending'})]);
  assert.equal(events.filter(x=>x.type==='appointment').length,2);
  assert.equal(p.schedule.length,length);
});
test('overlapping event lanes remain distinct; adjacent events reuse full width', () => {
  const events=layoutTimedEvents([{id:'a',start:'09:00',end:'10:00'},{id:'b',start:'09:30',end:'10:30'},{id:'c',start:'10:30',end:'11:00'}]);
  assert.equal(events[0].lanes,2); assert.notEqual(events[0].lane,events[1].lane); assert.equal(events[2].lanes,1);
});
test('missing faculty produces an empty calendar', () => {
  assert.deepEqual(getCalendarEvents(null,'2026-10-26','2026-10-26'),[]);
});
test('new all-day unavailable events include Through date and reopen the next midnight', () => {
  const p=professor();
  p.events=[{id:'away',type:'unavailable',label:'Conference',date:'2026-10-26',endDate:'2026-10-28',start:'00:00',end:'00:00',allDay:true}];
  assert.equal(validateCalendarEvent(p,p.events[0]),'');
  assert.equal(getCalendarEvents(p,'2026-10-26','2026-10-28').filter(x=>x.type==='unavailable').length,2);
  assert.equal(getProfessorAvailability(p,at('23:59','2026-10-27')).status,'unavailable');
  assert.equal(getProfessorAvailability(p,at('00:00','2026-10-28')).status,'unknown');
});
