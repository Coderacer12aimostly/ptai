import { demoReply } from "./demo"
import { tokens, type Passage } from "./knowledge"
import type { GEvent, GMail } from "./google"
import { localAvailable, localConfig, localModel, streamLocal } from "./local"

export type AIMode = "server" | "browser" | "device" | "demo"

export interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

export interface WebCitation {
  url: string
  title: string
  quote?: string
}

export interface StreamOptions {
  messages: ChatTurn[]
  system: string
  model: string
  temperature?: number
  web?: boolean
  maxTokens?: number
  apiKey?: string
  signal?: AbortSignal
  onText: (chunk: string) => void
  /** Used only by the offline demo engine. */
  demo?: { passages: Passage[]; kind?: "chat" | "edit"; doc?: string; google?: { events: GEvent[]; mail: GMail[] }; appMode?: "work" | "chat" | "code" | "agent"; web?: Array<{ title: string; url: string; text: string }> }
  /** Skip live AI even if configured (e.g. the public landing-page demo). */
  forceDemo?: boolean
  /** On-device model to use for this call (Paper Tech 1 Wave / Mini / Renat / Nano). */
  localModel?: string
  /** Receives the model's reasoning as it streams (Wave). */
  onThinking?: (t: string) => void
}

export interface ServerAI {
  ai: boolean
  /** "anthropic" (Claude) or "openai" (an OpenAI-compatible model such as Llama on Groq) */
  provider?: string
  label?: string
}
let serverCheck: Promise<ServerAI> | null = null

/** What the bundled Node server offers (ANTHROPIC_API_KEY or LLM_API_KEY). */
export function serverAI(force = false): Promise<ServerAI> {
  if (!serverCheck || force) {
    serverCheck = fetch("/api/health", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : { ai: false }))
      .then((j: ServerAI) => ({ ai: Boolean(j.ai), provider: j.provider, label: j.label }))
      .catch(() => ({ ai: false }))
  }
  return serverCheck
}

export function serverHasAI(force = false): Promise<boolean> {
  return serverAI(force).then((s) => s.ai)
}

/** Name of the AI in use, for labels ("Llama 3.2 1B", "Claude", "Demo AI"). */
export async function aiLabel(apiKey?: string, key?: string) {
  if (apiKey?.trim()) return "Claude"
  if (await localAvailable(key)) return localModel(key ?? localConfig().model).name
  const s = await serverAI()
  return s.ai ? s.label || "AI" : "Demo AI"
}

export async function resolveMode(apiKey?: string, key?: string): Promise<AIMode> {
  if (apiKey?.trim()) return "browser"
  if (await localAvailable(key)) return "device"
  return (await serverHasAI()) ? "server" : "demo"
}

/** On-device answers are unlimited — they don't count toward the plan's cloud messages. */
export async function isOnDevice(apiKey?: string) {
  return (await resolveMode(apiKey)) === "device"
}

function body(o: StreamOptions, withTools: boolean) {
  return JSON.stringify({
    model: o.model,
    max_tokens: o.maxTokens ?? 2048,
    system: o.system,
    messages: o.messages.filter((m) => m.content.trim()),
    temperature: o.temperature,
    stream: true,
    ...(withTools && o.web ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] } : {}),
  })
}

async function readSSE(res: Response, onText: (t: string) => void, citations: WebCitation[]) {
  if (!res.body) throw new Error("No response body")
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  let full = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("")
      if (!data || data === "[DONE]") continue
      let evt: any
      try {
        evt = JSON.parse(data)
      } catch {
        continue
      }
      if (evt.type === "error") throw new Error(evt.error?.message ?? "The AI service returned an error")
      if (evt.type === "content_block_delta") {
        if (evt.delta?.type === "text_delta") {
          full += evt.delta.text
          onText(evt.delta.text)
        } else if (evt.delta?.type === "citations_delta" && evt.delta.citation?.url) {
          const c = evt.delta.citation
          if (!citations.some((x) => x.url === c.url)) citations.push({ url: c.url, title: c.title ?? c.url, quote: c.cited_text })
        }
      }
    }
  }
  return full
}

