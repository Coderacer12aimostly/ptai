/**
 * On-device AI. Runs the Paper Tech 1 models (open models with Paper Tech personas) inside the
 * browser with WebGPU via WebLLM. The model is downloaded once, cached by the
 * browser, and every prompt and answer stays on this device.
 */
import { useSyncExternalStore } from "react"
import type { ChatTurn } from "./ai"

export interface LocalModel {
  key: string
  name: string
  maker: string
  size: string
  blurb: string
  ids: { f16: string; f32: string }
  /** Context window we ask the engine for (tokens). */
  ctx: number
  /** Qwen3-style models that can emit <think> blocks. */
  thinking?: boolean
  /** Paper Tech's own model: ships with the app, runs on the CPU, no WebGPU needed. */
  builtin?: boolean
  /** Image model used behind the scenes (not offered as a chat model) */
  vision?: boolean
}

/**
 * The Paper Tech 1 family. Each model is an open model (Apache 2.0) that Paper Tech gives
 * its own name, persona and settings. If you fine-tune Wave, Mini or Renat with
 * model/Train_Paper_Tech_1.ipynb, set VITE_PAPERTECH1_HF_USER and the app loads your
 * fine-tuned weights from Hugging Face instead of the base weights.
 */
export const PAPERTECH1_HF_USER: string = String(import.meta.env.VITE_PAPERTECH1_HF_USER ?? "").trim()
/** Which fine-tunes exist on that account, e.g. "Mini,Renat,Wave" (default: Mini). */
const TUNED = String(import.meta.env.VITE_PAPERTECH1_TUNED ?? "Mini").split(",").map((x) => x.trim().toLowerCase())

export interface FamilyInfo {
  /** One-word role shown in pickers */
  role: string
  base: string
  params: string
  /** Prompt line that tells the model who it is */
  persona: string
  /** Show the model's reasoning (Qwen3 thinking mode) */
  showThinking?: boolean
  /** Name of the fine-tuned repo stem (PaperTech-1-<stem>-q4f16_1-MLC), if trainable */
  tuned?: string
  /** Generation settings tuned for this model (Qwen's recommended sampling + anti-repetition) */
  gen: { temperature: number; top_p: number; presence_penalty?: number; frequency_penalty?: number; repetition_penalty?: number; maxTokens: number }
}

