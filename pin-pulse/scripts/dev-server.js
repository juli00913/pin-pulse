// Local preview: serves public/ and the api/ routes like Vercel does.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("public");
const types = { ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".js": "text/javascript", ".json": "application/json" };
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) {
    const mod = await import(path.resolve("api", u.pathname.slice(5).replace(/\/$/, "") + ".js"));
    let body = ""; for await (const c of req) body += c;
    req.query = Object.fromEntries(u.searchParams); req.body = body;
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
    return mod.default(req, res);
  }
  const f = path.join(root, u.pathname === "/" ? "index.html" : u.pathname);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", types[path.extname(f)] || "application/octet-stream");
  fs.createReadStream(f).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
