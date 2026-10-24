import { useCallback } from "react"
import { useStore } from "./store"
import { complete, resolveMode, serverAI, streamChat, type ChatTurn } from "./ai"
import { modeGuidance } from "./modes"
import { buildContext, passageContext, retrieve } from "./knowledge"
import type { AppMode, Conversation, Message, Source } from "./types"
import { uid } from "./utils"
import { openUpgrade } from "../components/upgrade"
import { toast } from "../components/toast"
import { useGoogle } from "../components/GoogleProvider"
import { contextBlock, getEvents, getMail, type GEvent, type GMail } from "./google"
import { imageNotes, withImageNotes } from "./images"
import { hostOf, webContext, webSearch, type WebResult } from "./websearch"
import { describeImage, visionAvailable } from "./local"
import type { ImageRef } from "./types"

/** Read and (where possible) look at attached images, then return text notes for the model. */
export async function notesForImages(
  images: ImageRef[],
  question: string,
  o: { useVision: boolean; signal?: AbortSignal; onPhase: (p: string) => void },
) {
  const vision = o.useVision && images.some((x) => !x.doc) && (await visionAvailable())   // documents don't need Vision
  return imageNotes(images, question, { onPhase: o.onPhase, describe: vision ? (url, q) => describeImage(url, q, o.signal) : undefined })
}

const controllers = new Map<string, AbortController>()

export function stopStreaming(id: string) {
  controllers.get(id)?.abort()
}

export function isStreaming(c?: Conversation) {
  return Boolean(c?.messages.some((m) => m.status === "streaming"))
}

