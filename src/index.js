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

function suppliedAdminKey(request) {
  const header = request.headers.get("x-admin-key");
  if (header) return header.trim();
  const auth = request.headers.get("authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

function adminAuthorized(request, env) {
  if (typeof env.ADMIN_KEY !== "string" || !env.ADMIN_KEY.length) return false;
  return suppliedAdminKey(request) === env.ADMIN_KEY.trim();
}

function safeName(name = "photo") { return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "photo"; }
function slugify(value = "photo") { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `photo-${Date.now()}`; }

function adminPage() {
return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ben Toland — Photo Archive</title><style>:root{--paper:#f4f1ea;--ink:#151515;--muted:#74716a;--line:#d8d3ca}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(920px,calc(100% - 34px));margin:auto;padding:48px 0 90px}h1{font:400 clamp(44px,8vw,78px)/.95 Georgia,serif;margin:0 0 12px}h2{font:400 30px/1.1 Georgia,serif}p{color:var(--muted);line-height:1.55}.card{border-top:1px solid var(--line);padding-top:26px;margin-top:34px}.hidden{display:none!important}label{display:block;font-size:11px;letter-spacing:.11em;text-transform:uppercase;margin:18px 0 7px}input,select,button{width:100%;font:inherit;padding:13px;border:1px solid var(--line);background:#fff}button{margin-top:20px;background:var(--ink);color:#fff;cursor:pointer}.row{display:grid;grid-template-columns:1fr 1fr;gap:16px}.checks{display:flex;gap:24px;margin-top:18px}.check{display:flex;gap:9px;align-items:center}.check input{width:auto}.check label{margin:0}.status{margin-top:16px;font-size:13px}.bad{color:#8d2c22}.ok{color:#23662e}@media(max-width:650px){.row{grid-template-columns:1fr}}</style></head><body><main class="wrap"><h1>Photo archive</h1><p>Private publishing console for bentoland.com.</p><section id="lock" class="card"><h2>Unlock</h2><label>Admin key</label><input id="key" type="password" autocomplete="off" autocapitalize="none" spellcheck="false"><button id="unlock">Unlock archive</button><div id="lockStatus" class="status"></div></section><section id="console" class="hidden"><div class="card"><h2>Publish a photograph</h2><form id="uploadForm"><label>Web image</label><input name="web" type="file" accept="image/jpeg,image/png,image/webp" required><label>Original / RAW (optional)</label><input name="original" type="file"><div class="row"><div><label>Title</label><input name="title"></div><div><label>Category</label><select name="category"><option>wildlife</option><option>architecture</option><option>landscape</option><option selected>other</option><option>archive</option></select></div></div><div class="row"><div><label>Location</label><input name="location"></div><div><label>Date photographed</label><input name="taken_at" type="date"></div></div><div class="row"><div><label>Camera</label><input name="camera"></div><div><label>Lens</label><input name="lens"></div></div><div class="row"><div><label>Focal length</label><input name="focal_length"></div><div><label>Aperture</label><input name="aperture"></div></div><div class="row"><div><label>Shutter</label><input name="shutter_speed"></div><div><label>ISO</label><input name="iso"></div></div><div class="checks"><div class="check"><input id="published" type="checkbox" checked><label>Publish immediately</label></div><div class="check"><input id="featured" type="checkbox"><label>Featured</label></div></div><button>Upload photograph</button><div id="uploadStatus" class="status"></div></form></div></section><script>const lock=document.querySelector('#lock'),panel=document.querySelector('#console'),ki=document.querySelector('#key'),ls=document.querySelector('#lockStatus');let key=sessionStorage.getItem('bentoland-admin-key')||'';ki.value=key;async function call(path,opts={}){opts.headers={...(opts.headers||{}),Authorization:'Bearer '+key};return fetch(path,opts)}async function unlock(){key=ki.value.trim();ls.textContent='Checking…';try{const r=await call('/api/admin/verify?ts='+Date.now(),{cache:'no-store'});const d=await r.json();if(r.ok){sessionStorage.setItem('bentoland-admin-key',key);lock.classList.add('hidden');panel.classList.remove('hidden');ls.textContent=''}else{ls.textContent=d.error||'Key rejected.';ls.className='status bad'}}catch(e){ls.textContent='Could not reach the admin API.';ls.className='status bad'}}document.querySelector('#unlock').onclick=unlock;ki.onkeydown=e=>{if(e.key==='Enter')unlock()};document.querySelector('#uploadForm').onsubmit=async e=>{e.preventDefault();const s=document.querySelector('#uploadStatus'),f=new FormData(e.currentTarget);f.set('published',document.querySelector('#published').checked?'true':'false');f.set('featured',document.querySelector('#featured').checked?'true':'false');s.textContent='Uploading…';const r=await call('/api/admin/photos',{method:'POST',body:f});const d=await r.json().catch(()=>({}));s.textContent=r.ok?'Uploaded ✓':(d.error||'Upload failed');s.className='status '+(r.ok?'ok':'bad')};if(key)unlock();</script></main></body></html>`,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store, no-cache, must-revalidate","x-robots-tag":"noindex, nofollow"}});
}

export default { async fetch(request, env) {
  const url=new URL(request.url);
  if(url.pathname==="/api/health"){let schema=false;try{await ensureSchema(env.DB);schema=true}catch{}return json({ok:Boolean(env.PHOTOS)&&Boolean(env.DB)&&schema,bindings:{photos:Boolean(env.PHOTOS),database:Boolean(env.DB),schema},adminSecretConfigured:typeof env.ADMIN_KEY==="string"&&env.ADMIN_KEY.length>0});}
  if(url.pathname==="/api/photos"&&request.method==="GET"){await ensureSchema(env.DB);const category=url.searchParams.get("category");const stmt=category&&category!=="all"?env.DB.prepare("SELECT id,slug,title,category,location,taken_at,camera,lens,focal_length,aperture,shutter_speed,iso,featured,created_at FROM photos WHERE published=1 AND category=? ORDER BY featured DESC,sort_order DESC,created_at DESC").bind(category):env.DB.prepare("SELECT id,slug,title,category,location,taken_at,camera,lens,focal_length,aperture,shutter_speed,iso,featured,created_at FROM photos WHERE published=1 ORDER BY featured DESC,sort_order DESC,created_at DESC");const {results}=await stmt.all();return json({photos:results.map(p=>({...p,image:`/media/${p.slug}`}))});}
  if(url.pathname.startsWith("/media/")&&request.method==="GET"){await ensureSchema(env.DB);const slug=decodeURIComponent(url.pathname.slice(7));const row=await env.DB.prepare("SELECT web_key FROM photos WHERE slug=? AND published=1").bind(slug).first();if(!row)return new Response("Not found",{status:404});const object=await env.PHOTOS.get(row.web_key);if(!object)return new Response("Not found",{status:404});const h=new Headers();object.writeHttpMetadata(h);h.set("etag",object.httpEtag);h.set("cache-control","public,max-age=86400");return new Response(object.body,{headers:h});}
  if(url.pathname==="/admin")return adminPage();
  if(url.pathname==="/api/admin/verify"&&request.method==="GET")return adminAuthorized(request,env)?json({ok:true}):json({error:env.ADMIN_KEY?"Invalid admin key.":"ADMIN_KEY is not reaching the Worker."},{status:403});
  if(url.pathname==="/api/admin/photos"&&request.method==="POST"){if(!adminAuthorized(request,env))return json({error:"Unauthorized."},{status:403});await ensureSchema(env.DB);const form=await request.formData(),web=form.get("web"),original=form.get("original");if(!(web instanceof File)||!web.type.startsWith("image/"))return json({error:"A web image is required."},{status:400});const title=String(form.get("title")||web.name.replace(/\.[^.]+$/,"")),slug=`${slugify(title)}-${crypto.randomUUID().slice(0,8)}`,webKey=`web/${slug}/${safeName(web.name)}`,originalKey=original instanceof File&&original.size?`originals/${slug}/${safeName(original.name)}`:null;await env.PHOTOS.put(webKey,web.stream(),{httpMetadata:{contentType:web.type}});if(originalKey)await env.PHOTOS.put(originalKey,original.stream(),{httpMetadata:{contentType:original.type||"application/octet-stream"}});await env.DB.prepare("INSERT INTO photos (slug,title,category,location,taken_at,camera,lens,focal_length,aperture,shutter_speed,iso,web_key,original_key,featured,published) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(slug,title,String(form.get("category")||"other"),String(form.get("location")||""),String(form.get("taken_at")||""),String(form.get("camera")||""),String(form.get("lens")||""),String(form.get("focal_length")||""),String(form.get("aperture")||""),String(form.get("shutter_speed")||""),String(form.get("iso")||""),webKey,originalKey,form.get("featured")==="true"?1:0,form.get("published")==="true"?1:0).run();return json({ok:true,slug});}
  return env.ASSETS.fetch(request);
}};
