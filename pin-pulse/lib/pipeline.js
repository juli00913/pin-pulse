// Daily refresh: Pinterest trend searches (weekly) + top pins for a rotating
// set of searches (daily), fetched through Apify.
import { getJSON, setJSON } from "./store.js";

const TRENDS_ACTOR = "data_ops_main~pinterest-trends";
const PINS_ACTOR = "parseforge~pinterest-scraper";
const PRICE_TERM = 0.002;
const PRICE_PIN = 0.0025;
const DAY_KEY_TTL = 60 * 86400;

export const DEFAULT_CONFIG = {
  watchlist: [
    "chunky knit cardigan", "fair isle sweater", "cable knit sweater",
    "knit vest outfit", "mohair sweater", "crochet cardigan",
    "knitted scarf outfit", "knit beanie outfit", "oversized knit sweater",
    "cozy knitwear aesthetic", "knitted balaclava", "sweater vest pattern",
    "fall color palette", "winter fashion 2026", "scandinavian knit",
    "knit dress outfit",
  ],
  regions: ["US", "GB+IE", "DE+AT+CH", "FR"],
  interests: ["FASHION_WOMENS", "DIY_AND_CRAFTS", "HOME_DECOR"],
  trendTermsPerQuery: 7,
  trendsEveryDays: 7,
  watchTermsPerDay: 3,
  trendTermsPerDay: 1,
  pinsPerTerm: 12,
  keepPinsDays: 45,
  excludeWords: ["costume", "kids", "toddler", "toddlers", "baby", "babies", "maternelle",
    "crèche", "creche", "eyfs", "homecoming", "kindern", "kleinkindern"],
};

export const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);

