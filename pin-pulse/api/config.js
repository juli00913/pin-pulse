import { getJSON, setJSON } from "../lib/store.js";
import { DEFAULT_CONFIG } from "../lib/pipeline.js";

// Save watchlist + daily budget. Needs the ADMIN_PASSWORD set in Vercel.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: "Wrong password" });
  const int = (v, lo, hi, d) => { const n = parseInt(v, 10); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); };
  const cur = { ...DEFAULT_CONFIG, ...(await getJSON("config", {})) };
  const c = body.config || {};
  const next = {
    ...cur,
    watchlist: Array.isArray(c.watchlist)
      ? [...new Set(c.watchlist.map(s => String(s).trim().toLowerCase().slice(0, 80)).filter(Boolean))].slice(0, 100)
      : cur.watchlist,
    watchTermsPerDay: int(c.watchTermsPerDay, 0, 20, cur.watchTermsPerDay),
    trendTermsPerDay: int(c.trendTermsPerDay, 0, 10, cur.trendTermsPerDay),
    pinsPerTerm: int(c.pinsPerTerm, 3, 50, cur.pinsPerTerm),
  };
  await setJSON("config", next);
  res.status(200).json({ ok: true });
}
