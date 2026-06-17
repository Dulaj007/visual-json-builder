# JSON Builder

A visual web application for creating structured JSON files without writing code.  
Define your schema once, fill in your data visually, then export a clean `data.json` file.

---

## Table of Contents

1. [Features](#features)
2. [Technology Stack](#technology-stack)
3. [How to Run](#how-to-run)
4. [Project Structure](#project-structure)
5. [Code Breakdown — Django Backend](#code-breakdown--django-backend)
   - [settings.py](#settingspy)
   - [urls.py (project)](#urlspy-project-level)
   - [urls.py (app)](#urlspy-app-level)
   - [views.py](#viewspy)
   - [apps.py](#appspy)
6. [Code Breakdown — Frontend](#code-breakdown--frontend)
   - [index.html](#indexhtml)
   - [style.css](#stylecss)
   - [app.js — State](#appjs--state)
   - [app.js — Schema Operations](#appjs--schema-operations)
   - [app.js — Item Operations](#appjs--item-operations)
   - [app.js — Rendering](#appjs--rendering)
   - [app.js — Export](#appjs--export)
   - [app.js — Persistence](#appjs--persistence)
   - [app.js — Initialisation](#appjs--initialisation)
7. [End-to-End Data Flow](#end-to-end-data-flow)
8. [Key Design Decisions](#key-design-decisions)

---

## Features

- **Schema designer** — define field names and types (`string`, `number`, `boolean`, `array`) before entering data
- **Visual item editor** — each item is a card with the correct input widget per field type
- **Array support** — array-type fields let you add/remove an unlimited list of string values inside a single field
- **Boolean toggle** — CSS-animated pill switch for true/false fields
- **Duplicate items** — clone any item instantly
- **Live JSON preview** — see the formatted output in a modal before downloading
- **Copy to clipboard** — copy the JSON directly from the preview
- **Export** — download `data.json` with one click
- **Auto-save** — work is saved to `localStorage` and survives a page refresh
- **Clear all** — reset everything with a confirmation guard
- **Responsive layout** — works on mobile, tablet, and desktop

---

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| **Web framework** | [Django 6](https://www.djangoproject.com/) | Serves the HTML template and static files; provides the `{% static %}` tag for asset URL resolution |
| **Templating** | Django Template Language (DTL) | One template, no database queries — DTL is used only for the `{% static %}` tag |
| **Frontend logic** | Vanilla JavaScript (ES2020) | Zero dependencies; the entire app fits in one file without a build step |
| **Styling** | Plain CSS with custom properties | CSS variables give a consistent design token system without Sass or a framework |
| **Persistence** | Browser `localStorage` | Client-side only — no database needed since all data is exported as a file |
| **Python** | Python 3.13 | Runtime for Django |

> **No npm, no webpack, no React, no database.** The stack is intentionally minimal — Django is a thin shell that serves one page; all interactivity lives in a single vanilla JS file.

---

## How to Run

### Prerequisites

- Python 3.10 or newer
- pip

### Steps

```bash
# 1. Clone or download the project
cd e:\Projects\jsoncov

# 2. (Optional but recommended) Create a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# 3. Install Django
pip install -r requirements.txt

# 4. Start the development server
python manage.py runserver

# 5. Open in your browser
#    http://127.0.0.1:8000/
```

> No `migrate` step is needed — this project has no database models.

### Typical Workflow

```
1. Add fields in the Schema panel   →  e.g.  id (string)  name (string)  songs (array)
2. Click "Add Item"                 →  a card appears with inputs for each field
3. Fill in the values               →  for array fields, click "+ Add entry" per value
4. Click "Preview" to inspect       →  see the formatted JSON before downloading
5. Click "Export JSON"              →  browser downloads  data.json
```

---

## Project Structure

```
jsoncov/                          ← project root (manage.py lives here)
│
├── manage.py                     ← Django CLI entry point
├── requirements.txt              ← pip dependencies (just Django)
├── README.md                     ← this file
│
├── jsoncov/                      ← project package (settings, root URLs, WSGI)
│   ├── __init__.py
│   ├── settings.py               ← Django configuration
│   ├── urls.py                   ← root URL dispatcher
│   └── wsgi.py                   ← WSGI entry point for deployment
│
└── builder/                      ← the single Django app
    ├── __init__.py
    ├── apps.py                   ← AppConfig (app metadata)
    ├── views.py                  ← one view: render index.html
    ├── urls.py                   ← one URL: '' → index view
    │
    ├── templates/
    │   └── builder/
    │       └── index.html        ← the single-page HTML shell
    │
    └── static/
        └── builder/
            ├── style.css         ← all visual styles
            └── app.js            ← all client-side logic
```

---

## Code Breakdown — Django Backend

Django's role here is intentionally thin: it serves one HTML file and resolves static asset URLs. There are no models, no forms, no sessions, and no database.

---

### `settings.py`

```python
INSTALLED_APPS = [
    'django.contrib.staticfiles',   # ← serves /static/ in development
    'builder',                       # ← our app
]
```

**Why only two apps?**  
`django.contrib.staticfiles` enables automatic static file serving when `DEBUG=True`. Without it, Django would not serve `style.css` or `app.js` — you would have to set up Nginx or another server just to serve those two files locally.

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]
```

**Why so few middleware?**  
The standard Django project includes session, auth, CSRF, and message middleware. All of those support features (login, forms, flash messages) that this app does not use. Removing them slightly reduces the per-request overhead and avoids confusing entries in Django's system check output.

```python
TEMPLATES = [{
    'APP_DIRS': True,
    ...
}]
```

**`APP_DIRS: True`** tells Django to look for templates inside each app's `templates/` subdirectory automatically. Because of this, the file at `builder/templates/builder/index.html` is reachable as `'builder/index.html'` in any `render()` call — without listing an absolute path in `DIRS`.

```python
STATIC_URL = '/static/'
```

This sets the URL prefix for all static assets. When the template contains `{% static 'builder/style.css' %}`, Django renders it as `/static/builder/style.css`. In development, `django.contrib.staticfiles` intercepts requests to `/static/...` and serves the file from the matching app's `static/` folder.

---

### `urls.py` (project level)

```python
from django.urls import path, include

urlpatterns = [
    path('', include('builder.urls')),
]
```

The project URL file has one job: delegate **all** URL matching to the `builder` app. The empty string prefix `''` means the builder app's patterns are mounted at the site root — `http://localhost:8000/` maps directly to the builder index.

`include()` is used rather than a direct `path()` here because it keeps the project-level file clean and makes it easy to add a second app (e.g. an API at `/api/`) later without touching the builder's own URL list.

---

### `urls.py` (app level)

```python
from django.urls import path
from . import views

app_name = 'builder'

urlpatterns = [
    path('', views.index, name='index'),
]
```

- **`app_name = 'builder'`** — registers a URL namespace. This means the URL can be reversed as `{% url 'builder:index' %}` in templates rather than hard-coding `'/'`. If the app is ever mounted under a different prefix (e.g. `/builder/`), only this file needs to change.
- **`path('', views.index, name='index')`** — matches the bare root URL (no trailing path) and calls `views.index`.

---

### `views.py`

```python
from django.shortcuts import render

def index(request):
    return render(request, 'builder/index.html')
```

This is the simplest possible Django view:

1. `render()` loads the named template (`builder/index.html`).
2. It processes the `{% load static %}` and `{% static '...' %}` tags to produce correct asset URLs.
3. It returns the rendered HTML as an `HttpResponse` with status 200.

No context dictionary is passed because the template has no server-side dynamic content — every variable on the page is managed by JavaScript after the page loads.

---

### `apps.py`

```python
class BuilderConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'builder'
```

`AppConfig` is the standard way to give Django metadata about an app. The two fields here:

- **`name`** — must match the string used in `INSTALLED_APPS` exactly.
- **`default_auto_field`** — specifies the field type for auto-created primary keys. Even though this app has no models yet, setting this prevents Django's system check from emitting a warning, and pre-configures the right type if models are added later.

---

## Code Breakdown — Frontend

The entire frontend is three files: one HTML template, one CSS file, and one JavaScript file. There is no build process — the browser receives them as-is.

---

### `index.html`

The template is a standard HTML5 document with three notable features:

**1. Django static tag**

```django
{% load static %}
...
<link rel="stylesheet" href="{% static 'builder/style.css' %}" />
...
<script src="{% static 'builder/app.js' %}"></script>
```

`{% load static %}` must appear before any `{% static %}` tag. At render time Django replaces `{% static 'builder/style.css' %}` with the resolved URL (e.g. `/static/builder/style.css`). This indirection means the URL prefix can be changed in `settings.py` without touching the template.

**2. JavaScript anchor IDs**

The HTML provides several empty elements that JavaScript populates at runtime:

```html
<div class="schema-fields-list" id="schema-fields">...</div>
<span class="badge-count" id="schema-count">0</span>

<div id="items-container">...</div>
<span class="badge-count" id="items-count">0</span>

<pre class="code-block" id="preview-code"></pre>
<div class="toast" id="toast"></div>
```

None of these contain permanent content. `app.js` calls `document.getElementById()` on each of them and replaces their `innerHTML` whenever state changes.

**3. Script at bottom of `<body>`**

```html
<script src="{% static 'builder/app.js' %}"></script>
</body>
```

Placing the `<script>` tag at the very end of `<body>` (rather than in `<head>`) means the browser has already parsed and built the DOM before executing JavaScript. This is a reliable alternative to `defer` and ensures that every `getElementById()` call in `app.js` will find its target element immediately.

**The modal structure**

```html
<div class="modal-backdrop" id="preview-modal">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-header">...</div>
    <div class="modal-body">
      <pre class="code-block" id="preview-code"></pre>
    </div>
    <div class="modal-footer">...</div>
  </div>
</div>
```

The backdrop is the full-screen dimmed overlay; the inner `.modal` is the dialog box. Accessibility attributes (`role="dialog"`, `aria-modal`, `aria-labelledby`) tell screen readers how to treat the element. The backdrop is `display: none` by default; adding the `.open` class switches it to `display: flex`, which also centres the inner `.modal` via flexbox alignment.

---

### `style.css`

The stylesheet is structured in 16 sections. Here are the most important ideas:

**CSS Custom Properties (design tokens)**

```css
:root {
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --primary-light: #eef2ff;
  --border: #e2e8f0;
  --shadow: 0 4px 16px rgba(0,0,0,0.08);
  --radius: 10px;
  ...
}
```

Every colour, shadow, and radius in the file references one of these variables. This means:
- A theme change requires editing only `:root`, not hundreds of scattered declarations.
- Components inherit consistent visual rhythm without any pre-processor like Sass.

**Schema row grid layout**

```css
.schema-row {
  display: grid;
  grid-template-columns: 20px 1fr 140px auto;
}
```

Each schema field row uses a 4-column grid:
- Column 1 (20px) — drag handle icon
- Column 2 (1fr) — name input, grows to fill available space
- Column 3 (140px) — type select, fixed width for visual alignment across all rows
- Column 4 (auto) — remove button, just wide enough to fit

This creates a table-like alignment without using `<table>`.

**Auto-fill items grid**

```css
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
```

`auto-fill` + `minmax(300px, 1fr)` is a CSS pattern that creates as many columns as fit at 300 px minimum, then grows all columns equally to fill the row. Result: 3 columns on a wide screen, 2 on a medium screen, 1 on mobile — without a single `@media` query for the grid itself.

**CSS-only toggle switch**

```css
.toggle input[type="checkbox"] { display: none; }

.toggle-slider { /* pill track */ }
.toggle-slider::after { /* white thumb */ }

.toggle input:checked + .toggle-slider { background: var(--primary); }
.toggle input:checked + .toggle-slider::after { left: 18px; }
```

The real checkbox is hidden. The visible toggle is a `<span class="toggle-slider">` that immediately follows the hidden checkbox in the DOM. The CSS adjacent sibling combinator (`+`) makes `:checked` state on the hidden input control the appearance of the visible span — no JavaScript needed for the visual animation.

**Custom `<select>` arrow**

```css
.select {
  appearance: none;  /* remove OS-native arrow */
  background-image: url("data:image/svg+xml,...");  /* inject custom SVG chevron */
  background-position: right 10px center;
  padding-right: 30px;  /* reserve space for the custom arrow */
}
```

`appearance: none` strips the browser's built-in dropdown arrow. A custom chevron SVG is embedded as a data URI in `background-image`. This gives consistent appearance across Chrome, Firefox, Safari, and Edge.

**Modal open/close**

```css
.modal-backdrop           { display: none; }
.modal-backdrop.open      { display: flex; }
```

The modal is toggled by adding/removing the `.open` class from JavaScript. `display: flex` is used (not `block`) so the inner `.modal` can be vertically and horizontally centred using `align-items: center` and `justify-content: center` on the backdrop.

---

### `app.js` — State

```javascript
const state = {
  schema: [],   // [{id, name, type}]
  items: [],    // [{id, data: {fieldId: value}}]
  _sid: 0,      // last schema field ID issued
  _iid: 0,      // last item ID issued
};
```

**Why a single `state` object?**  
All application data lives in one place. This makes debugging straightforward (inspect `state` in DevTools), persistence simple (`JSON.stringify(state)` captures everything), and prevents the subtle bugs that arise from keeping related data in separate variables.

**Why are items keyed by field ID, not field name?**

```javascript
// item.data stores values by numeric schema ID
item.data = {
  1: 'The Beatles',  // field id=1, name='artist'
  2: ['Hey Jude'],   // field id=2, name='songs'
}
```

If items were keyed by field name (`item.data['artist']`) then renaming the `artist` field to `band` in the schema would silently break all existing values. By using the numeric ID as the key, renaming a field in the schema has zero effect on stored data — the mapping from ID → current name happens only at export time.

**ID counters**

```javascript
function nextSid() { return ++state._sid; }
function nextIid() { return ++state._iid; }
```

These monotonically increasing integers are used as primary keys for schema fields and items. They are persisted to `localStorage` alongside the data so that IDs never repeat across sessions, even after items are deleted.

---

### `app.js` — Schema Operations

**Adding a field**

```javascript
function addSchemaField() {
  const field = { id: nextSid(), name: '', type: 'string' };
  state.schema.push(field);

  // give every existing item the default value for this new field
  state.items.forEach(item => {
    item.data[field.id] = getDefault('string');
  });

  renderSchema();
  renderItems();
}
```

Adding a field must also update every existing item — otherwise items would have an `undefined` value for the new field when they are next rendered. `getDefault()` produces the correct empty value for each type:

```javascript
function getDefault(type) {
  if (type === 'number')  return 0;
  if (type === 'boolean') return false;
  if (type === 'array')   return [];
  return '';   // string
}
```

**Removing a field**

```javascript
function removeSchemaField(fid) {
  state.schema = state.schema.filter(f => f.id !== fid);
  state.items.forEach(item => delete item.data[fid]);
  renderSchema();
  renderItems();
}
```

`delete item.data[fid]` removes the orphaned key from every item so no ghost data accumulates over time.

**Renaming a field (surgical DOM patch)**

```javascript
function onFieldNameInput(fid, value) {
  const field = state.schema.find(f => f.id === fid);
  field.name = value;

  // patch label spans in item cards WITHOUT rebuilding the whole DOM
  document.querySelectorAll(`[data-flabel="${fid}"]`).forEach(el => {
    el.textContent = value || `field_${fid}`;
  });
}
```

Rebuilding the entire items panel on every keystroke would reset the cursor position inside any input the user is currently typing in. Instead, `onFieldNameInput` only updates the `<span data-flabel="N">` label elements — tiny, targeted patches that do not disturb any inputs.

**Changing a field's type**

```javascript
function onFieldTypeChange(fid, newType) {
  const field = state.schema.find(f => f.id === fid);
  field.type = newType;

  // reset all item values to the new type's default
  state.items.forEach(item => {
    item.data[fid] = getDefault(newType);
  });
  renderItems();
}
```

A type change is intentionally destructive — the stored value format is incompatible between types (e.g. a string `"42"` cannot be reused as an array `[]`). Resetting to the default is safer than silently corrupting the data.

---

### `app.js` — Item Operations

**Adding an item**

```javascript
function addItem() {
  const item = { id: nextIid(), data: {} };
  state.schema.forEach(f => {
    item.data[f.id] = getDefault(f.type);
  });
  state.items.push(item);
  renderItems();
}
```

Every new item starts with the correct default for every current schema field. Because defaults are populated upfront, `renderFieldInput()` can always safely read `item.data[field.id]` without checking for `undefined`.

**Duplicating an item**

```javascript
function duplicateItem(iid) {
  const src = state.items.find(i => i.id === iid);
  const copy = {
    id: nextIid(),
    data: JSON.parse(JSON.stringify(src.data))  // deep clone
  };
  const idx = state.items.findIndex(i => i.id === iid);
  state.items.splice(idx + 1, 0, copy);  // insert immediately after source
  renderItems();
}
```

`JSON.parse(JSON.stringify(...))` is used for the deep clone because `src.data` may contain arrays (for array-type fields). A shallow copy (`{ ...src.data }`) would make the array values shared by reference — editing an entry in the copy would also change the source.

**Array entry management**

```javascript
function addArrayEntry(iid, fid) {
  const item = state.items.find(i => i.id === iid);
  item.data[fid].push('');   // append empty string to the array
  renderItems();
  setTimeout(() => {
    // focus the newly rendered input after the DOM rebuilds
    const entries = document.querySelectorAll(`[data-ae="${iid}-${fid}"]`);
    entries[entries.length - 1].focus();
  }, 0);
}
```

The `setTimeout(..., 0)` defers the focus call until after `renderItems()` has finished rebuilding the DOM. Without the timeout, `querySelectorAll` would run before the new `<input>` element exists.

---

### `app.js` — Rendering

**Overview of the rendering strategy**

| Change | What is re-rendered |
|---|---|
| Add / remove schema field | Both panels (full rebuild) |
| Change field type | Items panel only (full rebuild) |
| Rename a field | Labels only (surgical patch via `data-flabel`) |
| Add / remove item | Items panel only (full rebuild) |
| Type into a string/number input | State only — no render |
| Toggle a boolean | State only — no render |
| Add / remove array entry | Items panel only (full rebuild) |
| Type into an array entry | State only — no render |

The rule is: **re-render only when structure changes, not on every keystroke**.

**`renderSchema()`**

```javascript
function renderSchema() {
  const container = document.getElementById('schema-fields');
  document.getElementById('schema-count').textContent = state.schema.length;

  if (state.schema.length === 0) {
    container.innerHTML = `<div class="schema-empty">...</div>`;
    return;
  }

  container.innerHTML = state.schema.map(f => `
    <div class="schema-row" data-schema-id="${f.id}">
      ...
    </div>
  `).join('');
}
```

The function builds one HTML string using `Array.map().join('')` and assigns it to `innerHTML` in a single operation. This is faster than creating DOM nodes one by one and appending them individually.

**`renderFieldInput(item, field)`**

This function returns a different HTML snippet depending on the field type:

```javascript
switch (field.type) {
  case 'boolean':
    // hidden checkbox + CSS-animated slider
    return `<label class="toggle">...</label>`;

  case 'number':
    // native number input, value coerced at export
    return `<input type="number" .../>`;

  case 'array':
    // list of text rows + "Add entry" button
    const rows = entries.map((entry, i) => `
      <div class="array-entry">
        <input ... data-ae="${iid}-${fid}" .../>
        <button ... onclick="removeArrayEntry(${iid}, ${fid}, ${i})">...</button>
      </div>
    `).join('');
    return `<div class="array-field">${rows}<button ...>Add entry</button></div>`;

  default: // string
    return `<input type="text" .../>`;
}
```

Each `onclick` and `oninput` attribute embeds the item ID and field ID as numeric literals into the HTML string. When the browser calls the handler, those numbers are passed as arguments directly — no event delegation or data attribute lookup is needed.

**`renderItems()`**

```javascript
container.innerHTML = `<div class="items-grid">
  ${state.items.map((item, idx) => `
    <div class="item-card" data-item-id="${item.id}">
      <div class="item-card-header">
        <span class="item-number">Item #${idx + 1}</span>
        ...
      </div>
      <div class="item-fields">
        ${state.schema.map(f => `
          <div class="item-field">
            <label class="field-label">
              <span data-flabel="${f.id}">${f.name}</span>
              <span class="type-tag type-${f.type}">${f.type}</span>
            </label>
            ${renderFieldInput(item, f)}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')}
</div>`;
```

Note that the item label shows `idx + 1` (sequential display number, always 1 to N with no gaps) rather than `item.id` (internal unique ID that may skip numbers after deletions).

---

### `app.js` — Export

**`buildExportData()`**

```javascript
function buildExportData() {
  return state.items.map(item => {
    const obj = {};
    state.schema.forEach(f => {
      const key = f.name.trim() || `field_${f.id}`;  // fallback if name is blank
      obj[key] = coerce(item.data[f.id], f.type);     // convert to correct JS type
    });
    return obj;
  });
}
```

**`coerce(val, type)`** converts raw stored values to their proper JavaScript types:

```javascript
function coerce(val, type) {
  if (type === 'number')  return isNaN(Number(val)) ? 0 : Number(val);
  if (type === 'boolean') return Boolean(val);
  if (type === 'array')   return Array.isArray(val) ? val : [];
  return String(val ?? '');  // string
}
```

Number inputs return strings via `.value`; coercion at export time (rather than on every keystroke) keeps the input responsive and avoids jarring cursor jumps when the user is mid-edit.

**`exportJSON()`**

```javascript
function exportJSON() {
  const data = buildExportData();
  const json = JSON.stringify(data, null, 2);       // pretty-print with 2-space indent

  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);           // temporary in-memory URL

  const a = document.createElement('a');
  a.href     = url;
  a.download = 'data.json';                         // suggested filename
  document.body.appendChild(a);
  a.click();                                        // trigger browser download dialog
  document.body.removeChild(a);
  URL.revokeObjectURL(url);                         // release memory immediately
}
```

The download is triggered entirely client-side via a temporary `<a>` element with a `download` attribute. No server round-trip is needed. `URL.revokeObjectURL()` frees the memory backing the Blob as soon as the click is dispatched.

---

### `app.js` — Persistence

**Saving**

```javascript
function saveToStorage() {
  try {
    localStorage.setItem('jsoncov_state', JSON.stringify({
      schema: state.schema,
      items:  state.items,
      _sid:   state._sid,
      _iid:   state._iid,
    }));
  } catch(e) { /* storage unavailable — silently ignore */ }
}
```

The `try/catch` handles two failure cases:
- `localStorage` is unavailable (private browsing in some browsers, or sandboxed iframes).
- The storage quota is exceeded (very large datasets).

In both cases the app continues working — data simply won't persist across refreshes.

**Debounced auto-save**

```javascript
let saveTimer;

function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToStorage, 800);
}

// registered in the init block:
document.addEventListener('input', scheduleAutosave);
document.addEventListener('change', scheduleAutosave);
```

Listening at the `document` level (event delegation) catches every input event from every field without attaching individual listeners to each dynamically created input. The 800 ms debounce batches rapid keystrokes into a single `localStorage` write, avoiding performance issues on slower devices.

**Loading**

```javascript
function loadFromStorage() {
  try {
    const raw   = localStorage.getItem('jsoncov_state');
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.schema = saved.schema || [];
    state.items  = saved.items  || [];
    state._sid   = saved._sid   || 0;
    state._iid   = saved._iid   || 0;
  } catch(e) { /* corrupt data — ignore, start fresh */ }
}
```

The `|| []` and `|| 0` fallbacks guard against partially written or malformed JSON in storage — for example, if the browser tab was closed mid-save.

---

### `app.js` — Initialisation

```javascript
document.addEventListener('DOMContentLoaded', () => {

  // 1. Restore saved state from localStorage (or start empty)
  loadFromStorage();

  // 2. Render both panels from the restored (or empty) state
  renderSchema();
  renderItems();

  // 3. Attach global auto-save listeners (event delegation)
  document.addEventListener('input', scheduleAutosave);
  document.addEventListener('change', scheduleAutosave);

  // 4a. Click on the modal backdrop (not the dialog) → close
  document.getElementById('preview-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePreview();
  });

  // 4b. Escape key → close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePreview();
  });

});
```

`DOMContentLoaded` fires after the HTML is parsed but before images and stylesheets finish loading — the earliest safe moment to query the DOM. Since `app.js` is at the bottom of `<body>` the DOM is already parsed by the time the script runs, but the listener is kept for clarity and correctness.

The modal backdrop click handler uses `e.target === e.currentTarget` to distinguish a click on the dark overlay (close the modal) from a click anywhere inside the white dialog box (do nothing). Without this check, clicking inside the modal body would bubble up and close it.

---

## End-to-End Data Flow

Here is the complete journey from user action to exported JSON:

```
User clicks "Add Field"
  │
  ▼
addSchemaField()
  ├── creates { id: 3, name: '', type: 'string' }
  ├── pushes to state.schema
  ├── loops state.items → sets item.data[3] = ''  for each existing item
  ├── calls renderSchema()  → rebuilds schema panel HTML
  └── calls renderItems()   → rebuilds items panel HTML (labels now include new field)

User types "songs" into the new field's name input
  │
  ▼
oninput → onFieldNameInput(3, 'songs')
  ├── state.schema[2].name = 'songs'
  └── patches every [data-flabel="3"] span text → 'songs'  (no full re-render)

User changes type dropdown to "array"
  │
  ▼
onchange → onFieldTypeChange(3, 'array')
  ├── state.schema[2].type = 'array'
  ├── loops state.items → resets item.data[3] = []  for each item
  └── calls renderItems()  → rebuilds items panel with array input widgets

User clicks "+ Add entry" inside an item's songs field
  │
  ▼
addArrayEntry(itemId=1, fieldId=3)
  ├── state.items[0].data[3].push('')
  ├── calls renderItems()
  └── setTimeout → focuses the new <input data-ae="1-3">

User types "Hey Jude" into the new entry input
  │
  ▼
oninput → onArrayEntryInput(1, 3, 0, 'Hey Jude')
  └── state.items[0].data[3][0] = 'Hey Jude'   (no re-render)

User clicks "Export JSON"
  │
  ▼
exportJSON()
  └── buildExportData()
        ├── for each item:
        │     for each schema field:
        │       key = field.name  ('songs')
        │       value = coerce(item.data[3], 'array')  → ['Hey Jude']
        │     → { songs: ['Hey Jude'], ... }
        └── returns array of plain objects
  ├── JSON.stringify(data, null, 2)
  ├── Blob → createObjectURL → <a download="data.json"> → click
  └── revokeObjectURL
```

---

## Key Design Decisions

### No build step

Using vanilla JavaScript means the project has zero dependencies beyond Python and Django. There is no `package.json`, no `node_modules`, no webpack configuration to maintain, and no transpilation step. A new contributor can clone the repo and run the app in under 60 seconds.

### localStorage instead of a database

The app's data belongs to the user and exists only while they are building their JSON file. Storing it server-side would require authentication, a database schema, and API endpoints — enormous complexity for no real benefit. `localStorage` gives session persistence (survive a refresh) while keeping the architecture completely stateless on the server.

### Field IDs as data keys (not field names)

Storing item values under numeric field IDs rather than field name strings decouples the stored data from the schema definition. The user can freely rename fields at any time without losing data, because the mapping from ID to current name is resolved only at export time inside `buildExportData()`.

### innerHTML rebuild vs. virtual DOM

The rendering approach used here (rebuild `innerHTML` from state on structural changes, patch the DOM surgically for text changes) is the manual version of what React's virtual DOM does automatically. For an app of this size it is perfectly sufficient and avoids the overhead of importing and learning a framework.

### Type coercion at export, not at input time

Raw values are stored as strings (from `<input>` elements) and converted to their proper JavaScript types only when `buildExportData()` runs. This means:
- Number inputs don't snap partial values like `"1."` to `1` while the user is still typing.
- Boolean values stored by the checkbox handler are already correct booleans.
- Array entries remain strings (JSON arrays of strings is the most common use case).
