// Daily refresh: reads a few Pinterest "ideas" pages (Pinterest's own most
// popular pins per topic) through Apify and stores the pins with their saves.
// Pages rotate, so every page is re-read every few days; pins seen again get a
// "saves gained per day" figure.
import { getJSON, setJSON } from "./store.js";
import { DEFAULT_SOURCES, REMOVED_CATEGORIES } from "./sources.js";

const ACTOR = "memo23~pinterest-scraper";
const PRICE_PIN = 0.00145;
const PRICE_RUN = 0.0086;
const DAY_KEY_TTL = 60 * 86400;
export const WINDOW_DAYS = { clothes: 14, visuals: 30 };

export const DEFAULT_CONFIG = {
  configVersion: 3,
  clothesPerDay: 2,   // ideas pages read per day for the clothes tab
  visualsPerDay: 2,   // ideas pages read per day for the visuals tab
  keepDays: 45,
  sources: DEFAULT_SOURCES,
};

// Saved settings with newer defaults applied (does not write).
export function upgradeConfig(stored = {}) {
  // v3 replaced search terms with ideas pages; older settings are dropped
  if ((stored?.configVersion || 1) < 3) return { ...DEFAULT_CONFIG };
  const c = { ...DEFAULT_CONFIG, ...stored };
  c.sources = (c.sources || []).filter(s => !REMOVED_CATEGORIES.includes(s.cat));
  return c;
}

export const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);

async function apify(token, input) {
  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=240`;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const j = await r.json();
      if (Array.isArray(j)) return j;
      console.error("apify unexpected", JSON.stringify(j).slice(0, 300));
    } catch (e) { console.error("apify error", e.message); }
  }
  return [];
}

function sized(url, size) {
  if (!url || !url.includes("pinimg.com")) return url || null;
  return url.replace(/\/(\d+x\d*|originals)\//, `/${size}/`);
}

// Turn one raw Apify item into the compact pin the page uses.
export function toPin(r, src, date, idx) {
  const id = String(r.id || "");
  if (!id || r.is_promoted) return null;
  const im = r.images || {};
  const base = (im["236x"] || im["474x"] || im.orig || {}).url || r.image_medium_url;
  const dims = im["236x"] || im.orig || {};
  const saves = Number(r.aggregated_pin_data?.aggregated_stats?.saves ?? r.repin_count ?? 0);
  const t = Date.parse(r.created_at || "");
  const created = isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
  const age = created ? Math.max(1, daysBetween(created, date)) : 30;
  const prev = idx[id];
  const hist = { ...(prev?.h || {}) };
  const last = Object.entries(hist).filter(([d]) => d < date).sort().pop();
  const growth = last ? Math.round((saves - last[1]) / Math.max(1, daysBetween(last[0], date)) * 10) / 10 : null;
  hist[date] = saves;
  idx[id] = { h: Object.fromEntries(Object.entries(hist).sort().slice(-20)), f: prev?.f || date, l: date };
  const title = (r.grid_title || r.title || r.seo_title || r.closeup_unified_description || r.description || "").trim();
  return {
    id, title: title.slice(0, 140), url: `https://www.pinterest.com/pin/${id}/`,
    link: r.link || null, domain: r.domain && r.domain !== "Uploaded by user" ? r.domain : null,
    saves, comments: Number(r.comment_count || 0), createdAt: created, ageDays: age,
    velocity: Math.round(saves / age * 100) / 100, growth,
    firstSeen: idx[id].f, lastSeen: date,
    tab: src.tab, cat: src.cat, source: src.name,
    color: r.dominant_color || null, w: dims.width || null, h: dims.height || null,
    video: !!r.is_video, img: sized(base, "474x"), big: sized(base, "736x"),
  };
}

function pickSources(cfg, state, tab, n) {
  const list = (cfg.sources || []).filter(s => s.on !== false && s.tab === tab);
  if (!list.length || n <= 0) return [];
  state.cursor ||= {};
  const cur = (state.cursor[tab] || 0) % list.length;
  const out = [];
  for (let i = 0; i < Math.min(n, list.length); i++) out.push(list[(cur + i) % list.length]);
  state.cursor[tab] = (cur + n) % list.length;
  return out;
}

// Fetch pins for the given sources: one Apify run per ideas page, at most 4 at
// a time (the free Apify plan allows 5 runs at once).
export async function fetchSources(token, sources, date, idx) {
  const results = [];
  for (let i = 0; i < sources.length; i += 4) {
    const batch = sources.slice(i, i + 4);
    results.push(...await Promise.all(batch.map(src =>
      apify(token, { startUrls: [{ url: src.url }], maxItems: 25 }).then(rows => ({ src, rows })))));
  }
  const pins = new Map(); let cost = 0; const log = [];
  for (const { src, rows } of results) {
    cost += rows.length * PRICE_PIN + PRICE_RUN;
    let n = 0;
    for (const r of rows) {
      const p = toPin(r, src, date, idx);
      if (p && !pins.has(p.id)) { pins.set(p.id, p); n++; }
    }
    log.push({ source: src.name, tab: src.tab, cat: src.cat, count: n });
  }
  return { pins, cost, log };
}

export async function runRefresh({ token, date = today(), sources = null, log = console.log } = {}) {
  const now = new Date().toISOString();
  const cfg = upgradeConfig(await getJSON("config", {}));
  const state = await getJSON("state", {});
  state.costLog ||= {};
  const idx = await getJSON("pinindex", {});
  let runs = await getJSON("runs", []);

  const picks = sources || [
    ...pickSources(cfg, state, "clothes", cfg.clothesPerDay),
    ...pickSources(cfg, state, "visuals", cfg.visualsPerDay),
  ];
  const { pins, cost: c, log: srcLog } = await fetchSources(token, picks, date, idx);
  if (picks.length && !pins.size) throw new Error("Apify returned no pins. Check APIFY_TOKEN and your Apify credit.");

  for (const [id, v] of Object.entries(idx)) if (v.l && daysBetween(v.l, date) > cfg.keepDays) delete idx[id];
  const cost = Math.round(c * 10000) / 10000;
  const month = date.slice(0, 7);
  state.costLog[month] = Math.round(((state.costLog[month] || 0) + cost) * 10000) / 10000;
  state.costLog = Object.fromEntries(Object.entries(state.costLog).sort().slice(-6));
  state.lastRun = date; state.lastRunAt = now; state.dataVersion = 3;

  const existing = (await getJSON("pins:" + date, [])).filter(p => p.tab && !pins.has(p.id));
  await setJSON("pins:" + date, [...existing, ...pins.values()], DAY_KEY_TTL);
  const prevRun = runs.find(r => r.date === date && r.v === 3);
  const run = {
    date, at: now, v: 3,
    sources: [...(prevRun?.sources || []), ...srcLog],
    pins: pins.size + (prevRun?.pins || 0),
    cost: Math.round(((prevRun?.cost || 0) + cost) * 10000) / 10000,
  };
  runs = [run, ...runs.filter(r => r.date !== date)].slice(0, 60);
  await setJSON("pinindex", idx);
  await setJSON("runs", runs);
  await setJSON("state", state);
  if (((await getJSON("config", {}))?.configVersion || 1) < 3) await setJSON("config", cfg);

  const summary = { date, pins: pins.size, sources: srcLog, cost, monthCost: state.costLog[month] };
  log(JSON.stringify(summary));
  return summary;
}