export function systemPrompt(opts: { workspace?: string; user?: string; instructions?: string; hasSources: boolean; web: boolean; appMode?: AppMode }) {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  return [
    `You are Paper Tech AI, a calm, thoughtful AI partner for research and writing${opts.workspace ? ` inside the "${opts.workspace}" workspace` : ""}. Today is ${today}.${opts.user ? ` You are talking with ${opts.user}.` : ""}`,
    opts.appMode && opts.appMode !== "work" ? modeGuidance(opts.appMode) : "",
    opts.instructions ? `Assistant instructions:\n${opts.instructions}` : "",
    opts.appMode === "code" ? "" : "Write in Markdown. Be concise, specific and warm. Prefer short paragraphs, numbered points for structure, and a clear takeaway. Avoid hype.",
    opts.hasSources
      ? "Project sources are provided below inside <source n=…> tags. Ground your answer in them and cite claims inline as [n] using the source number. If the sources don't cover something, say so plainly."
      : "",
    opts.web ? "You may search the web when it helps; mention where facts come from." : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

/** Send a user message in a conversation and stream the assistant reply into the store. */
export function useSend() {
  const { state, update, user, countMessage } = useStore()
  const google = useGoogle()

  return useCallback(
    async (conversationId: string, text: string, opts: { truncateAt?: number; images?: ImageRef[]; web?: boolean } = {}) => {
      const found = state.conversations.find((c) => c.id === conversationId)
      const convo = found && opts.truncateAt !== undefined ? { ...found, messages: found.messages.slice(0, opts.truncateAt) } : found
      const images = opts.images ?? []
      if (!convo || (!text.trim() && !images.length)) return
      if (!text.trim()) text = images.length > 1 ? "What's in these images?" : "What's in this image?"
      const appMode: AppMode = convo.appMode ?? "work"
      const localModel = convo.localModel ?? (appMode === "work" ? state.prefs.localModel : state.prefs.modeModels?.[appMode]) ?? state.prefs.localModel
      const onDevice = (await resolveMode(state.prefs.apiKey, localModel)) === "device"
      if (!onDevice && !countMessage()) {
        openUpgrade("You've used all of this month's cloud AI messages. On-device AI is unlimited — turn it on in Settings → AI models.")
        return
      }
      const assistant = state.assistants.find((a) => a.id === convo.assistantId)
      const useKnowledge = appMode !== "work" ? false : assistant ? assistant.tools.knowledge : true
      const files = useKnowledge ? state.files.filter((f) => f.projectId === convo.projectId) : []
      const web = (opts.web ?? convo.web) && (assistant ? assistant.tools.web : true)

      const userMsg: Message = { id: uid("m-"), role: "user", content: text.trim(), createdAt: Date.now(), ...(images.length ? { images } : {}) }
      const replyId = uid("m-")
      const reply: Message = { id: replyId, role: "assistant", content: "", createdAt: Date.now(), status: "streaming", model: onDevice ? `local:${localModel}` : convo.model }
      update((d) => {
        const c = d.conversations.find((x) => x.id === conversationId)!
        if (opts.truncateAt !== undefined) c.messages = c.messages.slice(0, opts.truncateAt)
        c.messages.push(userMsg, reply)
        c.updatedAt = Date.now()
      })

      const ctrl = new AbortController()
      controllers.set(conversationId, ctrl)
      const setPhase = (p?: string) =>
        update((d) => {
          const m = d.conversations.find((x) => x.id === conversationId)?.messages.find((x) => x.id === replyId)
          if (m) m.phase = p
        })
      if (images.length) {
        const notes = await notesForImages(images, text, { useVision: state.prefs.visionImages !== false, signal: ctrl.signal, onPhase: setPhase })
        userMsg.imageNotes = notes.text
        update((d) => {
          const m = d.conversations.find((x) => x.id === conversationId)?.messages.find((x) => x.id === userMsg.id)
          if (m) m.imageNotes = notes.text
        })
        setPhase(undefined)
      }

      const history: ChatTurn[] = [...convo.messages, userMsg]
        .filter((m) => m.status !== "error")
        .map((m) => ({ role: m.role, content: m.role === "user" ? withImageNotes(m.content, m.imageNotes) : m.content }))
        .slice(-20)

      const passages = await retrieve(files, text)
      // Small on-device models get the best-matching passages instead of whole files.
      const { context, used } = onDevice ? passageContext(passages) : await buildContext(files)
      // Web search: Claude (cloud) searches by itself; every other model gets search results as numbered sources.
      const engine = onDevice ? "device" : await resolveMode(state.prefs.apiKey, localModel)
      const claudeSearches = engine === "browser" || (engine === "server" && (await serverAI()).provider === "anthropic")
      let webResults: WebResult[] = []
      if (web && !claudeSearches) {
        setPhase("Searching the web…")
        try {
          webResults = await webSearch(text, ctrl.signal)
        } catch (e) {
          console.warn("Web search failed:", e)
        }
        setPhase(webResults.length ? `Reading ${webResults.length} web result${webResults.length > 1 ? "s" : ""}…` : undefined)
      }
      const webCtx = webContext(webResults, used.length, onDevice ? 900 : 2500)
      let gctx: { events: GEvent[]; mail: GMail[] } | undefined
      if (convo.google && google.status?.connected) {
        const [events, mail] = await Promise.all([
          google.has("calendar") ? getEvents(google.opts).catch(() => google.events) : Promise.resolve([]),
          google.has("gmail") ? getMail(google.opts).then((m) => m.messages).catch(() => google.mail.messages) : Promise.resolve([]),
        ])
        gctx = { events, mail }
      }
      const system =
        systemPrompt({ workspace: state.workspace?.name, user: user?.name, instructions: assistant?.instructions, hasSources: used.length > 0 || webResults.length > 0, web, appMode }) +
        (webResults.length ? "\n\nSome sources below are fresh web search results (they have a url). Prefer them for current facts and cite them with [n] like any other source." : "") +
        (context || webCtx ? `\n\n<sources>\n${[context, webCtx].filter(Boolean).join("\n\n")}\n</sources>` : "") +
        (gctx
          ? `\n\nThe user's Google Calendar and unread Gmail are below (read-only). Use them when they ask about their day, meetings or email; never invent events or messages. Current time: ${new Date().toLocaleString()}.\n<google_workspace>\n${contextBlock(gctx.events, gctx.mail)}\n</google_workspace>`
          : "")

      let buffer = ""
      let flushed = 0
      let thinking = ""
      let thinkFlushed = 0
      let thinkStart = 0
      let thinkMs = 0
      const flush = () => {
        flushed = buffer.length
        thinkFlushed = thinking.length
        const snapshot = buffer
        const thought = thinking
        update((d) => {
          const m = d.conversations.find((x) => x.id === conversationId)?.messages.find((x) => x.id === replyId)
          if (m) {
            m.content = snapshot
            if (thought) m.thinking = thought
          }
        })
      }
      const timer = window.setInterval(() => (buffer.length !== flushed || thinking.length !== thinkFlushed) && flush(), 60)

      try {
        const res = await streamChat({
          messages: history,
          system,
          model: convo.model,
          temperature: assistant?.creativity,
          web: web && claudeSearches,
          apiKey: state.prefs.apiKey,
          signal: ctrl.signal,
          onText: (t) => {
            if (thinkStart && !thinkMs) thinkMs = Date.now() - thinkStart
            buffer += t
          },
          onThinking: (t) => {
            if (!thinkStart) thinkStart = Date.now()
            thinking += t
          },
          localModel,
          demo: { passages, google: gctx, appMode, web: webResults },
        })
        window.clearInterval(timer)
        const final = buffer || res.text
        const sources: Source[] = []
        if (res.mode === "demo" && images.length) {
          /* the demo answer is about the image, not the project files */
        } else if (res.mode === "demo") {
          const seen: string[] = []
          for (const p of passages) {
            if (seen.includes(p.file.id)) continue
            seen.push(p.file.id)
            sources.push({ n: seen.length, fileId: p.file.id, title: p.file.name.replace(/\.[a-z0-9]+$/i, ""), meta: p.file.meta ?? p.file.kind, quote: p.text.slice(0, 160), url: p.file.url })
          }
        } else {
          used.forEach((f, i) => {
            if (final.includes(`[${i + 1}]`)) sources.push({ n: i + 1, fileId: f.id, title: f.name.replace(/\.[a-z0-9]+$/i, ""), meta: f.meta ?? f.kind, url: f.url })
          })
          res.citations.forEach((c, i) => sources.push({ n: used.length + i + 1, title: c.title, meta: `Web · ${new URL(c.url).hostname.replace(/^www\./, "")}`, url: c.url, quote: c.quote }))
        }
        // Web results the model was given: list the ones it cited (or all of them if it cited none).
        if (webResults.length) {
          const cited = webResults.map((r, i) => ({ r, n: used.length + i + 1 })).filter(({ n }) => final.includes(`[${n}]`))
          for (const { r, n } of cited.length ? cited : webResults.map((r, i) => ({ r, n: used.length + i + 1 })))
            if (!sources.some((s) => s.n === n)) sources.push({ n, title: r.title, meta: `Web · ${hostOf(r.url)}`, url: r.url, quote: r.text.slice(0, 160) })
        }
        update((d) => {
          const m = d.conversations.find((x) => x.id === conversationId)?.messages.find((x) => x.id === replyId)
          if (m) {
            m.content = final
            m.status = ctrl.signal.aborted ? "stopped" : "done"
            m.mode = res.mode === "demo" ? "demo" : res.mode === "device" ? "device" : "live"
            if (thinking) ((m.thinking = thinking), (m.thinkMs = thinkMs || Date.now() - thinkStart))
            if (res.mode === "device") m.model = `local:${appMode === "chat" && !onDevice ? "nano" : localModel}`
            else if (res.mode === "demo") m.model = undefined
            m.sources = sources
          }
        })
        // Name new conversations after their first exchange.
        if (convo.messages.length === 0 && /^New conversation$/.test(convo.title)) {
          const words = text.trim().replace(/\s+/g, " ").split(" ")
          const fallback = (words.slice(0, 8).join(" ").replace(/[?.!,:;]+$/, "") + (words.length > 8 ? "…" : "")).replace(/^\w/, (c) => c.toUpperCase())
          const title = await complete(`Write a 3–6 word title for a conversation that starts with: "${text.slice(0, 400)}"`, { apiKey: state.prefs.apiKey, model: "claude-haiku-5-5", localModel: onDevice ? localModel : undefined }, fallback)
          update((d) => {
            const c = d.conversations.find((x) => x.id === conversationId)
            if (c) c.title = title.slice(0, 60)
          })
        }
      } catch (err) {
        window.clearInterval(timer)
        const aborted = ctrl.signal.aborted
        update((d) => {
          const m = d.conversations.find((x) => x.id === conversationId)?.messages.find((x) => x.id === replyId)
          if (m) {
            m.content = buffer || (aborted ? "" : `Something went wrong: ${(err as Error).message}`)
            m.status = aborted ? "stopped" : "error"
          }
        })
        if (!aborted) toast((err as Error).message || "The AI request failed", "error")
      } finally {
        controllers.delete(conversationId)
      }
    },
    [state, update, user, countMessage, google],
  )
}

/** Create a conversation and return its id. */
export function useNewConversation() {
  const { state, update } = useStore()
  return useCallback(
    (opts: { projectId?: string; assistantId?: string; web?: boolean; model?: string; title?: string; google?: boolean; appMode?: AppMode; localModel?: string } = {}) => {
      const id = uid("c-")
      const assistant = state.assistants.find((a) => a.id === opts.assistantId)
      update((d) => {
        d.conversations.unshift({
          id,
          title: opts.title ?? "New conversation",
          projectId: opts.projectId,
          assistantId: opts.assistantId,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          web: opts.web ?? assistant?.tools.web ?? false,
          model: opts.model ?? assistant?.model ?? state.prefs.defaultModel,
          google: opts.google,
          appMode: opts.appMode,
          localModel: opts.localModel,
        })
      })
      return id
    },
    [state.assistants, state.prefs.defaultModel, update],
  )
}
