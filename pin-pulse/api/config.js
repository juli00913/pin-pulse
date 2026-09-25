import { getJSON, setJSON } from "../lib/store.js";
import { upgradeConfig } from "../lib/pipeline.js";
import { CATEGORIES } from "../lib/sources.js";

// Save sources (Pinterest ideas pages) and how many are read per day.
// Needs the ADMIN_PASSWORD set in Vercel.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: "Грешна парола" });
  const int = (v, lo, hi, d) => { const n = parseInt(v, 10); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); };
  const cur = upgradeConfig(await getJSON("config", {}));
  const c = body.config || {};
  let sources = cur.sources;
  if (Array.isArray(c.sources)) {
    const seen = new Set();
    sources = c.sources.map(s => {
      const m = String(s.url || "").match(/pinterest\.[a-z.]+\/ideas\/([^/?#]+)\/(\d+)/i);
      if (!m) return null;
      const url = `https://www.pinterest.com/ideas/${m[1]}/${m[2]}/`;
      if (seen.has(url)) return null; seen.add(url);
      if (!CATEGORIES[s.cat] && s.tab === "visuals") return null;
      const tab = s.tab === "visuals" ? "visuals" : "clothes";
      const cat = tab === "clothes" ? "knitwear" : (CATEGORIES[s.cat] && s.cat !== "knitwear" ? s.cat : "patterns");
      const name = String(s.name || decodeURIComponent(m[1]).replace(/-/g, " ")).slice(0, 60);
      return { tab, cat, name, url, on: s.on !== false };
    }).filter(Boolean).slice(0, 80);
    if (!sources.length) return res.status(400).json({ error: "Нужен е поне един източник" });
  }
  const next = {
    ...cur, configVersion: 3, sources,
    clothesPerDay: int(c.clothesPerDay, 0, 6, cur.clothesPerDay),
    visualsPerDay: int(c.visualsPerDay, 0, 6, cur.visualsPerDay),
  };
  await setJSON("config", next);
  res.status(200).json({ ok: true });
}