export const LOCAL_MODELS: Array<LocalModel & { family?: FamilyInfo }> = [
  {
    key: "pt1-wave",
    name: "Paper Tech 1 Wave",
    maker: "Paper Tech",
    size: "2.3 GB",
    blurb: "Deep thinking. Works through hard problems step by step and shows its reasoning.",
    ids: { f16: "Qwen3-4B-q4f16_1-MLC", f32: "Qwen3-4B-q4f32_1-MLC" },
    ctx: 4096,
    thinking: true,
    family: {
      role: "Deep thinking",
      base: "Qwen3-4B",
      params: "4B",
      tuned: "Wave",
      showThinking: true,
      gen: { temperature: 0.6, top_p: 0.95, presence_penalty: 0.5, maxTokens: 2048 },
      persona:
        "You are Paper Tech 1 Wave, Paper Tech's deep-thinking model. You reason carefully before answering and you're good at analysis, planning, math and hard questions. " +
        "Think the problem through step by step, check your work, then give a clear, well-structured final answer that leads with the conclusion. " +
        "Paper Tech built you on the open-source Qwen3-4B model, and you run privately on the user's own device.",
    },
  },
  {
    key: "pt1-mini",
    name: "Paper Tech 1 Mini",
    maker: "Paper Tech",
    size: "0.4 GB",
    blurb: "Quick answers. The smallest download and the fastest replies.",
    ids: { f16: "Qwen3-0.6B-q4f16_1-MLC", f32: "Qwen3-0.6B-q4f32_1-MLC" },
    ctx: 4096,
    thinking: true,
    family: {
      role: "Quick answers",
      base: "Qwen3-0.6B",
      params: "0.6B",
      tuned: "Mini",
      gen: { temperature: 0.7, top_p: 0.8, presence_penalty: 1.0, repetition_penalty: 1.05, maxTokens: 768 },
      persona:
        "You are Paper Tech 1 Mini, Paper Tech's fast model for quick answers. Keep replies short and to the point: a few sentences or a short list, unless the user asks for more. " +
        "Never repeat yourself. If you're not sure about a fact, say so instead of guessing. " +
        "Paper Tech built you on the open-source Qwen3-0.6B model, and you run privately on the user's own device.",
    },
  },
  {
    key: "pt1-renat",
    name: "Paper Tech 1 Renat",
    maker: "Paper Tech",
    size: "0.9 GB",
    blurb: "Coding. Writes, explains and fixes code, and builds web pages you can preview.",
    ids: { f16: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC" },
    ctx: 4096,
    family: {
      role: "Coding",
      base: "Qwen2.5-Coder-1.5B",
      params: "1.5B",
      tuned: "Renat",
      gen: { temperature: 0.3, top_p: 0.9, repetition_penalty: 1.05, maxTokens: 2048 },
      persona:
        "You are Paper Tech 1 Renat, Paper Tech's coding model. You write clean, complete, working code with short comments, and explain it briefly. " +
        "Prefer code the user can run as-is; never leave placeholders like \"...rest of the code\". Before answering, check the code for mistakes. " +
        "Paper Tech built you on the open-source Qwen2.5-Coder-1.5B model, and you run privately on the user's own device.",
    },
  },
  {
    key: "pt1-vision",
    name: "Paper Tech 1 Vision",
    maker: "Paper Tech",
    size: "2.4 GB",
    blurb: "Looks at images you attach and describes them for the model you're chatting with.",
    ids: { f16: "Phi-3.5-vision-instruct-q4f16_1-MLC", f32: "Phi-3.5-vision-instruct-q4f32_1-MLC" },
    ctx: 4096,
    vision: true,
  },
  {
    key: "nano",
    name: "Paper Tech Nano",
    maker: "Paper Tech",
    size: "built in",
    blurb: "Our tiny model, trained from scratch. Instant, works in every browser, and knows its way around Paper Tech.",
    ids: { f16: "nano", f32: "nano" },
    ctx: 128,
    builtin: true,
  },
]
// Fine-tuned weights replace the base weights when configured.
if (PAPERTECH1_HF_USER) {
  for (const m of LOCAL_MODELS) if (m.family?.tuned && TUNED.includes(m.family.tuned.toLowerCase())) m.ids = { f16: `PaperTech-1-${m.family.tuned}-q4f16_1-MLC`, f32: `PaperTech-1-${m.family.tuned}-q4f32_1-MLC` }
}
const BASE_IDS: Record<string, string> = { Wave: "Qwen3-4B", Mini: "Qwen3-0.6B", Renat: "Qwen2.5-Coder-1.5B-Instruct" }

export type Mode = "work" | "chat" | "code" | "agent"
/** The model each mode starts with (users can pick another). */
export const MODE_DEFAULT_MODEL: Record<Mode, string> = { work: "pt1-mini", chat: "pt1-mini", code: "pt1-renat", agent: "pt1-wave" }
export const FAMILY = LOCAL_MODELS.filter((m) => m.family)
/** Models people can chat with (everything except the behind-the-scenes Vision model). */
export const CHAT_MODELS = LOCAL_MODELS.filter((m) => !m.vision)
export const VISION_MODEL = "pt1-vision"

export const DEFAULT_LOCAL_MODEL = "pt1-mini"
const LEGACY: Record<string, string> = { mini: "nano", "llama-3.2-1b": "pt1-mini", "llama-3.2-3b": "pt1-wave", "qwen3-4b": "pt1-wave", "papertech-1": "pt1-mini" }
export const localModel = (key?: string) => LOCAL_MODELS.find((m) => m.key === (key && LEGACY[key] ? LEGACY[key] : key)) ?? LOCAL_MODELS.find((m) => m.key === DEFAULT_LOCAL_MODEL)!
/** Like localModel, but never returns the Vision model (for chat model settings). */
export const chatModel = (key?: string) => {
  const m = localModel(key)
  return m.vision ? localModel(DEFAULT_LOCAL_MODEL) : m
}

/* ---------------- settings (synced from the store) ---------------- */

let cfg = { enabled: true, model: DEFAULT_LOCAL_MODEL }
export function configureLocal(c: { enabled?: boolean; model?: string }) {
  const next = { enabled: c.enabled !== false, model: localModel(c.model).key }
  if (next.enabled === cfg.enabled && next.model === cfg.model) return
  cfg = next
  if (!cfg.enabled && engine) void unloadLocal()
}
export const localConfig = () => cfg

/* ---------------- status store ---------------- */

export type LocalPhase = "idle" | "downloading" | "loading" | "ready" | "error"
export interface LocalStatus {
  phase: LocalPhase
  progress: number
  model?: string
  error?: string
}

let status: LocalStatus = { phase: "idle", progress: 0 }
const listeners = new Set<() => void>()
function setStatus(patch: Partial<LocalStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((f) => f())
}
export const getLocalStatus = () => status
export function subscribeLocal(f: () => void) {
  listeners.add(f)
  return () => void listeners.delete(f)
}
export const useLocalStatus = () => useSyncExternalStore(subscribeLocal, getLocalStatus, getLocalStatus)

/* ---------------- capability check ---------------- */

export interface GPUSupport {
  ok: boolean
  f16: boolean
  reason?: string
}

/** Test hook: a fake engine factory used by automated tests (never set in normal use). */
type FakeFactory = (modelId: string, onProgress: (p: number) => void) => Promise<Engine>
const fake = () => (globalThis as { __PT_FAKE_LLM__?: FakeFactory }).__PT_FAKE_LLM__

let gpuCheck: Promise<GPUSupport> | null = null
export function checkWebGPU(): Promise<GPUSupport> {
  if (fake()) return Promise.resolve({ ok: true, f16: true })
  if (!gpuCheck) {
    gpuCheck = (async () => {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter: (o?: object) => Promise<{ features: Set<string> } | null> } }).gpu
      if (!gpu) return { ok: false, f16: false, reason: "This browser doesn't support WebGPU yet. Use a recent Chrome, Edge, Opera or Safari 26+." }
      try {
        const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" })
        if (!adapter) return { ok: false, f16: false, reason: "WebGPU is turned off or your graphics chip isn't supported." }
        return { ok: true, f16: adapter.features.has("shader-f16") }
      } catch {
        return { ok: false, f16: false, reason: "WebGPU couldn't start on this device." }
      }
    })()
  }
  return gpuCheck
}

