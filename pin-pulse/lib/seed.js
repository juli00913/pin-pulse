import { getJSON, setJSON } from "./store.js";
import seed from "./seed-data.js";

// Load the first fill of the ideas-page version once, so the site has content
// before the first daily refresh. Runs for a new store and for stores from the
// older search-based version (state.dataVersion < 3).
export async function ensureSeeded() {
  const state = await getJSON("state", {});
  if ((state.dataVersion || 0) >= 3) return false;
  const key = "pins:" + seed.date;
  const existing = (await getJSON(key, [])).filter(p => p.tab);
  const ids = new Set(seed.pins.map(p => p.id));
  await setJSON(key, [...existing.filter(p => !ids.has(p.id)), ...seed.pins], 60 * 86400);
  await setJSON("pinindex", { ...(await getJSON("pinindex", {})), ...seed.pinindex });
  const runs = await getJSON("runs", []);
  const run = { date: seed.date, at: new Date().toISOString(), v: 3, sources: seed.log, pins: seed.pins.length, cost: seed.cost };
  await setJSON("runs", [run, ...runs.filter(r => r.date !== seed.date)].slice(0, 60));
  const month = seed.date.slice(0, 7);
  state.costLog ||= {};
  state.costLog[month] = Math.round(((state.costLog[month] || 0) + seed.cost) * 10000) / 10000;
  state.dataVersion = 3;
  state.lastRunAt ||= run.at;
  await setJSON("state", state);
  return true;
}
