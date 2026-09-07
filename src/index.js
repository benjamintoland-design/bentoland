export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Simple health endpoint so we can verify the Worker runtime and bindings
    // without exposing bucket contents or database data.
    if (url.pathname === "/api/health") {
      const bindings = {
        photos: Boolean(env.PHOTOS),
        database: Boolean(env.DB),
      };

      return Response.json({
        ok: bindings.photos && bindings.database,
        bindings,
      });
    }

    // All existing site routes continue to be served from /public unchanged.
    return env.ASSETS.fetch(request);
  },
};
