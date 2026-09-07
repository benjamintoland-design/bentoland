const json = (data, init = {}) => Response.json(data, {
  ...init,
  headers: { 'cache-control': 'no-store', ...(init.headers || {}) }
});

async function ensureSchema(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT,
    category TEXT NOT NULL DEFAULT 'other',
    location TEXT,
    taken_at TEXT,
    camera TEXT,
    lens TEXT,
    focal_length TEXT,
    aperture TEXT,
    shutter_speed TEXT,
    iso TEXT,
    web_key TEXT NOT NULL,
    original_key TEXT,
    featured INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_photos_public ON photos(published,category,sort_order,created_at);`);
}

function suppliedAdminKey(request) {
  const direct = request.headers.get('x-admin-key');
  if (direct) return direct.trim();
  const auth = request.headers.get('authorization') || '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

function cookieValue(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return '';
}

async function sessionToken(env) {
  if (!env.ADMIN_KEY) return '';
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(env.ADMIN_KEY.trim()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode('bentoland-admin-session-v1')));
  let binary = '';
  for (const b of sig) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function adminAuthorized(request, env) {
  if (typeof env.ADMIN_KEY !== 'string' || !env.ADMIN_KEY.length) return false;
  const supplied = suppliedAdminKey(request);
  if (supplied && supplied === env.ADMIN_KEY.trim()) return true;
  const cookie = cookieValue(request, 'bt_admin');
  if (!cookie) return false;
  return cookie === await sessionToken(env);
}

function safeName(name = 'photo') {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'photo';
}

function slugify(value = 'photo') {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `photo-${Date.now()}`;
}

const fields = ['title','category','location','taken_at','camera','lens','focal_length','aperture','shutter_speed','iso','sort_order'];

const style = `:root{--paper:#f4f1ea;--ink:#151515;--muted:#74716a;--line:#d8d3ca;--red:#8d2c22}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(1080px,calc(100% - 34px));margin:auto;padding:48px 0 90px}h1{font:400 clamp(44px,8vw,78px)/.95 Georgia,serif;margin:0 0 12px}h2{font:400 30px/1.1 Georgia,serif;margin:0 0 10px}h3{font:400 22px/1.1 Georgia,serif;margin:0}.muted,p{color:var(--muted);line-height:1.55}.card{border-top:1px solid var(--line);padding-top:26px;margin-top:34px}.hidden{display:none!important}label{display:block;font-size:11px;letter-spacing:.11em;text-transform:uppercase;margin:15px 0 7px}input,select,button{width:100%;font:inherit;padding:12px;border:1px solid var(--line);background:#fff}button{background:var(--ink);color:#fff;cursor:pointer}.primary{margin-top:20px}.row{display:grid;grid-template-columns:1fr 1fr;gap:16px}.checks{display:flex;gap:24px;margin-top:18px;flex-wrap:wrap}.check{display:flex;gap:9px;align-items:center}.check input{width:auto}.check label{margin:0}.status{margin-top:14px;font-size:13px}.bad{color:var(--red)}.ok{color:#23662e}.toolbar{display:flex;gap:10px;align-items:center;margin:18px 0}.toolbar select{max-width:190px}.toolbar button{width:auto}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.photo{background:#fff;border:1px solid var(--line)}.photo img{width:100%;aspect-ratio:3/2;object-fit:cover;display:block;background:#ddd}.photoBody{padding:16px}.meta{font-size:12px;color:var(--muted);margin:5px 0 12px}.badges{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.badge{font-size:10px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line);padding:5px 7px}.actions{display:flex;gap:8px;margin-top:14px}.actions button{width:auto;flex:1}.secondary{background:#fff;color:var(--ink)}.danger{background:#fff;color:var(--red);border-color:#caa}.edit{border-top:1px solid var(--line);margin-top:14px;padding-top:2px}.empty{padding:35px 0;color:var(--muted)}.logout{display:inline-block;margin-top:12px;color:var(--muted);font-size:13px}@media(max-width:700px){.row,.grid{grid-template-columns:1fr}.toolbar{align-items:stretch;flex-direction:column}.toolbar select,.toolbar button{max-width:none;width:100%}}`;

function page(body, extraHead = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ben Toland — Photo Archive</title><style>${style}</style>${extraHead}</head><body><main class="wrap">${body}</main></body></html>`;
}

function loginPage(error = '') {
  const body = `<h1>Photo archive</h1><p>Private publishing console for bentoland.com.</p><section class="card"><h2>Unlock</h2><form method="post" action="/admin/login"><label>Admin key</label><input name="key" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required><button class="primary" type="submit">Unlock archive</button>${error ? `<div class="status bad">${error}</div>` : ''}</form></section>`;
  return new Response(page(body), { headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store, no-cache, must-revalidate', 'x-robots-tag':'noindex, nofollow' } });
}

function adminPage() {
  const body = `<h1>Photo archive</h1><p>Private publishing console for bentoland.com.</p><a class="logout" href="/admin/logout">Lock archive</a>
  <section class="card"><h2>Publish a photograph</h2><form id="uploadForm"><label>Web image</label><input name="web" type="file" accept="image/jpeg,image/png,image/webp" required><label>Original / RAW (optional)</label><input name="original" type="file"><div class="row"><div><label>Title</label><input name="title"></div><div><label>Category</label><select name="category"><option>wildlife</option><option>architecture</option><option>landscape</option><option selected>other</option><option>archive</option></select></div></div><div class="row"><div><label>Location</label><input name="location"></div><div><label>Date photographed</label><input name="taken_at" type="date"></div></div><div class="row"><div><label>Camera</label><input name="camera"></div><div><label>Lens</label><input name="lens"></div></div><div class="row"><div><label>Focal length</label><input name="focal_length"></div><div><label>Aperture</label><input name="aperture"></div></div><div class="row"><div><label>Shutter</label><input name="shutter_speed"></div><div><label>ISO</label><input name="iso"></div></div><div class="checks"><div class="check"><input id="published" type="checkbox" checked><label>Published</label></div><div class="check"><input id="featured" type="checkbox"><label>Featured</label></div></div><button class="primary" type="submit">Upload photograph</button><div id="uploadStatus" class="status"></div></form></section>
  <section class="card"><h2>Manage archive</h2><div class="toolbar"><select id="filter"><option value="all">All categories</option><option>wildlife</option><option>architecture</option><option>landscape</option><option>other</option><option>archive</option></select><button id="refresh" class="secondary" type="button">Refresh</button></div><div id="count" class="meta"></div><div id="photos" class="grid"></div><div id="manageStatus" class="status"></div></section>`;
  return new Response(page(body, '<script src="/admin.js" defer></script>'), { headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store, no-cache, must-revalidate', 'x-robots-tag':'noindex, nofollow' } });
}

async function addPhoto(form, env) {
  const web = form.get('web');
  const original = form.get('original');
  if (!(web instanceof File) || !web.type.startsWith('image/')) throw new Error('A web image is required.');
  const title = String(form.get('title') || web.name.replace(/\.[^.]+$/, ''));
  const slug = `${slugify(title)}-${crypto.randomUUID().slice(0,8)}`;
  const webKey = `web/${slug}/${safeName(web.name)}`;
  const originalKey = original instanceof File && original.size ? `originals/${slug}/${safeName(original.name)}` : null;
  await env.PHOTOS.put(webKey, web.stream(), { httpMetadata: { contentType: web.type } });
  if (originalKey) await env.PHOTOS.put(originalKey, original.stream(), { httpMetadata: { contentType: original.type || 'application/octet-stream' } });
  await env.DB.prepare('INSERT INTO photos (slug,title,category,location,taken_at,camera,lens,focal_length,aperture,shutter_speed,iso,web_key,original_key,featured,published) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(slug,title,String(form.get('category')||'other'),String(form.get('location')||''),String(form.get('taken_at')||''),String(form.get('camera')||''),String(form.get('lens')||''),String(form.get('focal_length')||''),String(form.get('aperture')||''),String(form.get('shutter_speed')||''),String(form.get('iso')||''),webKey,originalKey,form.get('featured')==='true'?1:0,form.get('published')==='true'?1:0).run();
  return slug;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      let schema = false;
      try { await ensureSchema(env.DB); schema = true; } catch {}
      return json({ ok: Boolean(env.PHOTOS) && Boolean(env.DB) && schema, bindings: { photos:Boolean(env.PHOTOS), database:Boolean(env.DB), schema }, adminSecretConfigured: typeof env.ADMIN_KEY === 'string' && env.ADMIN_KEY.length > 0 });
    }

    if (url.pathname === '/admin/login' && request.method === 'POST') {
      const form = await request.formData();
      const key = String(form.get('key') || '').trim();
      if (!env.ADMIN_KEY || key !== env.ADMIN_KEY.trim()) return loginPage('Invalid admin key.');
      const token = await sessionToken(env);
      return new Response(null, { status:303, headers:{ 'location':'/admin', 'set-cookie':`bt_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800` } });
    }

    if (url.pathname === '/admin/logout') {
      return new Response(null, { status:303, headers:{ 'location':'/admin', 'set-cookie':'bt_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' } });
    }

    if (url.pathname === '/admin' && request.method === 'GET') {
      return (await adminAuthorized(request, env)) ? adminPage() : loginPage();
    }

    if (url.pathname === '/api/admin/verify' && request.method === 'GET') {
      return (await adminAuthorized(request, env)) ? json({ok:true}) : json({error:env.ADMIN_KEY?'Invalid admin key.':'ADMIN_KEY is not reaching the Worker.'},{status:403});
    }

    if (url.pathname === '/api/photos' && request.method === 'GET') {
      await ensureSchema(env.DB);
      const category = url.searchParams.get('category');
      const stmt = category && category !== 'all'
        ? env.DB.prepare('SELECT id,slug,title,category,location,taken_at,camera,lens,focal_length,aperture,shutter_speed,iso,featured,created_at,updated_at FROM photos WHERE published=1 AND category=? ORDER BY featured DESC,sort_order DESC,created_at DESC').bind(category)
        : env.DB.prepare('SELECT id,slug,title,category,location,taken_at,camera,lens,focal_length,aperture,shutter_speed,iso,featured,created_at,updated_at FROM photos WHERE published=1 ORDER BY featured DESC,sort_order DESC,created_at DESC');
      const { results } = await stmt.all();
      return json({ photos: results.map(p => ({ ...p, image:`/media/${p.slug}?v=${encodeURIComponent(p.updated_at || p.created_at || '')}` })) });
    }

    if (url.pathname.startsWith('/media/') && request.method === 'GET') {
      await ensureSchema(env.DB);
      const slug = decodeURIComponent(url.pathname.slice(7));
      const row = await env.DB.prepare('SELECT web_key FROM photos WHERE slug=? AND published=1').bind(slug).first();
      if (!row) return new Response('Not found',{status:404});
      const obj = await env.PHOTOS.get(row.web_key);
      if (!obj) return new Response('Not found',{status:404});
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('etag',obj.httpEtag);
      headers.set('cache-control','public,max-age=86400');
      return new Response(obj.body,{headers});
    }

    if (url.pathname === '/api/admin/photos' && request.method === 'GET') {
      if (!(await adminAuthorized(request, env))) return json({error:'Unauthorized.'},{status:403});
      await ensureSchema(env.DB);
      const { results } = await env.DB.prepare('SELECT * FROM photos ORDER BY sort_order DESC,created_at DESC').all();
      return json({photos:results});
    }

    if (url.pathname.startsWith('/api/admin/media/') && request.method === 'GET') {
      if (!(await adminAuthorized(request, env))) return new Response('Unauthorized',{status:403});
      await ensureSchema(env.DB);
      const id = Number(url.pathname.split('/').pop());
      const row = await env.DB.prepare('SELECT web_key FROM photos WHERE id=?').bind(id).first();
      if (!row) return new Response('Not found',{status:404});
      const obj = await env.PHOTOS.get(row.web_key);
      if (!obj) return new Response('Not found',{status:404});
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('cache-control','private,no-store');
      return new Response(obj.body,{headers});
    }

    if (url.pathname === '/api/admin/photos' && request.method === 'POST') {
      if (!(await adminAuthorized(request, env))) return json({error:'Unauthorized.'},{status:403});
      await ensureSchema(env.DB);
      try { return json({ok:true,slug:await addPhoto(await request.formData(),env)}); }
      catch (e) { return json({error:e.message || 'Upload failed.'},{status:400}); }
    }

    const match = url.pathname.match(/^\/api\/admin\/photos\/(\d+)$/);
    if (match && request.method === 'PATCH') {
      if (!(await adminAuthorized(request, env))) return json({error:'Unauthorized.'},{status:403});
      await ensureSchema(env.DB);
      const id = Number(match[1]);
      const body = await request.json().catch(()=>({}));
      const current = await env.DB.prepare('SELECT * FROM photos WHERE id=?').bind(id).first();
      if (!current) return json({error:'Photograph not found.'},{status:404});
      const v = {};
      for (const f of fields) if (Object.hasOwn(body,f)) v[f] = f === 'sort_order' ? Number(body[f]) || 0 : String(body[f] ?? '');
      v.published = Object.hasOwn(body,'published') ? (body.published ? 1 : 0) : current.published;
      v.featured = Object.hasOwn(body,'featured') ? (body.featured ? 1 : 0) : current.featured;
      for (const f of fields) if (!Object.hasOwn(v,f)) v[f] = current[f];
      await env.DB.prepare('UPDATE photos SET title=?,category=?,location=?,taken_at=?,camera=?,lens=?,focal_length=?,aperture=?,shutter_speed=?,iso=?,sort_order=?,published=?,featured=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .bind(v.title,v.category,v.location,v.taken_at,v.camera,v.lens,v.focal_length,v.aperture,v.shutter_speed,v.iso,v.sort_order,v.published,v.featured,id).run();
      return json({ok:true});
    }

    if (match && request.method === 'DELETE') {
      if (!(await adminAuthorized(request, env))) return json({error:'Unauthorized.'},{status:403});
      await ensureSchema(env.DB);
      const id = Number(match[1]);
      const row = await env.DB.prepare('SELECT web_key,original_key FROM photos WHERE id=?').bind(id).first();
      if (!row) return json({error:'Photograph not found.'},{status:404});
      await env.PHOTOS.delete(row.web_key);
      if (row.original_key) await env.PHOTOS.delete(row.original_key);
      await env.DB.prepare('DELETE FROM photos WHERE id=?').bind(id).run();
      return json({ok:true});
    }

    return env.ASSETS.fetch(request);
  }
};