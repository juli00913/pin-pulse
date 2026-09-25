import { getJSON, setJSON } from "./store.js";
import { DEFAULT_CONFIG } from "./pipeline.js";
import seed from "./seed-data.js";

// Fill an empty store with the first data pull so the site has content
// before the first scheduled refresh. Does nothing once runs exist.
export async function ensureSeeded() {
  const runs = await getJSON("runs");
  if (runs && runs.length) return false;
  await setJSON("pins:" + seed.date, seed.pins, 60 * 86400);
  await setJSON("pinindex", seed.pinindex);
  await setJSON("trends", seed.trends);
  await setJSON("state", seed.state);
  await setJSON("runs", seed.runs);
  if (!(await getJSON("config"))) await setJSON("config", DEFAULT_CONFIG);
  return true;
}
