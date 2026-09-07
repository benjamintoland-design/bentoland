const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const cats = ['wildlife','architecture','landscape','other','archive'];
let all = [];

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function api(path, options = {}) {
  const r = await fetch(path, { credentials: 'same-origin', ...options });
  if (r.status === 401 || r.status === 403) {
    location.href = '/admin';
    throw new Error('Session expired');
  }
  return r;
}

async function load() {
  const status = $('#manageStatus');
  status.textContent = 'Loading…';
  try {
    const r = await api('/api/admin/photos', { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Could not load archive');
    all = d.photos || [];
    status.textContent = '';
    render();
  } catch (e) {
    status.textContent = e.message || 'Could not load archive';
    status.className = 'status bad';
  }
}

function render() {
  const filter = $('#filter').value;
  const items = filter === 'all' ? all : all.filter(p => p.category === filter);
  $('#count').textContent = `${items.length} photograph${items.length === 1 ? '' : 's'}`;
  $('#photos').innerHTML = items.length ? items.map(card).join('') : '<div class="empty">Nothing here yet.</div>';
}

function card(p) {
  return `<article class="photo" data-id="${p.id}">
    <img src="/api/admin/media/${p.id}?v=${encodeURIComponent(p.updated_at || '')}" alt="">
    <div class="photoBody">
      <h3>${esc(p.title || 'Untitled')}</h3>
      <div class="meta">${esc(p.category)}${p.taken_at ? ' · ' + esc(p.taken_at) : ''}${p.location ? ' · ' + esc(p.location) : ''}</div>
      <div class="badges">
        <span class="badge">${p.published ? 'Published' : 'Hidden'}</span>
        ${p.featured ? '<span class="badge">Featured</span>' : ''}
        ${p.original_key ? '<span class="badge">RAW stored</span>' : ''}
      </div>
      <div class="actions">
        <button class="secondary" data-action="edit" data-id="${p.id}">Edit</button>
        <button class="secondary" data-action="publish" data-id="${p.id}">${p.published ? 'Unpublish' : 'Publish'}</button>
        <button class="danger" data-action="delete" data-id="${p.id}">Delete</button>
      </div>
      <div id="edit-${p.id}" class="edit hidden">${editForm(p)}</div>
    </div>
  </article>`;
}

function editForm(p) {
  return `<label>Title</label><input data-f="title" value="${esc(p.title)}">
  <div class="row"><div><label>Category</label><select data-f="category">${cats.map(c => `<option ${c === p.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div><div><label>Date</label><input data-f="taken_at" type="date" value="${esc(p.taken_at)}"></div></div>
  <div class="row"><div><label>Location</label><input data-f="location" value="${esc(p.location)}"></div><div><label>Camera</label><input data-f="camera" value="${esc(p.camera)}"></div></div>
  <div class="row"><div><label>Lens</label><input data-f="lens" value="${esc(p.lens)}"></div><div><label>Focal length</label><input data-f="focal_length" value="${esc(p.focal_length)}"></div></div>
  <div class="row"><div><label>Aperture</label><input data-f="aperture" value="${esc(p.aperture)}"></div><div><label>Shutter</label><input data-f="shutter_speed" value="${esc(p.shutter_speed)}"></div></div>
  <div class="row"><div><label>ISO</label><input data-f="iso" value="${esc(p.iso)}"></div><div><label>Sort order</label><input data-f="sort_order" type="number" value="${esc(p.sort_order)}"></div></div>
  <div class="checks"><div class="check"><input data-f="published" type="checkbox" ${p.published ? 'checked' : ''}><label>Published</label></div><div class="check"><input data-f="featured" type="checkbox" ${p.featured ? 'checked' : ''}><label>Featured</label></div></div>
  <button class="primary" data-action="save" data-id="${p.id}">Save changes</button>`;
}

$('#uploadForm').addEventListener('submit', async e => {
  e.preventDefault();
  const status = $('#uploadStatus');
  const form = new FormData(e.currentTarget);
  form.set('published', $('#published').checked ? 'true' : 'false');
  form.set('featured', $('#featured').checked ? 'true' : 'false');
  status.textContent = 'Uploading…';
  status.className = 'status';
  try {
    const r = await api('/api/admin/photos', { method: 'POST', body: form });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    status.textContent = 'Uploaded ✓';
    status.className = 'status ok';
    e.currentTarget.reset();
    $('#published').checked = true;
    await load();
  } catch (e) {
    status.textContent = e.message || 'Upload failed';
    status.className = 'status bad';
  }
});

$('#photos').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const p = all.find(x => x.id === id);
  if (!p) return;
  if (btn.dataset.action === 'edit') {
    $(`#edit-${id}`).classList.toggle('hidden');
    return;
  }
  if (btn.dataset.action === 'publish') {
    const r = await api(`/api/admin/photos/${id}`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({published:!Boolean(p.published)}) });
    if (r.ok) await load();
    return;
  }
  if (btn.dataset.action === 'save') {
    const box = $(`#edit-${id}`);
    const data = {};
    $$('[data-f]', box).forEach(el => data[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value);
    const r = await api(`/api/admin/photos/${id}`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify(data) });
    if (r.ok) await load();
    return;
  }
  if (btn.dataset.action === 'delete') {
    if (!confirm(`Delete “${p.title || 'this photograph'}” from the archive? This also deletes its web image and stored RAW/original.`)) return;
    const r = await api(`/api/admin/photos/${id}`, { method:'DELETE' });
    if (r.ok) await load();
  }
});

$('#filter').addEventListener('change', render);
$('#refresh').addEventListener('click', load);
load();
