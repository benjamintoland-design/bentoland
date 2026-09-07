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
  // ADMIN_KEY is deliberately required until Cloudflare Access is configured.
  // This prevents /admin and write APIs from accidentally becoming public.
  if (!env.ADMIN_KEY) return false;
  const supplied = request.headers.get("x-admin-key") || "";
  return supplied === env.ADMIN_KEY;
}

function safeName(name = "photo") {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
}

function slugify(value = "photo") {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `photo-${Date.now()}`;
}

function adminPage() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ben Toland — Admin</title><style>
  :root{color-scheme:light;--paper:#f4f1ea;--ink:#151515;--muted:#74716a;--line:#d8d3ca}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(820px,calc(100% - 36px));margin:0 auto;padding:54px 0 90px}h1{font:400 clamp(42px,8vw,76px)/.95 Georgia,serif;margin:0 0 12px}p{color:var(--muted);line-height:1.6}.card{border-top:1px solid var(--line);padding-top:28px;margin-top:38px}label{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin:20px 0 7px}input,select,button{width:100%;font:inherit;padding:13px;border:1px solid var(--line);background:#fff}button{margin-top:24px;background:var(--ink);color:#fff;cursor:pointer}.row{display:grid;grid-template-columns:1fr 1fr;gap:16px}.check{display:flex;gap:10px;align-items:center;margin-top:18px}.check input{width:auto}.check label{margin:0}.status{margin-top:18px;font-size:13px;white-space:pre-wrap}@media(max-width:600px){.row{grid-template-columns:1fr}}</style></head><body><main class="wrap"><h1>Photo archive</h1><p>Private upload console for bentoland.com. Web JPEGs go to R2; metadata goes to D1. RAW/original attachment support is wired into the backend and can be exposed after authentication is finished.</p><div class="card"><p><strong>Locked for now.</strong> The storage backend is live, but uploads stay disabled until we add an admin secret or Cloudflare Access. That way there is never a public upload hole on your site.</p></div></main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
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

    if (url.pathname === "/api/admin/photos" && request.method === "POST") {
      if (!adminAuthorized(request, env)) return json({ error: "Admin authentication is not configured." }, { status: 403 });
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
