// Paper Tech production server — zero dependencies.
//  • Serves the built app from ../dist
//  • Proxies /api/chat to the Anthropic Messages API so your key stays on the server
//
//  • Connects Google Workspace (Calendar, Gmail, Drive) — see server/google.mjs
//
//  Run:   ANTHROPIC_API_KEY=sk-ant-... node server/index.mjs
//  Env:   PORT (default 8787), ANTHROPIC_API_KEY or LLM_API_KEY (free Llama — see server/openai-compat.mjs), RATE_LIMIT (requests/min per IP, default 30)
//         GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL, SESSION_SECRET (Google Workspace)

import { search, searchProvider } from "./search.mjs"
import http from "node:http"
import { readFile, stat } from "node:fs/promises"
import { createReadStream } from "node:fs"
import zlib from "node:zlib"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { googleConfigured, handleGoogle } from "./google.mjs"
import { LLM, chatOpenAI } from "./openai-compat.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(__dirname, "../dist")
const PORT = Number(process.env.PORT || 8787)
const KEY = process.env.ANTHROPIC_API_KEY || ""
// Which AI powers the app: Claude if ANTHROPIC_API_KEY is set, otherwise a free/open model via LLM_API_KEY.
const PROVIDER = process.env.AI_PROVIDER || (KEY ? "anthropic" : LLM.key ? "openai" : "none")
const AI_LABEL = PROVIDER === "anthropic" ? "Claude" : PROVIDER === "openai" ? LLM.label : ""
const RATE = Number(process.env.RATE_LIMIT || process.env.ORBIT_RATE_LIMIT || 30)
const API_BASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")
const ALLOWED_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"])

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
}

const hits = new Map()
function limited(ip) {
  const now = Date.now()
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000)
  arr.push(now)
  hits.set(ip, arr)
  return arr.length > RATE
}

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json" })
  res.end(JSON.stringify(body))
}

async function readBody(req, max = 2_000_000) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > max) throw new Error("Request too large")
    chunks.push(c)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
}

async function chat(req, res) {
  if (PROVIDER === "none") return json(res, 503, { error: { message: "No AI key is set on the server (ANTHROPIC_API_KEY or LLM_API_KEY)." } })
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress
  if (limited(ip)) return json(res, 429, { error: { message: "Too many requests — slow down a little." } })

  let input
  try {
    input = await readBody(req)
  } catch (e) {
    return json(res, 400, { error: { message: e.message } })
  }
  if (PROVIDER === "openai") return chatOpenAI(input, res, json)
  const body = {
    model: ALLOWED_MODELS.has(input.model) ? input.model : "claude-sonnet-5-5",
    max_tokens: Math.min(Number(input.max_tokens) || 2048, 4096),
    system: String(input.system || "").slice(0, 200_000),
    messages: Array.isArray(input.messages) ? input.messages.slice(-30) : [],
    stream: true,
  }
  if (typeof input.temperature === "number") body.temperature = Math.max(0, Math.min(1, input.temperature))
  if (Array.isArray(input.tools)) body.tools = input.tools.filter((t) => t?.type?.startsWith("web_search"))

  const ctrl = new AbortController()
  res.on("close", () => ctrl.abort())
  let upstream
  try {
    upstream = await fetch(`${API_BASE}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } catch (e) {
    return json(res, 502, { error: { message: "Couldn't reach the AI service." } })
  }
  if (!upstream.ok) {
    const text = await upstream.text()
    res.writeHead(upstream.status, { "content-type": "application/json" })
    return res.end(text)
  }
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" })
  try {
    for await (const chunk of upstream.body) res.write(chunk)
  } catch {
    /* client went away */
  }
  res.end()
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://x")
  let file = path.join(DIST, decodeURIComponent(url.pathname))
  if (!file.startsWith(DIST)) return json(res, 403, { error: "Forbidden" })
  try {
    const s = await stat(file)
    if (s.isDirectory()) file = path.join(file, "index.html")
  } catch {
    file = path.join(DIST, "index.html") // SPA fallback
  }
  try {
    await stat(file)
  } catch {
    res.writeHead(404)
    return res.end("Not found — run `npm run build` first.")
  }
  const ext = path.extname(file)
  const immutable = file.includes(`${path.sep}assets${path.sep}`)
  const headers = {
    "content-type": TYPES[ext] || "application/octet-stream",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "x-content-type-options": "nosniff",
    vary: "accept-encoding",
  }
  // Compress text assets (the on-device AI library is ~6 MB raw, ~2 MB gzipped).
  if (/\.(js|mjs|css|html|json|svg|webmanifest|txt|bin)$/.test(file) && /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""))) {
    res.writeHead(200, { ...headers, "content-encoding": "gzip" })
    return createReadStream(file).pipe(zlib.createGzip({ level: 6 })).pipe(res)
  }
  res.writeHead(200, headers)
  createReadStream(file).pipe(res)
}

http
  .createServer(async (req, res) => {
    if (req.url === "/api/health") return json(res, 200, { ok: true, ai: PROVIDER !== "none", provider: PROVIDER, label: AI_LABEL, google: googleConfigured, search: searchProvider })
    if (req.url?.startsWith("/api/google/")) {
      return handleGoogle(req, res, new URL(req.url, "http://x")).catch((e) => {
        console.error(e)
        json(res, 500, { error: "Google request failed" })
      })
    }
    if (req.url === "/api/chat" && req.method === "POST") return chat(req, res)
    if (req.url?.startsWith("/api/search")) {
      const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress
      if (limited(ip)) return json(res, 429, { error: { message: "Too many searches — try again in a minute." } })
      try {
        return json(res, 200, await search(new URL(req.url, "http://x").searchParams.get("q")))
      } catch (e) {
        return json(res, 502, { error: { message: "Web search failed: " + e.message } })
      }
    }
    if (req.url?.startsWith("/api/")) return json(res, 404, { error: { message: "Not found" } })
    return serveStatic(req, res)
  })
  .listen(PORT, () => {
    console.log(`Paper Tech running on http://localhost:${PORT}  (AI: ${AI_LABEL || "demo mode — set LLM_API_KEY (free Llama via Groq) or ANTHROPIC_API_KEY"} · Google: ${googleConfigured ? "configured" : "not configured"})`)
  })

// Make sure dist exists at boot for a clearer error in logs.
readFile(path.join(DIST, "index.html")).catch(() => console.warn("⚠ dist/ not found. Run `npm run build` before `npm start`."))
