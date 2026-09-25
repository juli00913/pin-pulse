// Tiny key-value store. Uses Upstash Redis over REST in production
// (Vercel Storage → Upstash for Redis sets KV_REST_API_URL / KV_REST_API_TOKEN),
// and a local JSON file when those are missing (for local testing).
import fs from "node:fs";
import path from "node:path";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = "pp:";

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Redis error: " + (j.error || r.status));
  return j.result;
}

const LOCAL_FILE = process.env.PP_LOCAL_STORE || path.join(process.cwd(), ".local-store.json");
function localRead() { try { return JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8")); } catch { return {}; } }
function localWrite(d) { fs.writeFileSync(LOCAL_FILE, JSON.stringify(d)); }

export const usingRedis = !!(URL_ && TOKEN);

export async function getJSON(key, fallback = null) {
  let raw;
  if (usingRedis) raw = await redis(["GET", PREFIX + key]);
  else raw = localRead()[PREFIX + key];
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export async function setJSON(key, value, ttlSeconds) {
  const s = JSON.stringify(value);
  if (usingRedis) {
    const cmd = ["SET", PREFIX + key, s];
    if (ttlSeconds) cmd.push("EX", String(ttlSeconds));
    await redis(cmd);
  } else {
    const d = localRead(); d[PREFIX + key] = s; localWrite(d);
  }
}

export async function getMany(keys) {
  if (!keys.length) return [];
  let raws;
  if (usingRedis) raws = await redis(["MGET", ...keys.map(k => PREFIX + k)]);
  else { const d = localRead(); raws = keys.map(k => d[PREFIX + k] ?? null); }
  return raws.map(r => { try { return r == null ? null : JSON.parse(r); } catch { return null; } });
}
