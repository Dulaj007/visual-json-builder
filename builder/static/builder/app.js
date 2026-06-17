/**
 * app.js — JSON Builder Application Logic
 *
 * This file is the entire client-side brain of the JSON Builder app.
 * It runs without any framework; all state lives in a plain JS object
 * and the DOM is rebuilt via innerHTML whenever structure changes.
 *
 * High-level flow:
 *   1. On page load, restore any previously saved state from localStorage.
 *   2. The user defines a "schema" — a list of named, typed fields
 *      (string / number / boolean / array) that every item must have.
 *   3. The user adds "items" — objects whose keys and value types are
 *      dictated by the schema. Items store values keyed by the schema
 *      field's numeric ID, not by name, so renaming a field never
 *      loses existing data.
 *   4. On export the state is serialised to a JSON array and downloaded
 *      as data.json. Each item object is keyed by the current field name
 *      and the value is coerced to the field's declared type.
 *   5. All user input is debounced and auto-saved to localStorage so
 *      work survives a page refresh.
 *
 * Rendering strategy:
 *   - Structural changes (add/remove field or item, type change) trigger
 *     a full innerHTML rebuild of the affected panel.
 *   - Simple text edits (typing in a field name or item value) update
 *     only the in-memory state via oninput handlers. Labels in the items
 *     panel are surgically patched via data-flabel attributes to avoid a
 *     full re-render on every keystroke.
 */


/* ============================================================
   STATE
   ============================================================
   The single source of truth for the entire application.

   schema  — ordered list of field definitions.
             Each entry: { id: number, name: string, type: string }
             type is one of: 'string' | 'number' | 'boolean' | 'array'

   items   — ordered list of data records.
             Each entry: { id: number, data: { [fieldId]: value } }
             data is keyed by schema field ID (not name) so that
             renaming a field does not destroy its stored values.

   _sid / _iid — ever-increasing counters used to generate unique IDs
                 for schema fields and items respectively. They are
                 persisted to localStorage so IDs never collide across
                 sessions or after a clear-and-restore cycle.
   ============================================================ */
const state = {
  schema: [],
  items: [],
  _sid: 0,  /* last schema field ID issued */
  _iid: 0,  /* last item ID issued */
};


/* ============================================================
   HELPERS — ID GENERATORS
   ============================================================
   nextSid() / nextIid() increment and return the counter so every
   new schema field or item gets a globally unique numeric ID within
   this session and across reloads (because counters are persisted).
   ============================================================ */
function nextSid() { return ++state._sid; }
function nextIid() { return ++state._iid; }


/* ============================================================
   HELPERS — DEFAULT VALUES
   ============================================================
   getDefault(type) returns the empty/zero value for each supported
   field type. Called when:
     - A new schema field is added (all existing items need a default).
     - A new item is added (all schema fields need a default).
     - The user changes a field's type (existing values are reset to
       the new type's default so the rendered input is always correct).
   ============================================================ */
function getDefault(type) {
  if (type === 'number') return 0;
  if (type === 'boolean') return false;
  if (type === 'array') return [];
  return '';  /* string and any unknown type */
}


/* ============================================================
   HELPERS — TYPE COERCION
   ============================================================
   coerce(val, type) converts a raw stored value to its proper JS type
   immediately before export. This is needed because:
     - <input type="number"> returns strings via .value.
     - Checkbox state is already boolean but stored booleans survive
       JSON.parse correctly.
     - Array entries are strings; the array wrapper is already correct.
   The function never mutates state — it only produces the export value.
   ============================================================ */
function coerce(val, type) {
  if (type === 'number') { const n = Number(val); return isNaN(n) ? 0 : n; }
  if (type === 'boolean') return Boolean(val);
  if (type === 'array') return Array.isArray(val) ? val : [];
  return String(val ?? '');
}


/* ============================================================
   HELPERS — HTML ESCAPING
   ============================================================
   esc(str) escapes the five HTML special characters before injecting
   any user-supplied string into innerHTML. This prevents XSS from
   field names or item values that contain < > " & characters.
   ============================================================ */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/* ============================================================
   HELPERS — INLINE SVG ICONS
   ============================================================
   These tiny functions return SVG markup strings so icons can be
   embedded directly into innerHTML templates without an external
   sprite sheet or icon font.

   svgX(size)    — an × (close / remove) icon
   svgPlus(size) — a + (add) icon
   svgCopy(size) — a copy / duplicate icon
   ============================================================ */
