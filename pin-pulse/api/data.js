import { getJSON, getMany } from "../lib/store.js";
import { ensureSeeded } from "../lib/seed.js";
import { DEFAULT_CONFIG } from "../lib/pipeline.js";

// Everything the page needs in one call. ?range=day (latest refresh) or week.
export default async function handler(req, res) {
  try {
    await ensureSeeded();
    const [runs, trends, config, state] = await Promise.all([
      getJSON("runs", []), getJSON("trends", []), getJSON("config", DEFAULT_CONFIG), getJSON("state", {}),
    ]);
    const range = req.query?.range === "week" ? "week" : "day";
    let pins = [];
    if (runs.length) {
      const latest = runs[0].date;
      const dates = range === "day" ? [latest]
        : runs.map(r => r.date).filter(d => (Date.parse(latest) - Date.parse(d)) / 864e5 <= 6);
      const lists = await getMany(dates.map(d => "pins:" + d));
      const byId = new Map();
      lists.flat().filter(Boolean).forEach(p => { const o = byId.get(p.id); if (!o || o.lastSeen < p.lastSeen) byId.set(p.id, p); });
      pins = [...byId.values()];
    }
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json({
      range, runs: runs.slice(0, 30), trends, pins,
      config: { watchlist: config.watchlist, watchTermsPerDay: config.watchTermsPerDay, trendTermsPerDay: config.trendTermsPerDay,
        pinsPerTerm: config.pinsPerTerm, regions: config.regions, interests: config.interests,
        trendTermsPerQuery: config.trendTermsPerQuery, trendsEveryDays: config.trendsEveryDays },
      state: { watchCursor: state.watchCursor || 0, costLog: state.costLog || {}, lastRunAt: state.lastRunAt || null },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