/** True when on-device AI is switched on and this device can run it. */
export async function localAvailable(key = cfg.model) {
  const m = localModel(key)
  if (!cfg.enabled || failed.has(m.key)) return false
  return m.builtin || (await checkWebGPU()).ok
}

/* ---------------- engine ---------------- */

interface Engine {
  chat: { completions: { create: (req: object) => Promise<AsyncIterable<{ choices: Array<{ delta?: { content?: string | null } }> }>> } }
  interruptGenerate: () => void
  unload: () => Promise<void>
}

let engine: Engine | null = null
let engineKey = ""
let loading: { key: string; p: Promise<Engine> } | null = null
/** Models that failed to start this session (we fall back to cloud/demo for them). */
const failed = new Set<string>()

const webllm = () => import("@mlc-ai/web-llm")

export async function appConfig() {
  const w = await webllm()
  // file:// pages can't use the Cache API, so store the model in IndexedDB there.
  const cacheBackend = location.protocol === "file:" || typeof caches === "undefined" ? "indexeddb" : "cache"
  const list = [...w.prebuiltAppConfig.model_list]
  if (PAPERTECH1_HF_USER) {
    // A fine-tune has the same architecture as its base, so it runs on the base model's official WebGPU library.
    for (const [stem, base] of Object.entries(BASE_IDS).filter(([k]) => TUNED.includes(k.toLowerCase()))) {
      for (const q of ["q4f16_1", "q4f32_1"]) {
        const rec = list.find((r) => r.model_id === `${base}-${q}-MLC`)
        if (rec) list.push({ ...rec, model_id: `PaperTech-1-${stem}-${q}-MLC`, model: `https://huggingface.co/${PAPERTECH1_HF_USER}/PaperTech-1-${stem}-${q}-MLC` })
      }
    }
  }
  return { ...w.prebuiltAppConfig, model_list: list, cacheBackend } as typeof w.prebuiltAppConfig
}

async function modelId(m: LocalModel) {
  return (await checkWebGPU()).f16 ? m.ids.f16 : m.ids.f32
}

/** Has this model already been downloaded to this browser? */
export async function isDownloaded(key: string) {
  if (localModel(key).builtin) return true
  if (fake()) return engineKey === key || downloadedFake.has(key)
  try {
    const gpu = await checkWebGPU()
    if (!gpu.ok) return false
    const w = await webllm()
    return await w.hasModelInCache(await modelId(localModel(key)), await appConfig())
  } catch {
    return false
  }
}
const downloadedFake = new Set<string>()

function useWorker() {
  return typeof Worker !== "undefined" && /^https?:$/.test(location.protocol) && !import.meta.env.VITE_LLM_MAIN_THREAD
}