function svgX(size = 14) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}

function svgPlus(size = 12) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}

function svgCopy(size = 13) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
}


/* ============================================================
   SCHEMA OPERATIONS
   ============================================================
   The schema defines the shape of every item. Each field has:
     id   — unique numeric ID (never changes, even if name changes)
     name — user-editable key that appears in the exported JSON
     type — controls which input widget is rendered for that field

   Rules enforced here:
     - Adding a field immediately inserts its default value into every
       existing item so items always have a complete data map.
     - Removing a field deletes its key from every existing item so
       no orphaned data accumulates.
     - Changing a field's type resets all item values for that field
       to the new type's default (a type change is a destructive reset
       by design — otherwise the stored value might be incompatible
       with the new input widget).
     - Changing a field's name only updates state and patches the DOM
       labels in-place; a full re-render is deliberately avoided so the
       user's cursor position in other inputs is not disrupted.
   ============================================================ */

/**
 * addSchemaField — appends a new, blank string field to the schema,
 * writes its default value into every existing item, re-renders both
 * panels, then focuses the new field's name input so the user can
 * type the name immediately without a second click.
 */
function addSchemaField() {
  const field = { id: nextSid(), name: '', type: 'string' };
  state.schema.push(field);
  state.items.forEach(item => { item.data[field.id] = getDefault('string'); });
  renderSchema();
  renderItems();
  /* defer focus so the DOM has been updated before querySelector runs */
  setTimeout(() => {
    const inputs = document.querySelectorAll('.field-name-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 0);
}

/**
 * removeSchemaField — removes a field from the schema by ID and
 * deletes the corresponding key from every item's data map.
 * Both panels are re-rendered to reflect the structural change.
 */
function removeSchemaField(fid) {
  state.schema = state.schema.filter(f => f.id !== fid);
  state.items.forEach(item => delete item.data[fid]);
  renderSchema();
  renderItems();
}

/**
 * onFieldNameInput — called on every keystroke in a schema field's
 * name input. Updates state and then surgically patches the matching
 * <span data-flabel="fid"> elements inside each item card instead of
 * doing a full re-render, preserving cursor position in all inputs.
 */
function onFieldNameInput(fid, value) {
  const field = state.schema.find(f => f.id === fid);
  if (!field) return;
  field.name = value;
  /* patch label text in all item cards without rebuilding the DOM */
  document.querySelectorAll(`[data-flabel="${fid}"]`).forEach(el => {
    el.textContent = value || `field_${fid}`;
  });
}

/**
 * onFieldTypeChange — called when the user picks a different type from
 * the schema field's <select>. Resets all item values for this field
 * to the new type's default, then re-renders only the items panel
 * (the schema panel's select is already correct because it triggered
 * this call).
 */
function onFieldTypeChange(fid, newType) {
  const field = state.schema.find(f => f.id === fid);
  if (!field) return;
  field.type = newType;
  state.items.forEach(item => { item.data[fid] = getDefault(newType); });
  renderItems();
}


/* ============================================================
   ITEM OPERATIONS
   ============================================================
   Items are the data records the user fills in and ultimately exports.
   Each item's `data` object is keyed by schema field IDs (numbers),
   not by field names. This means:
     - Renaming a field never breaks or loses an item's stored value.
     - Items carry values for ALL current schema fields at all times.

   duplicateItem performs a deep clone via JSON round-trip so that
   array values in the source item are not shared by reference with
   the copy.
   ============================================================ */

/**
 * addItem — creates a new item pre-populated with the default value
 * for every current schema field, appends it to the list, and
 * re-renders the items panel.
 */
function addItem() {
  const item = { id: nextIid(), data: {} };
  state.schema.forEach(f => { item.data[f.id] = getDefault(f.type); });
  state.items.push(item);
  renderItems();
}

/**
 * removeItem — removes the item with the given ID from the list
 * and re-renders the items panel.
 */
function removeItem(iid) {
  state.items = state.items.filter(i => i.id !== iid);
  renderItems();
}

/**
 * duplicateItem — inserts a deep copy of the source item directly
 * after it in the list. The copy gets a fresh ID. Deep clone via
 * JSON.parse(JSON.stringify(...)) ensures nested arrays are not
 * shared by reference between the original and the copy.
 */
function duplicateItem(iid) {
  const src = state.items.find(i => i.id === iid);
  if (!src) return;
  const copy = { id: nextIid(), data: JSON.parse(JSON.stringify(src.data)) };
  const idx = state.items.findIndex(i => i.id === iid);
  state.items.splice(idx + 1, 0, copy);
  renderItems();
}

/**
 * onItemFieldInput — called on every keystroke in a string or number
 * input inside an item card. Stores the raw string value; coercion
 * to the correct JS type happens only at export time via coerce().
 */
function onItemFieldInput(iid, fid, value) {
  const item = state.items.find(i => i.id === iid);
  if (item) item.data[fid] = value;
}

/**
 * onItemBoolChange — called when the user toggles a boolean field's
 * checkbox. Stores the boolean and patches the adjacent label text
 * (true / false) without a full re-render of the items panel.
 */
function onItemBoolChange(iid, fid, checked) {
  const item = state.items.find(i => i.id === iid);
  if (!item) return;
  item.data[fid] = checked;
  /* patch the label text next to the toggle switch */
  const label = document.querySelector(`[data-bool-label="${iid}-${fid}"]`);
  if (label) label.textContent = checked ? 'true' : 'false';
}

/**
 * addArrayEntry — appends an empty string to the array stored under
 * the given field ID of the given item, then re-renders items and
 * auto-focuses the new input so the user can type immediately.
 */
function addArrayEntry(iid, fid) {
  const item = state.items.find(i => i.id === iid);
  if (!item || !Array.isArray(item.data[fid])) return;
  item.data[fid].push('');
  renderItems();
  /* focus the newly created input after the DOM rebuilds */
  setTimeout(() => {
    const entries = document.querySelectorAll(`[data-ae="${iid}-${fid}"]`);
    if (entries.length) entries[entries.length - 1].focus();
  }, 0);
}

/**
 * removeArrayEntry — removes the entry at the given index from the
 * array and re-renders. Indices shift down automatically because the
 * whole items panel is rebuilt from state.
 */
function removeArrayEntry(iid, fid, idx) {
  const item = state.items.find(i => i.id === iid);
  if (!item || !Array.isArray(item.data[fid])) return;
  item.data[fid].splice(idx, 1);
  renderItems();
}

/**
 * onArrayEntryInput — called on every keystroke inside an array entry
 * input. Writes the new string value into the correct position of the
 * array without triggering a re-render (same rationale as onItemFieldInput).
 */
function onArrayEntryInput(iid, fid, idx, value) {
  const item = state.items.find(i => i.id === iid);
  if (item && Array.isArray(item.data[fid])) item.data[fid][idx] = value;
}


/* ============================================================
   RENDER — SCHEMA PANEL
   ============================================================
   renderSchema() rebuilds the entire schema field list from state.
   It also updates the schema field count badge in the panel header.

   Each row contains:
     - A decorative drag handle (visual only; drag-to-reorder is a
       future enhancement).
     - A monospace text input for the field name (fires onFieldNameInput).
     - A <select> for the field type (fires onFieldTypeChange).
     - A remove button (calls removeSchemaField).
   ============================================================ */
function renderSchema() {
  const container = document.getElementById('schema-fields');
  const countEl = document.getElementById('schema-count');
  if (countEl) countEl.textContent = state.schema.length;

  /* show placeholder text when no fields have been defined yet */
  if (state.schema.length === 0) {
    container.innerHTML = `
      <div class="schema-empty">
        No fields yet — click <strong>Add Field</strong> to define your JSON structure.
      </div>`;
    return;
  }

  container.innerHTML = state.schema.map(f => `
    <div class="schema-row" data-schema-id="${f.id}">
      <span class="schema-drag-handle" title="Drag to reorder">⠿</span>
      <input
        type="text"
        class="input input-mono field-name-input"
        placeholder="field_name"
        value="${esc(f.name)}"
        oninput="onFieldNameInput(${f.id}, this.value)"
        autocomplete="off"
        spellcheck="false"
      />
      <select class="select" onchange="onFieldTypeChange(${f.id}, this.value)">
        <option value="string"  ${f.type === 'string'  ? 'selected' : ''}>string</option>
        <option value="number"  ${f.type === 'number'  ? 'selected' : ''}>number</option>
        <option value="boolean" ${f.type === 'boolean' ? 'selected' : ''}>boolean</option>
        <option value="array"   ${f.type === 'array'   ? 'selected' : ''}>array</option>
      </select>
      <button class="btn-icon btn-remove" onclick="removeSchemaField(${f.id})" title="Remove field">
        ${svgX(13)}
      </button>
    </div>
  `).join('');
}


/* ============================================================
   RENDER — FIELD INPUT (per item × per field)
   ============================================================
   renderFieldInput(item, field) returns the appropriate HTML input
   widget for one field inside one item card, based on the field type:

     string  → <input type="text">
     number  → <input type="number">
     boolean → a CSS toggle switch built from a hidden checkbox +
               a styled <span class="toggle-slider">
     array   → a vertical list of text inputs, each with a remove
               button, plus a dashed "Add entry" button at the bottom.

   The data-ae attribute on array inputs encodes "itemId-fieldId" and
   is used to focus the newly created input after addArrayEntry().

   The data-flabel attribute on label <span>s encodes the field ID and
   is used by onFieldNameInput() for surgical DOM patching.
   ============================================================ */
function renderFieldInput(item, field) {
  const iid = item.id;
  const fid = field.id;
  const val = item.data[fid];

  switch (field.type) {

    /* boolean — hidden checkbox drives a CSS-animated pill toggle.
       data-bool-label is patched by onItemBoolChange without a full re-render. */
    case 'boolean':
      return `
        <label class="toggle">
          <input type="checkbox" ${val ? 'checked' : ''} onchange="onItemBoolChange(${iid}, ${fid}, this.checked)" />
          <span class="toggle-slider"></span>
          <span class="toggle-label" data-bool-label="${iid}-${fid}">${val ? 'true' : 'false'}</span>
        </label>`;

    /* number — native number input; value coerced to JS Number at export */
    case 'number':
      return `<input
        type="number"
        class="input"
        value="${esc(val)}"
        oninput="onItemFieldInput(${iid}, ${fid}, this.value)"
      />`;

    /* array — renders one text row per entry plus an "Add entry" button */
    case 'array': {
      const entries = Array.isArray(val) ? val : [];
      const rows = entries.map((entry, i) => `
        <div class="array-entry">
          <input
            type="text"
            class="input"
            value="${esc(entry)}"
            placeholder="value"
            data-ae="${iid}-${fid}"
            oninput="onArrayEntryInput(${iid}, ${fid}, ${i}, this.value)"
          />
          <button class="btn-icon btn-remove" onclick="removeArrayEntry(${iid}, ${fid}, ${i})" title="Remove">
            ${svgX(12)}
          </button>
        </div>
      `).join('');
      return `
        <div class="array-field">
          ${rows}
          <button class="btn-add-entry" onclick="addArrayEntry(${iid}, ${fid})">
            ${svgPlus(11)} Add entry
          </button>
        </div>`;
    }

    /* string (default) — plain text input */
    default:
      return `<input
        type="text"
        class="input"
        value="${esc(val)}"
        oninput="onItemFieldInput(${iid}, ${fid}, this.value)"
      />`;
  }
}


/* ============================================================
   RENDER — ITEMS PANEL
   ============================================================
   renderItems() rebuilds the entire items grid from state.
   It also updates the items count badge in the panel header.

   Each item is rendered as a card (.item-card) containing:
     - A header bar with the item's sequential number (not its ID),
       a duplicate button, and a remove button.
     - A field list built by mapping over state.schema and calling
       renderFieldInput() for each field. If no schema is defined,
       a hint message is shown instead.

   The items are displayed in a responsive CSS grid so they wrap
   automatically on narrower screens.
   ============================================================ */
function renderItems() {
  const container = document.getElementById('items-container');
  const countEl = document.getElementById('items-count');
  if (countEl) countEl.textContent = state.items.length;

  /* show a call-to-action empty state when there are no items yet */
  if (state.items.length === 0) {
    container.innerHTML = `
      <div class="items-empty">
        <div class="items-empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        </div>
        <p>No items yet. Add one to start building your JSON.</p>
        <button class="btn btn-primary" onclick="addItem()">${svgPlus(13)} Add first item</button>
      </div>`;
    return;
  }

  /*
   * Wrap all item cards in a single .items-grid div so the CSS grid
   * layout applies. idx (0-based) is used to display a 1-based human
   * label ("Item #1") that reflects current order, not the internal ID.
   */
  container.innerHTML = `<div class="items-grid">${
    state.items.map((item, idx) => `
      <div class="item-card" data-item-id="${item.id}">
        <div class="item-card-header">
          <span class="item-number">Item #${idx + 1}</span>
          <div class="item-card-actions">
            <button class="btn-icon btn-duplicate" onclick="duplicateItem(${item.id})" title="Duplicate item">
              ${svgCopy(13)}
            </button>
            <button class="btn-icon btn-remove" onclick="removeItem(${item.id})" title="Remove item">
              ${svgX(13)}
            </button>
          </div>
        </div>
        <div class="item-fields">
          ${state.schema.length === 0
            ? `<p class="item-no-schema">Define schema fields above to add data here.</p>`
            : state.schema.map(f => `
              <div class="item-field">
                <label class="field-label">
                  <!-- data-flabel allows onFieldNameInput to patch this text
                       without rebuilding the whole items panel -->
                  <span data-flabel="${f.id}">${esc(f.name || `field_${f.id}`)}</span>
                  <span class="type-tag type-${f.type}">${f.type}</span>
                </label>
                <div class="field-input-wrap">
                  ${renderFieldInput(item, f)}
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `).join('')
  }</div>`;
}


/* ============================================================
   EXPORT
   ============================================================
   buildExportData() converts the internal state (fields keyed by
   numeric ID, values stored as strings from inputs) into a clean JS
   array ready for JSON serialisation. For each item:
     - Iterate the current schema in order.
     - Use the field's current name as the JSON key (fall back to
       "field_N" if the user left the name blank).
     - Call coerce() to produce the correct JS type for the value.

   exportJSON() serialises the array, creates a temporary Blob URL,
   programmatically clicks a hidden <a> to trigger a browser download,
   then revokes the URL to free memory.

   showPreview() populates the preview modal's <pre> block with the
   formatted JSON before the user decides whether to download.

   copyPreviewJSON() writes the preview content to the clipboard using
   the async Clipboard API.
   ============================================================ */

/**
 * buildExportData — assembles the final JS array that will be
 * serialised as JSON. No side effects; safe to call for preview or
 * export without triggering any download.
 *
 * @returns {Object[]} array of plain objects, one per item
 */
function buildExportData() {
  return state.items.map(item => {
    const obj = {};
    state.schema.forEach(f => {
      /* use the trimmed field name, or a safe fallback if name is blank */
      const key = f.name.trim() || `field_${f.id}`;
      obj[key] = coerce(item.data[f.id], f.type);
    });
    return obj;
  });
}

/**
 * exportJSON — downloads the current state as data.json.
 * Shows a warning toast when there are no items to export.
 */
function exportJSON() {
  if (state.items.length === 0) {
    showToast('No items to export.', 'warn');
    return;
  }
  const data = buildExportData();
  const json = JSON.stringify(data, null, 2);

  /* create a temporary object URL and click it to trigger download */
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);  /* release memory immediately after click */

  showToast(`Exported ${data.length} item${data.length !== 1 ? 's' : ''} as JSON.`, 'ok');
}

/**
 * showPreview — renders the current JSON into the preview modal's
 * <pre> block and opens the modal.
 */
function showPreview() {
  const data = buildExportData();
  const json = JSON.stringify(data, null, 2);
  document.getElementById('preview-code').textContent = json;
  document.getElementById('preview-modal').classList.add('open');
}

/** closePreview — hides the preview modal. */
function closePreview() {
  document.getElementById('preview-modal').classList.remove('open');
}

/**
 * copyPreviewJSON — copies the text content of the preview <pre>
 * block to the system clipboard using the async Clipboard API.
 */
function copyPreviewJSON() {
  const text = document.getElementById('preview-code').textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard.', 'ok');
  });
}


/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================
   showToast(msg, type) displays a brief notification at the bottom
   of the screen. The element starts off-screen (translateY(80px),
   opacity 0) and slides up via CSS transition when the "show" class
   is added. It auto-dismisses after 2.5 seconds.

   type: 'ok'   → green background (success)
         'warn' → amber background (warning / no-op)

   The _t property on the element stores the auto-dismiss timer ID so
   that rapid successive calls cancel the previous timer before setting
   a new one, preventing ghost dismissals.
   ============================================================ */
function showToast(msg, type = 'ok') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast toast-' + type + ' show';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.classList.remove('show'); }, 2500);
}


/* ============================================================
   PERSISTENCE — localStorage
   ============================================================
   The full application state (schema, items, and ID counters) is
   serialised to localStorage under the key "jsoncov_state" so that
   work survives a page refresh or accidental tab close.

   saveToStorage() — serialises the entire state object to JSON and
     writes it. Wrapped in try/catch because localStorage can be
     unavailable in private-browsing modes or when storage is full.

   loadFromStorage() — reads and deserialises the saved state on
     startup. Falls back to empty defaults if no saved state exists
     or if the JSON is corrupt.
   ============================================================ */

/** saveToStorage — persists the current state to localStorage. */
function saveToStorage() {
  try {
    localStorage.setItem('jsoncov_state', JSON.stringify({
      schema: state.schema,
      items: state.items,
      _sid: state._sid,
      _iid: state._iid,
    }));
  } catch(e) { /* storage unavailable — silently ignore */ }
}

/** loadFromStorage — restores state from localStorage on startup. */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem('jsoncov_state');
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.schema = saved.schema || [];
    state.items  = saved.items  || [];
    state._sid   = saved._sid   || 0;
    state._iid   = saved._iid   || 0;
  } catch(e) { /* corrupt data — silently ignore, state stays empty */ }
}


/* ============================================================
   AUTO-SAVE
   ============================================================
   scheduleAutosave() is called on every "input" and "change" event
   that bubbles up to the document. It debounces the actual write to
   localStorage by 800 ms — short enough to feel instant but long
   enough to batch rapid keystrokes into a single write.
   ============================================================ */
let saveTimer;
function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToStorage, 800);
}


/* ============================================================
   CLEAR ALL
   ============================================================
   confirmClearAll() resets both schema and items to empty arrays and
   clears the ID counters, then persists and re-renders. A native
   browser confirm() dialog guards against accidental clears.
   The function is a no-op if there is nothing to clear.
   ============================================================ */
function confirmClearAll() {
  if (state.items.length === 0 && state.schema.length === 0) return;
  if (confirm('Clear all schema fields and items? This cannot be undone.')) {
    state.schema = [];
    state.items  = [];
    state._sid   = 0;
    state._iid   = 0;
    saveToStorage();
    renderSchema();
    renderItems();
  }
}


/* ============================================================
   INITIALISATION
   ============================================================
   Runs once after the DOM is fully parsed (DOMContentLoaded).
   Order of operations:
     1. Restore any previously saved state from localStorage.
     2. Render both panels from the restored state (or empty state).
     3. Attach the global auto-save listeners.
     4. Attach modal-close listeners (backdrop click + Escape key).
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  /* 1. Restore saved state */
  loadFromStorage();

  /* 2. Initial render */
  renderSchema();
  renderItems();

  /* 3. Debounced auto-save on any user input anywhere on the page */
  document.addEventListener('input', scheduleAutosave);
  document.addEventListener('change', scheduleAutosave);

  /* 4a. Clicking the modal backdrop (outside the dialog box) closes it */
  document.getElementById('preview-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePreview();
  });

  /* 4b. Pressing Escape also closes the modal */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePreview();
  });
});
