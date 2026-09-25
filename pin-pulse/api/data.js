import { getJSON, getMany } from "../lib/store.js";
import { ensureSeeded } from "../lib/seed.js";
import { upgradeConfig, WINDOW_DAYS } from "../lib/pipeline.js";
import { CATEGORIES, REMOVED_CATEGORIES } from "../lib/sources.js";

// Everything the page needs in one call: ?tab=clothes (last 14 days) or
// ?tab=visuals (last 30 days). Each pin appears once, with its latest figures.
export default async function handler(req, res) {
  try {
    await ensureSeeded();
    const [runs, rawConfig, state] = await Promise.all([getJSON("runs", []), getJSON("config", {}), getJSON("state", {})]);
    const config = upgradeConfig(rawConfig);
    const tab = req.query?.tab === "visuals" ? "visuals" : "clothes";
    const v3 = runs.filter(r => r.v === 3);
    let pins = [];
    if (v3.length) {
      const latest = v3[0].date;
      const dates = v3.map(r => r.date).filter(d => (Date.parse(latest) - Date.parse(d)) / 864e5 < WINDOW_DAYS[tab]);
      const lists = await getMany(dates.map(d => "pins:" + d));
      const byId = new Map();
      lists.flat().filter(p => p && p.tab === tab && !REMOVED_CATEGORIES.includes(p.cat)).forEach(p => {
        const o = byId.get(p.id);
        if (!o || o.lastSeen < p.lastSeen) byId.set(p.id, p);
      });
      pins = [...byId.values()];
    }
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json({
      tab, windowDays: WINDOW_DAYS[tab], runs: v3.slice(0, 30), pins, categories: CATEGORIES,
      config: { clothesPerDay: config.clothesPerDay, visualsPerDay: config.visualsPerDay, sources: config.sources },
      state: { costLog: state.costLog || {}, lastRunAt: state.lastRunAt || null, cursor: state.cursor || {} },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