async function apify(token, actor, input) {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=240`;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const j = await r.json();
      if (Array.isArray(j)) return j;
      console.error("apify unexpected", actor, JSON.stringify(j).slice(0, 300));
    } catch (e) { console.error("apify error", actor, e.message); }
  }
  return [];
}

export function pinImage(url) {
  if (!url || !url.includes("pinimg.com")) return url || null;
  return url.replace(/\/originals\/|\/\d+x\d*\//, "/474x/").replace(/\.(png|heic|webp|gif|jpeg)$/i, ".jpg");
}

export function pickTrendCandidates(allTerms, cfg) {
  const pri = { FASHION_WOMENS: 0, DIY_AND_CRAFTS: 1, HOME_DECOR: 2 };
  const rpri = Object.fromEntries(cfg.regions.map((r, i) => [r, i]));
  const excl = (cfg.excludeWords || []).map(w => w.toLowerCase());
  const ok = t => {
    const words = new Set(t.term.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
    return (t.count || 0) >= 20 && (t.m || 0) < 10000 && (t.w || 0) >= 0 && !excl.some(x => words.has(x));
  };
  const seen = new Set(), out = [];
  allTerms.filter(ok)
    .sort((a, b) => (pri[a.interest] ?? 3) - (pri[b.interest] ?? 3) || (rpri[a.region] ?? 9) - (rpri[b.region] ?? 9) || (b.m || 0) - (a.m || 0))
    .forEach(t => { const k = t.term.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push({ term: t.term, interest: t.interest, region: t.region, m: t.m }); } });
  return out.slice(0, 30);
}

export async function runRefresh({ token, date = today(), forceTrends = false, log = console.log } = {}) {
  const now = new Date().toISOString();
  const cfg = { ...DEFAULT_CONFIG, ...(await getJSON("config", {})) };
  const state = await getJSON("state", {});
  state.termLastSearched ||= {}; state.watchCursor ||= 0; state.latestTrending ||= []; state.costLog ||= {};
  const index = await getJSON("pinindex", {});      // id -> {h:{date:saves}, f:firstSeen, l:lastSeen}
  let trends = await getJSON("trends", []);
  let runs = await getJSON("runs", []);
  let cost = 0, trendsFetched = false;

  // ---- weekly trends (one Apify run per region, in parallel) ----
  const due = forceTrends || !state.lastTrendsRun || daysBetween(state.lastTrendsRun, date) >= cfg.trendsEveryDays;
  const trendsPromise = due ? Promise.all(cfg.regions.map(region =>
    apify(token, TRENDS_ACTOR, { country: region, interests: cfg.interests, trendType: "GROWING", maxTermsPerQuery: cfg.trendTermsPerQuery })
      .then(rows => ({ region, rows })))) : Promise.resolve([]);

  // ---- choose today's searches ----
  const watch = (cfg.watchlist || []).map(s => s.trim()).filter(Boolean);
  const picks = [];
  if (watch.length) {
    const cur = state.watchCursor % watch.length;
    for (let i = 0; i < Math.min(cfg.watchTermsPerDay, watch.length); i++) picks.push({ term: watch[(cur + i) % watch.length], source: "watchlist" });
    state.watchCursor = (cur + cfg.watchTermsPerDay) % watch.length;
  }

  const trendResults = await trendsPromise;
  if (trendResults.length) {
    const all = [];
    for (const { region, rows } of trendResults) {
      cost += rows.length * PRICE_TERM;
      const byInt = {};
      rows.forEach(r => (byInt[r.interest || "ALL"] ||= []).push(r));
      for (const [interest, rs] of Object.entries(byInt)) {
        const endDate = rs[0].endDate || date;
        const terms = rs.sort((a, b) => (a.rank || 99) - (b.rank || 99)).map(r => ({
          term: r.term, rank: r.rank, count: r.normalizedCount, w: r.weeklyChangePct, m: r.monthlyChangePct,
          y: r.yearlyChangePct, season: r.seasonalityScore,
        }));
        trends = trends.filter(t => !(t.endDate === endDate && t.region === region && t.interest === interest));
        trends.push({ endDate, region, interest, fetchedAt: now, terms });
        terms.forEach(t => all.push({ ...t, region, interest }));
      }
    }
    if (all.length) {
      trendsFetched = true;
      state.lastTrendsRun = date;
      state.latestTrending = pickTrendCandidates(all, cfg);
    }
    // keep ~26 weeks
    const weeks = [...new Set(trends.map(t => t.endDate))].sort().slice(-26);
    trends = trends.filter(t => weeks.includes(t.endDate));
  }

  let nTr = cfg.trendTermsPerDay;
  for (const c of state.latestTrending) {
    if (nTr <= 0) break;
    const last = state.termLastSearched[c.term.toLowerCase()];
    if (last && daysBetween(last, date) < 10) continue;
    if (picks.some(p => p.term.toLowerCase() === c.term.toLowerCase())) continue;
    picks.push({ term: c.term, source: "trending", interest: c.interest, region: c.region });
    nTr--;
  }

  // ---- pins (parallel, one run per search) ----
  const results = await Promise.all(picks.map(p => apify(token, PINS_ACTOR, { searchTerms: [p.term], maxItems: cfg.pinsPerTerm }).then(rows => ({ p, rows }))));
  if (picks.length && results.every(x => !x.rows.length) && !trendsFetched)
    throw new Error("Apify returned no data. Check APIFY_TOKEN and your Apify credit.");
  const touched = new Map(), termLog = [];
  for (const { p, rows } of results) {
    cost += rows.length * PRICE_PIN;
    state.termLastSearched[p.term.toLowerCase()] = date;
    termLog.push({ ...p, count: rows.length });
    for (const r of rows) {
      const id = String(r.pinId || "");
      if (!id || r.error) continue;
      const prevDoc = touched.get(id);
      const idx = index[id] || { h: {}, f: date };
      const saves = Number(r.saveCount || 0);
      const created = /^\d{4}-\d{2}-\d{2}/.test(r.createdAt || "") ? r.createdAt.slice(0, 10) : null;
      const age = created ? Math.max(1, daysBetween(created, date)) : 30;
      const prev = Object.entries(idx.h).filter(([d]) => d < date).sort().pop();
      const growth = prev ? Math.round((saves - prev[1]) / Math.max(1, daysBetween(prev[0], date)) * 100) / 100 : null;
      idx.h[date] = saves;
      idx.h = Object.fromEntries(Object.entries(idx.h).sort().slice(-30));
      idx.l = date;
      index[id] = idx;
      const na = v => (v == null || v === "N/A" ? null : v);
      touched.set(id, {
        id, title: (r.title || "").slice(0, 160), desc: (r.description || "").slice(0, 280),
        url: r.pinUrl, link: na(r.outboundLink), domain: na(r.linkDomain),
        saves, repins: Number(r.repinCount || 0), comments: Number(r.commentCount || 0),
        shares: Number(r.shareCount || 0), reactions: Number(r.reactionCount || 0),
        createdAt: created, ageDays: age, velocity: Math.round(saves / age * 1000) / 1000, growth,
        history: idx.h, firstSeen: idx.f, lastSeen: date,
        term: prevDoc?.term || p.term, terms: [...new Set([...(prevDoc?.terms || []), p.term])],
        source: prevDoc?.source || p.source, color: r.dominantColor || null,
        w: r.imageWidth || null, h: r.imageHeight || null,
        video: String(r.mediaType || "").toLowerCase() === "video",
        tags: (r.visualAnnotations || []).slice(0, 8), pinner: na(r.pinnerUsername), board: na(r.boardName),
        img: pinImage(r.imageUrl),
      });
    }
  }

  // prune index
  for (const [id, v] of Object.entries(index)) if (v.l && daysBetween(v.l, date) > cfg.keepPinsDays) delete index[id];

  cost = Math.round(cost * 10000) / 10000;
  const month = date.slice(0, 7);
  state.costLog[month] = Math.round(((state.costLog[month] || 0) + cost) * 10000) / 10000;
  state.costLog = Object.fromEntries(Object.entries(state.costLog).sort().slice(-6));
  state.termLastSearched = Object.fromEntries(Object.entries(state.termLastSearched).sort((a, b) => a[1] < b[1] ? -1 : 1).slice(-200));
  state.lastRun = date; state.lastRunAt = now;

  const run = { date, at: now, terms: termLog, pins: [...touched.keys()], trendsFetched, cost };
  runs = [run, ...runs.filter(r => r.date !== date)].slice(0, 60);

  // merge with pins already stored for the same day (a second run on one day)
  const existing = (await getJSON("pins:" + date, [])).filter(p => !touched.has(p.id));
  await setJSON("pins:" + date, [...existing, ...touched.values()], DAY_KEY_TTL);
  await setJSON("pinindex", index);
  await setJSON("trends", trends);
  await setJSON("runs", runs);
  await setJSON("state", state);
  if (!(await getJSON("config"))) await setJSON("config", DEFAULT_CONFIG);

  const summary = { date, pins: touched.size, terms: termLog, trendsFetched, cost, monthCost: state.costLog[month] };
  log(JSON.stringify(summary));
  return summary;
}