async function call(url: string, headers: Record<string, string>, o: StreamOptions, withTools: boolean) {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: body(o, withTools), signal: o.signal })
}

async function errorText(res: Response) {
  try {
    const j = await res.json()
    return j?.error?.message ?? j?.message ?? res.statusText
  } catch {
    return res.statusText || `HTTP ${res.status}`
  }
}

/**
 * Stream a reply. Tries, in order: a key saved in the browser, the app's own
 * /api/chat proxy, then the offline demo engine.
 */
export async function streamChat(o: StreamOptions): Promise<{ mode: AIMode; text: string; citations: WebCitation[] }> {
  let mode = o.forceDemo ? "demo" : await resolveMode(o.apiKey, o.localModel)
  const citations: WebCitation[] = []

  if (mode === "device") {
    let sent = false
    try {
      const text = await streamLocal({ ...o, model: o.localModel, onText: (t) => ((sent = true), o.onText(t)), onThinking: o.onThinking && ((t) => ((sent = true), o.onThinking!(t))) })
      return { mode, text, citations }
    } catch (e) {
      // If the on-device model can't start, fall back to the server or demo engine.
      if (sent || o.signal?.aborted) throw e
      console.warn("On-device AI unavailable, falling back:", e)
      mode = (await serverHasAI()) ? "server" : "demo"
    }
  }

  if (mode === "demo") {
    const lastUser = [...o.messages].reverse().find((m) => m.role === "user")?.content ?? ""
    // Attached files or web results but no model that can read them: quote the most relevant sentences, with sources.
    const fileBlocks = [...lastUser.matchAll(/<file n="(\d+)" name="([^"]*)"[^>]*>([\s\S]*?)<\/file>/g)]
    if ((fileBlocks.length || o.demo?.web?.length) && o.demo?.appMode !== "code") {
      const question = lastUser.split("\n\nThe user attached")[0]
      const docs = [
        ...fileBlocks.map(([, , name, body]) => ({ label: `**${name}**`, text: body.replace(/^\(Long file:[^)]*\)\n?/, "") })),
        ...(o.demo?.web ?? []).map((r) => ({ label: `[${r.title}](${r.url})`, text: r.text })),
      ]
      const text = `${quoteBest(question, docs)}\n\n*This browser can't run the Paper Tech 1 models (they need WebGPU), so these are the most relevant passages I found, not a written answer. Open Paper Tech in Chrome, Edge, Opera or Safari 26+ for a full answer.*`
      return { mode, text: await streamWords(text, o), citations }
    }
    // Images but no model that can use them: show what Paper Tech read in the image.
    if (/<image n="/.test(lastUser) && o.demo?.appMode !== "code") {
      const blocks = [...lastUser.matchAll(/<image n="(\d+)" name="([^"]*)"[^>]*>([\s\S]*?)<\/image>/g)]
      const parts = blocks.map(([, n, name, body]) => {
        const ocr = body.match(/Text in the image \(OCR[^)]*\):\n([\s\S]*?)(?:\nMain colors:|$)/)?.[1]?.trim()
        const colors = body.match(/Main colors: (.*)/)?.[1]
        return `**Image ${n}** (${name})\n\n${ocr ? "Text I can read in it:\n\n" + ocr.split("\n").map((l) => `> ${l}`).join("\n") : "I couldn't find any text in it."}${colors ? `\n\nMain colors: ${colors}.` : ""}`
      })
      const text = `${parts.join("\n\n")}\n\n*This browser can't run the Paper Tech 1 models (they need WebGPU), so I can only show what I read in your image. Open Paper Tech in Chrome, Edge, Opera or Safari 26+ for a full answer.*`
      return { mode, text: await streamWords(text, o), citations }
    }
    // Chat mode without a big model: let Paper Tech Nano (built in, runs everywhere) answer.
    if (o.demo?.appMode === "chat" && !o.forceDemo) {
      try {
        const text = await streamLocal({ ...o, model: "nano", onThinking: undefined })
        return { mode: "device" as AIMode, text, citations }
      } catch {
        /* fall through to the demo engine */
      }
    }
    if (o.demo?.appMode === "code") {
      const { codeDemo } = await import("./modes")
      const last = [...o.messages].reverse().find((m) => m.role === "user")?.content ?? ""
      const text = await streamWords(codeDemo(last), o)
      return { mode, text, citations }
    }
    const text = await demoReply(o)
    return { mode, text, citations }
  }

  const url = mode === "browser" ? "https://api.anthropic.com/v1/messages" : "/api/chat"
  const headers: Record<string, string> =
    mode === "browser"
      ? { "x-api-key": o.apiKey!.trim(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }
      : {}

  let res = await call(url, headers, o, true)
  // Some keys don't have web search enabled — retry without the tool.
  if (!res.ok && o.web && res.status === 400) res = await call(url, headers, o, false)
  if (!res.ok) throw new Error(await errorText(res))
  const text = await readSSE(res, o.onText, citations)
  return { mode, text, citations }
}