function friendly(e: unknown) {
  const msg = String((e as Error)?.message ?? e)
  if (/quota|storage|QuotaExceeded/i.test(msg)) return "There isn't enough free disk space to store the model."
  if (/device.*lost|out of memory|OOM|allocate/i.test(msg)) return "Your device ran out of graphics memory. Try a smaller model."
  if (/fetch|network|Failed to fetch|load failed/i.test(msg)) return "The model download was interrupted. Check your connection and try again."
  if (/shader-f16|feature/i.test(msg)) return "Your graphics chip is missing a feature this model needs. Try another model."
  return msg.slice(0, 200)
}

/** Download (first time) and load a model into GPU memory. */
export function loadLocal(key = cfg.model): Promise<Engine> {
  const m = localModel(key)
  if (engine && engineKey === m.key) return Promise.resolve(engine)
  if (loading?.key === m.key) return loading.p
  const p = (async () => {
    if (engine) await unloadLocal()
    if (m.builtin) {
      setStatus({ phase: "loading", progress: 0, model: m.key, error: undefined })
      const { createMiniEngine } = await import("./mini")
      const e = (await createMiniEngine()) as unknown as Engine
      engine = e
      engineKey = m.key
      failed.delete(m.key)
      setStatus({ phase: "ready", progress: 1 })
      return e
    }
    const gpu = await checkWebGPU()
    if (!gpu.ok) throw new Error(gpu.reason)
    const cached = await isDownloaded(m.key)
    setStatus({ phase: cached ? "loading" : "downloading", progress: 0, model: m.key, error: undefined })
    const onProgress = (p: number) => setStatus({ progress: Math.max(0, Math.min(1, p)) })
    const id = await modelId(m)
    let e: Engine
    const f = fake()
    if (f) {
      e = await f(id, onProgress)
      downloadedFake.add(m.key)
    } else {
      const w = await webllm()
      const engineConfig = { initProgressCallback: (r: { progress: number }) => onProgress(r.progress), appConfig: await appConfig() }
      const chatOpts = { context_window_size: m.ctx }
      if (useWorker()) {
        const worker = new Worker(new URL("./llm.worker.ts", import.meta.url), { type: "module" })
        e = (await w.CreateWebWorkerMLCEngine(worker, id, engineConfig, chatOpts)) as unknown as Engine
      } else {
        e = (await w.CreateMLCEngine(id, engineConfig, chatOpts)) as unknown as Engine
      }
    }
    engine = e
    engineKey = m.key
    failed.delete(m.key)
    setStatus({ phase: "ready", progress: 1 })
    return e
  })()
  loading = { key: m.key, p }
  p.catch((err) => {
    failed.add(m.key)
    setStatus({ phase: "error", error: friendly(err) })
  }).finally(() => {
    if (loading?.p === p) loading = null
  })
  return p
}

export async function unloadLocal() {
  const e = engine
  engine = null
  engineKey = ""
  if (status.phase === "ready") setStatus({ phase: "idle", progress: 0 })
  try {
    await e?.unload()
  } catch {
    /* ignore */
  }
}

/** Remove a downloaded model from this browser. */
export async function deleteLocal(key: string) {
  const m = localModel(key)
  if (engineKey === m.key) await unloadLocal()
  downloadedFake.delete(m.key)
  if (fake() || m.builtin) return
  const w = await webllm()
  const app = await appConfig()
  for (const id of [m.ids.f16, m.ids.f32]) await w.deleteModelAllInfoInCache(id, app).catch(() => {})
}

/** Let a failed model be tried again (e.g. after the user frees memory). */
export function retryLocal() {
  failed.delete(cfg.model)
  setStatus({ phase: "idle", progress: 0, error: undefined })
}

/* ---------------- chat ---------------- */

/** Keep the prompt inside the small model's context window. */
export function fitLocal(system: string, messages: ChatTurn[], budgetChars: number) {
  const sysBudget = Math.floor(budgetChars * 0.62)
  let sys = system
  if (sys.length > sysBudget) {
    const open = sys.indexOf("<sources>")
    const close = sys.lastIndexOf("</sources>")
    if (open > 0 && close > open) {
      const head = sys.slice(0, open)
      const tail = sys.slice(close + "</sources>".length)
      const room = Math.max(400, sysBudget - head.length - tail.length - 60)
      sys = head + sys.slice(open, open + room) + "\n…(sources shortened)\n</sources>" + tail
    }
    if (sys.length > sysBudget) {
      // Very long instructions or a big document: keep the start and the end.
      const keep = Math.max(600, sysBudget - 40)
      sys = sys.slice(0, Math.floor(keep * 0.35)) + "\n…\n" + sys.slice(sys.length - Math.floor(keep * 0.65))
    }
  }
  let left = budgetChars - sys.length
  const out: ChatTurn[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m.content.trim()) continue
    const isLast = out.length === 0
    let content = m.content
    if (content.length > left) {
      if (!isLast) break
      content = content.slice(0, Math.max(200, left))
    }
    out.unshift({ role: m.role, content })
    left -= content.length
    if (left < 200) break
  }
  while (out.length && out[0].role === "assistant") out.shift()
  return { system: sys, messages: out }
}

