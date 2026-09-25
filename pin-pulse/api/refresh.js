import { runRefresh } from "../lib/pipeline.js";
import { ensureSeeded } from "../lib/seed.js";

// Called by Vercel Cron every morning (see vercel.json).
// Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
// You can also trigger it by hand: /api/refresh?key=<ADMIN_PASSWORD>
export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const cronOk = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  const keyOk = process.env.ADMIN_PASSWORD && req.query?.key === process.env.ADMIN_PASSWORD;
  if (!cronOk && !keyOk) return res.status(401).json({ error: "Not allowed" });
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: "APIFY_TOKEN is not set in the Vercel project settings." });
  try {
    await ensureSeeded();
    const summary = await runRefresh({ token });
    res.status(200).json({ ok: true, ...summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