/** The sentences that share the most words with the question, grouped by where they came from. */
function quoteBest(question: string, docs: Array<{ label: string; text: string }>, k = 4) {
  const q = new Set(tokens(question))
  const cands = docs.flatMap((d, di) =>
    d.text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 600)
      .map((s, si) => ({ di, si, s, score: tokens(s).reduce((a, t) => a + (q.has(t) ? 1 : 0), 0) })),
  )
  const top = cands.filter((c) => c.score > 0).sort((a, b) => b.score - a.score).slice(0, k)
  if (!top.length) return `I couldn't find anything in ${docs.length > 1 ? "these sources" : "this source"} that matches your question.`
  const byDoc = new Map<number, typeof top>()
  for (const c of top.sort((a, b) => a.di - b.di || a.si - b.si)) byDoc.set(c.di, [...(byDoc.get(c.di) ?? []), c])
  return [...byDoc.entries()].map(([di, cs]) => `From ${docs[di].label}:\n\n${cs.map((c) => `> ${c.s}`).join("\n>\n")}`).join("\n\n")
}

/** Stream a ready-made text word by word (demo fallbacks). */
async function streamWords(text: string, o: Pick<StreamOptions, "onText" | "signal">) {
  const parts = text.match(/\S+\s*|\s+/g) ?? []
  let out = ""
  for (const p of parts) {
    if (o.signal?.aborted) break
    out += p
    o.onText(p)
    await new Promise((r) => setTimeout(r, p.includes("\n") ? 4 : 8))
  }
  return out
}

/** One-shot, non-streaming helper (titles, summaries). Falls back silently. */
export async function complete(prompt: string, o: Pick<StreamOptions, "apiKey" | "model" | "localModel">, fallback: string) {
  try {
    const mode = await resolveMode(o.apiKey, o.localModel)
    if (mode === "demo") return fallback
    // Paper Tech Nano only answers questions about the app; it can't write titles or summaries.
    if (mode === "device" && localModel(o.localModel ?? localConfig().model).builtin) return fallback
    let out = ""
    await streamChat({ ...o, system: "Reply with only the requested text. No quotes, no preamble.", messages: [{ role: "user", content: prompt }], maxTokens: 60, onText: (t) => (out += t) })
    return out.trim().split("\n")[0].replace(/[*_`#]/g, "").replace(/^["'\s]+|["'.\s]+$/g, "").trim() || fallback
  } catch {
    return fallback
  }
}

export async function testConnection(apiKey: string | undefined, model: string) {
  let out = ""
  const r = await streamChat({ apiKey, model, system: "Reply with exactly: Connected.", messages: [{ role: "user", content: "Ping" }], maxTokens: 10, onText: (t) => (out += t) })
  return { mode: r.mode, text: out.trim() }
}