let queue: Promise<unknown> = Promise.resolve()

export async function streamLocal(o: {
  system: string
  messages: ChatTurn[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onText: (t: string) => void
  /** Model to use for this call (defaults to the selected model). */
  model?: string
  /** Receives the model's reasoning as it streams (Wave only). */
  onThinking?: (t: string) => void
}): Promise<string> {
  const m = localModel(o.model ?? cfg.model)
  // One generation at a time — the engine runs a single model.
  const run = queue.then(async () => {
    const e = await loadLocal(m.key)
    if (o.signal?.aborted) return ""
    const think = Boolean(m.family?.showThinking && o.onThinking)
    const g = m.family?.gen
    const maxOut = Math.max(256, Math.min(think ? 2048 : (o.maxTokens ?? g?.maxTokens ?? 1024), Math.floor(m.ctx / 2)))
    const system = m.family ? `${m.family.persona}\n\n${o.system.replace(/^You are Paper Tech AI, /, "You work inside Paper Tech AI as ")}` : o.system
    const fit = fitLocal(system, o.messages, Math.floor((m.ctx - maxOut - 64) * 3.1))
    const req: Record<string, unknown> = {
      messages: [{ role: "system", content: fit.system }, ...fit.messages],
      stream: true,
      max_tokens: maxOut,
      temperature: o.temperature ?? g?.temperature ?? 0.6,
      ...(g ? { top_p: g.top_p } : {}),
      ...(g?.presence_penalty ? { presence_penalty: g.presence_penalty } : {}),
      ...(g?.frequency_penalty ? { frequency_penalty: g.frequency_penalty } : {}),
      ...(g?.repetition_penalty ? { repetition_penalty: g.repetition_penalty } : {}),
    }
    if (m.thinking && !think) req.extra_body = { enable_thinking: false }
    const stop = () => e.interruptGenerate()
    o.signal?.addEventListener("abort", stop)
    let full = ""
    let raw = ""
    let thought = ""
    try {
      const chunks = await e.chat.completions.create(req)
      for await (const c of chunks) {
        if (o.signal?.aborted) break
        raw += c.choices[0]?.delta?.content ?? ""
        // Reasoning arrives inside <think>…</think>: pass it to onThinking, keep it out of the answer.
        if (o.onThinking) {
          const t = raw.match(/<think>([\s\S]*?)(<\/think>|$)/)?.[1] ?? ""
          if (t.length > thought.length) {
            o.onThinking(t.slice(thought.length))
            thought = t
          }
        }
        const visible = raw.replace(/<think>[\s\S]*?(<\/think>\s*|$)/g, "")
        if (visible.length > full.length) {
          o.onText(visible.slice(full.length))
          full = visible
        }
      }
    } finally {
      o.signal?.removeEventListener("abort", stop)
    }
    return full
  })
  queue = run.catch(() => {})
  return run
}


/** Can this device look at images with Paper Tech 1 Vision? */
export async function visionAvailable() {
  return cfg.enabled && !failed.has(VISION_MODEL) && (await checkWebGPU()).ok
}

/** Describe one image with Paper Tech 1 Vision (swaps the chat model out while it runs). */
export async function describeImage(dataUrl: string, question: string, signal?: AbortSignal): Promise<string> {
  const run = queue.then(async () => {
    const e = await loadLocal(VISION_MODEL)
    if (signal?.aborted) return ""
    const prompt =
      "Describe this image for an assistant that can't see it. Say what it is (photo, screenshot, chart, document, drawing…), the main subjects and details, " +
      "any visible text word for word, and anything relevant to the user's question. Be factual and specific; don't guess beyond what's visible. Max 150 words.\n\n" +
      `User's question: ${question.slice(0, 400) || "(none)"}`
    const req = {
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
      stream: true,
      max_tokens: 320,
      temperature: 0.2,
    }
    let out = ""
    const stop = () => e.interruptGenerate()
    signal?.addEventListener("abort", stop)
    try {
      for await (const c of await e.chat.completions.create(req)) out += c.choices[0]?.delta?.content ?? ""
    } finally {
      signal?.removeEventListener("abort", stop)
    }
    return out.trim()
  })
  queue = run.catch(() => {})
  return run
}
