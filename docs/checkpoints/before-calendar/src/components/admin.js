import { DEPARTMENTS, NAME_PREFIXES, DEFAULT_CONSULT_DAYS, DEFAULT_CONSULT_START, DEFAULT_CONSULT_END } from '../../config/settings.js';
import { newId, displayName } from '../helpers.js';
import { useState, html } from '../ui.js';
export function ManageFaculty({ app }) {
  const emptyForm = { prefix: NAME_PREFIXES[0], name: "", department: "", subjects: "", office: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const setField = (field, value) => setForm({ ...form, [field]: value });

  // If someone types "Dr. Maria Santos" in the name box, drop the typed prefix.
  const typedPrefixPattern = new RegExp(
    "^(" + NAME_PREFIXES.map((prefix) => prefix.replace(".", "\\.")).join("|") + ")\\s+",
    "i",
  );

  function addProfessor() {
    const name = form.name.trim().replace(typedPrefixPattern, "");
    const office = form.office.trim();
    const subjects = form.subjects
      .split("\n")
      .map((subject) => subject.trim())
      .filter(Boolean);

    if (name.length > 100 || office.length > 120 || subjects.some(subject => subject.length > 120) || subjects.length > 20) return setErrorMessage("Use a name up to 100 characters, office and subjects up to 120, and at most 20 subjects.");
    if (!name || !form.department || !office || subjects.length === 0)
      return setErrorMessage("Name, department, subject(s) and office are required.");
    if (app.data.professors.some((p) => p.id !== editingId && p.name.toLowerCase() === name.toLowerCase()))
      return setErrorMessage("That professor is already listed.");

    const newProfessor = {
      id: newId(),
      prefix: form.prefix,
      name,
      department: form.department,
      subjects,
      office,
      status: "unknown",
      returnAt: null,
      updatedAt: Date.now(),
      dnd: null,
      schedule: DEFAULT_CONSULT_DAYS.map((day) => ({
        id: newId(),
        type: "consult",
        day,
        start: DEFAULT_CONSULT_START,
        end: DEFAULT_CONSULT_END,
        label: office,
        capacity: null,
      })),
    };

    if (editingId) {
      app.updateProfessor(editingId, { prefix: form.prefix, name, department: form.department, subjects, office });
      app.showToast("Faculty details saved.");
    } else {
      app.updateData("professors", (list) => [...list, newProfessor]);
      app.showToast(`${displayName(newProfessor)} added.`);
    }
    setEditingId(null);
    setForm({ ...emptyForm, prefix: form.prefix });
    setErrorMessage("");
  }

  function editProfessor(p) {
    setEditingId(p.id);
    setForm({ prefix: p.prefix, name: p.name, department: p.department, subjects: p.subjects.join("\n"), office: p.office });
    setErrorMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function toggleActive(p) {
    app.askToConfirm(`${p.active === false ? "Reactivate" : "Deactivate"} ${displayName(p)}? Past consultations and alerts will be preserved. Affected bookings become Needs action; history is preserved.`, () => {
      app.updateProfessor(p.id, { active: p.active === false });
      app.showToast(p.active === false ? "Faculty reactivated." : "Faculty deactivated.");
    });
  }

  return html`
    <div class="stack manage-panel">
      <div class="card editor-card">
        <h3>${editingId ? "Edit professor" : "Add a professor"}</h3>
        <div class="name-fields">
          <label class="field-block"><span class="form-label">Title</span>
            <select value=${form.prefix} onChange=${(event) => setField("prefix", event.target.value)}>
              ${NAME_PREFIXES.map((prefix) => html`<option key=${prefix}>${prefix}</option>`)}
            </select>
          </label>
          <label class="field-block"><span class="form-label">Full name</span>
            <input maxLength="100" placeholder="Enter professor's name" value=${form.name}
              onInput=${(event) => setField("name", event.target.value)} />
          </label>
        </div>
        <div class="form-grid">
          <label class="field-block"><span class="form-label">Department</span>
            <select value=${form.department} onChange=${(event) => setField("department", event.target.value)}>
              <option value="">Select department</option>
              ${DEPARTMENTS.map((code) => html`<option key=${code}>${code}</option>`)}
            </select>
          </label>
          <label class="field-block"><span class="form-label">Subjects</span>
            <textarea rows="2" placeholder="One subject per line; commas are allowed" value=${form.subjects}
              onInput=${(event) => setField("subjects", event.target.value)}></textarea>
          </label>
        </div>
        <label class="field-block"><span class="form-label">Office location</span>
          <input maxLength="120" placeholder="e.g. Academic Building, Room 204" value=${form.office}
            onInput=${(event) => setField("office", event.target.value)} />
        </label>
        ${errorMessage && html`<div class="error-text">${errorMessage}</div>`}
        <div class="row"><button class="primary" onClick=${addProfessor}>${editingId ? "Save details" : "Add professor"}</button>
          ${editingId && html`<button onClick=${() => { setEditingId(null); setForm(emptyForm); setErrorMessage(""); }}>Cancel edit</button>`}</div>
        <div class="small muted">
          New professors start Not confirmed with default consultation hours (Mon–Fri, 1–3 PM),
          editable in the Professor view.
        </div>
      </div>

      <div class="section-heading"><h3>Faculty list</h3><span class="count-badge">${app.data.professors.length} total</span></div>
      ${app.data.professors.length
        ? app.data.professors.map(
            (professor) => html`
              <div class="card faculty-manage-card" key=${professor.id}>
                <div class="row">
                  <div class="fill">
                    <b>${displayName(professor)}</b>
                    <div class="muted small">${professor.department} · ${professor.office} ${professor.active === false ? "· Deactivated" : ""}</div>
                  </div>
                  <button onClick=${() => editProfessor(professor)}>Edit</button>
                  <button onClick=${() => toggleActive(professor)}>${professor.active === false ? "Reactivate" : "Deactivate"}</button>
                </div>
              </div>
            `,
          )
        : html`<div class="card muted">No professors yet. Add the first one above.</div>`}
    </div>
  `;
}


