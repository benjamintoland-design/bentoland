const json = (data, init = {}) => Response.json(data, { headers: { "cache-control": "no-store", ...(init.headers || {}) }, ...init });

async function ensureSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
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
    CREATE INDEX IF NOT EXISTS idx_photos_public ON photos(published, category, sort_order, created_at);
  `);
}

function adminAuthorized(request, env) {
  if (!env.ADMIN_KEY) return false;
  return (request.headers.get("x-admin-key") || "") === env.ADMIN_KEY;
}

function safeName(name = "photo") {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
}

function slugify(value = "photo") {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `photo-${Date.now()}`;
}

function adminPage() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ben Toland — Photo Archive</title><style>
  :root{color-scheme:light;--paper:#f4f1ea;--ink:#151515;--muted:#74716a;--line:#d8d3ca;--white:#fff}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(920px,calc(100% - 34px));margin:0 auto;padding:48px 0 90px}h1{font:400 clamp(44px,8vw,78px)/.95 Georgia,serif;margin:0 0 12px}h2{font:400 30px/1.1 Georgia,serif;margin:0 0 10px}p{color:var(--muted);line-height:1.55}.card{border-top:1px solid var(--line);padding-top:26px;margin-top:34px}.hidden{display:none!important}label{display:block;font-size:11px;letter-spacing:.11em;text-transform:uppercase;margin:18px 0 7px}input,select,button,textarea{width:100%;font:inherit;padding:13px;border:1px solid var(--line);background:var(--white);border-radius:0}button{margin-top:20px;background:var(--ink);color:#fff;border-color:var(--ink);cursor:pointer}button.secondary{background:transparent;color:var(--ink)}.row{display:grid;grid-template-columns:1fr 1fr;gap:16px}.checks{display:flex;gap:24px;flex-wrap:wrap;margin-top:18px}.check{display:flex;gap:9px;align-items:center}.check input{width:auto}.check label{margin:0}.status{margin-top:16px;font-size:13px;white-space:pre-wrap}.ok{color:#23662e}.bad{color:#8d2c22}.tiny{font-size:12px}.photo-list{display:grid;gap:10px;margin-top:18px}.photo{background:#fff;border:1px solid var(--line);padding:12px 14px;display:flex;justify-content:space-between;gap:18px}.photo b{font-weight:600}.photo small{color:var(--muted)}@media(max-width:650px){.row{grid-template-columns:1fr}.wrap{padding-top:32px}.photo{display:block}}</style></head><body><main class="wrap"><h1>Photo archive</h1><p>Private publishing console for bentoland.com. Export a finished JPEG from Lightroom, upload it here, and optionally attach the original RAW for safekeeping.</p>

<section id="lock" class="card"><h2>Unlock</h2><p>Enter the private admin key. It is kept only for this browser session.</p><label for="key">Admin key</label><input id="key" type="password" autocomplete="current-password"><button id="unlock">Unlock archive</button><div id="lockStatus" class="status"></div></section>

<section id="console" class="hidden"><div class="card"><h2>Publish a photograph</h2><form id="uploadForm"><label>Web image</label><input name="web" type="file" accept="image/jpeg,image/png,image/webp" required><p class="tiny">Use your finished Lightroom export here. JPEG is ideal.</p><label>Original / RAW <span style="text-transform:none;letter-spacing:0">(optional)</span></label><input name="original" type="file"><div class="row"><div><label>Title</label><input name="title" placeholder="Untitled"></div><div><label>Category</label><select name="category"><option value="wildlife">Wildlife</option><option value="architecture">Architecture</option><option value="landscape">Landscape</option><option value="other" selected>Other</option><option value="archive">Archive</option></select></div></div><div class="row"><div><label>Location</label><input name="location" placeholder="Northern Utah"></div><div><label>Date photographed</label><input name="taken_at" type="date"></div></div><div class="row"><div><label>Camera</label><input name="camera" placeholder="Sony A7R VI"></div><div><label>Lens</label><input name="lens" placeholder="FE 200-600mm F5.6-6.3 G OSS"></div></div><div class="row"><div><label>Focal length</label><input name="focal_length" placeholder="600 mm"></div><div><label>Aperture</label><input name="aperture" placeholder="f/6.3"></div></div><div class="row"><div><label>Shutter</label><input name="shutter_speed" placeholder="1/2000 s"></div><div><label>ISO</label><input name="iso" placeholder="800"></div></div><div class="checks"><div class="check"><input id="published" name="published" type="checkbox" checked><label for="published">Publish immediately</label></div><div class="check"><input id="featured" name="featured" type="checkbox"><label for="featured">Featured</label></div></div><button type="submit">Upload photograph</button><div id="uploadStatus" class="status"></div></form></div><div class="card"><h2>Archive</h2><button id="refresh" class="secondary" type="button">Refresh list</button><div id="photoList" class="photo-list"></div></div></section>
<script>
const lock=document.getElementById('lock'),panel=document.getElementById('console'),keyInput=document.getElementById('key'),lockStatus=document.getElementById('lockStatus'),uploadStatus=document.getElementById('uploadStatus'),list=document.getElementById('photoList');let key=sessionStorage.getItem('bentoland-admin-key')||'';keyInput.value=key;
async function api(path,opts={}){opts.headers={...(opts.headers||{}),'x-admin-key':key};return fetch(path,opts)}
async function unlock(){key=keyInput.value.trim();lockStatus.textContent='Checking…';lockStatus.className='status';const r=await api('/api/admin/verify');if(r.ok){sessionStorage.setItem('bentoland-admin-key',key);lock.classList.add('hidden');panel.classList.remove('hidden');await loadPhotos()}else{lockStatus.textContent='Nope — that key did not work.';lockStatus.className='status bad'}}
document.getElementById('unlock').onclick=unlock;keyInput.addEventListener('keydown',e=>{if(e.key==='Enter')unlock()});
async function loadPhotos(){const r=await api('/api/admin/photos');if(!r.ok)return;const data=await r.json();list.innerHTML=data.photos.length?data.photos.map(p=>'<div class="photo"><div><b>'+esc(p.title||'Untitled')+'</b><br><small>'+esc(p.category)+' · '+(p.published?'Published':'Draft')+(p.featured?' · Featured':'')+'</small></div><small>'+esc(p.taken_at||p.created_at.slice(0,10))+'</small></div>').join(''):'<p>No photographs uploaded yet.</p>'}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
document.getElementById('refresh').onclick=loadPhotos;
document.getElementById('uploadForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);f.set('published',document.getElementById('published').checked?'true':'false');f.set('featured',document.getElementById('featured').checked?'true':'false');uploadStatus.textContent='Uploading… keep this tab open.';uploadStatus.className='status';const r=await api('/api/admin/photos',{method:'POST',body:f});const data=await r.json().catch(()=>({}));if(r.ok){uploadStatus.textContent='Uploaded ✓';uploadStatus.className='status ok';e.currentTarget.reset();document.getElementById('published').checked=true;await loadPhotos()}else{uploadStatus.textContent=data.error||'Upload failed.';uploadStatus.className='status bad'}});
if(key)unlock();
</script></main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      let databaseReady = false;
      try { await ensureSchema(env.DB); databaseReady = true; } catch (_) {}
      return json({ ok: Boolean(env.PHOTOS) && Boolean(env.DB) && databaseReady, bindings: { photos: Boolean(env.PHOTOS), database: Boolean(env.DB), schema: databaseReady } });
    }

    if (url.pathname === "/api/photos" && request.method === "GET") {
      await ensureSchema(env.DB);
      const category = url.searchParams.get("category");
      const stmt = category && category !== "all"
        ? env.DB.prepare("SELECT id,slug,title,category,location,taken_at,camera,lens,focal_length,aperture,shutter_speed,iso,featured,created_at FROM photos WHERE published=1 AND category=? ORDER BY featured DESC, sort_order DESC, created_at DESC").bind(category)
        : env.DB.prepare("SELECT id,slug,title,category,location,taken_at,camera,lens,focal_length,aperture,shutter_speed,iso,featured,created_at FROM photos WHERE published=1 ORDER BY featured DESC, sort_order DESC, created_at DESC");
      const { results } = await stmt.all();
      return json({ photos: results.map(p => ({ ...p, image: `/media/${p.slug}` })) });
    }

    if (url.pathname.startsWith("/media/") && request.method === "GET") {
      await ensureSchema(env.DB);
      const slug = decodeURIComponent(url.pathname.slice(7));
      const row = await env.DB.prepare("SELECT web_key FROM photos WHERE slug=? AND published=1").bind(slug).first();
      if (!row) return new Response("Not found", { status: 404 });
      const object = await env.PHOTOS.get(row.web_key);
      if (!object) return new Response("Not found", { status: 404 });
      const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); headers.set("cache-control", "public, max-age=86400");
      return new Response(object.body, { headers });
    }

    if (url.pathname === "/admin") return adminPage();

    if (url.pathname === "/api/admin/verify" && request.method === "GET") {
      return adminAuthorized(request, env) ? json({ ok: true }) : json({ error: env.ADMIN_KEY ? "Invalid admin key." : "ADMIN_KEY is not configured." }, { status: 403 });
    }

    if (url.pathname === "/api/admin/photos" && request.method === "GET") {
      if (!adminAuthorized(request, env)) return json({ error: "Unauthorized." }, { status: 403 });
      await ensureSchema(env.DB);
      const { results } = await env.DB.prepare("SELECT id,slug,title,category,location,taken_at,featured,published,created_at FROM photos ORDER BY created_at DESC").all();
      return json({ photos: results });
    }

    if (url.pathname === "/api/admin/photos" && request.method === "POST") {
      if (!adminAuthorized(request, env)) return json({ error: "Unauthorized." }, { status: 403 });
      await ensureSchema(env.DB);
      const form = await request.formData();
      const web = form.get("web");
      const original = form.get("original");
      if (!(web instanceof File) || !web.type.startsWith("image/")) return json({ error: "A web image is required." }, { status: 400 });
      const title = String(form.get("title") || web.name.replace(/\.[^.]+$/, ""));
      const slug = `${slugify(String(form.get("slug") || title))}-${crypto.randomUUID().slice(0, 8)}`;
      const webKey = `web/${slug}/${safeName(web.name)}`;
      const originalKey = original instanceof File && original.size ? `originals/${slug}/${safeName(original.name)}` : null;
      await env.PHOTOS.put(webKey, web.stream(), { httpMetadata: { contentType: web.type } });
      if (originalKey) await env.PHOTOS.put(originalKey, original.stream(), { httpMetadata: { contentType: original.type || "application/octet-stream" } });
      await env.DB.prepare(`INSERT INTO photos (slug,title,category,location,taken_at,camera,lens,focal_length,aperture,shutter_speed,iso,web_key,original_key,featured,published) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(slug,title,String(form.get("category")||"other"),String(form.get("location")||""),String(form.get("taken_at")||""),String(form.get("camera")||""),String(form.get("lens")||""),String(form.get("focal_length")||""),String(form.get("aperture")||""),String(form.get("shutter_speed")||""),String(form.get("iso")||""),webKey,originalKey,form.get("featured")==="true"?1:0,form.get("published")==="true"?1:0).run();
      return json({ ok: true, slug });
    }

    return env.ASSETS.fetch(request);
  },
};
