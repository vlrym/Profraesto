export function createDemoData() {
  const faculty = [
    { id: 'demo-maria', name: 'Maria Santos', prefix: 'Dr.', department: 'CEA', subjects: ['Engineering Mathematics', 'Signals, Systems and Control'], office: 'SHL 305' },
    { id: 'demo-paolo', name: 'Paolo Reyes', prefix: 'Prof.', department: 'CAS', subjects: ['Communication'], office: 'JPL 204' }
  ];
  return { professors: faculty.map(p => ({ ...p, active: true, status: 'unknown', updatedAt: 0, returnAt: null, dnd: null, exceptions: [], schedule: [1, 2, 3, 4, 5].flatMap(day => [
    { id: `${p.id}-${day}-class`, type: 'class', day, start: '09:00', end: '10:30', label: p.subjects[0], building: p.id === 'demo-maria' ? 'SHL' : 'JPL', room: p.id === 'demo-maria' ? '305' : '204' },
    { id: `${p.id}-${day}-consult`, type: 'consult', day, start: '13:00', end: '15:00', label: p.office, capacity: 1 }
  ]) })), appointments: [], notifications: [], favoriteIds: [] };
}
