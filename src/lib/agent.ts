/**
 * Agent mode: the model works through a task step by step, calling tools.
 * Tool calls use the <tool_call>{"name":…,"arguments":{…}}</tool_call> format that Qwen models
 * (the Paper Tech 1 family) are trained on. When no model can run here, a small built-in planner
 * drives the same tools so the agent still works.
 */
import { useCallback } from "react"
import { useStore } from "./store"
import { resolveMode, streamChat, type ChatTurn } from "./ai"
import { retrieve, type Passage } from "./knowledge"
import { renderMarkdown } from "../components/Markdown"
import { useGoogle } from "../components/GoogleProvider"
import { contextBlock } from "./google"
import type { AgentStep, AppState, Message } from "./types"
import { uid } from "./utils"
import { toast } from "../components/toast"
import { notesForImages, systemPrompt } from "./chat"
import { withImageNotes } from "./images"
import type { ImageRef } from "./types"

/* ------------------------------------------------------------------ tools */

interface ToolDef {
  name: string
  description: string
  parameters: Record<string, { type: string; description: string }>
  required: string[]
  label: (args: Record<string, string>) => string
}

export const TOOLS: ToolDef[] = [
  { name: "search_files", description: "Search the user's workspace files (projects & knowledge) and return the most relevant passages.", parameters: { query: { type: "string", description: "What to look for" } }, required: ["query"], label: (a) => `Searching your files for “${a.query ?? ""}”` },
  { name: "create_document", description: "Create a new document in the user's workspace editor. Use Markdown for the content.", parameters: { title: { type: "string", description: "Document title" }, content: { type: "string", description: "The document body in Markdown" } }, required: ["title", "content"], label: (a) => `Creating document “${a.title ?? "Untitled"}”` },
  { name: "calculator", description: "Evaluate a math expression, e.g. 0.18 * 2450 or (12 + 4) / 3. Supports + - * / ** ( ) and Math functions like sqrt, round, pow.", parameters: { expression: { type: "string", description: "The expression" } }, required: ["expression"], label: (a) => `Calculating ${a.expression ?? ""}` },
  { name: "run_javascript", description: "Run a short JavaScript snippet in a sandbox and return what it logs and returns. Use for data processing or checks.", parameters: { code: { type: "string", description: "JavaScript code; use console.log or return a value" } }, required: ["code"], label: () => "Running JavaScript" },
  { name: "current_time", description: "Get the current date and time.", parameters: {}, required: [], label: () => "Checking today's date" },
  { name: "calendar_and_email", description: "Read the user's upcoming calendar events and unread email (Google Workspace, read-only).", parameters: {}, required: [], label: () => "Reading your calendar and inbox" },
  { name: "web_search", description: "Search the web for current information and return the top results with their text and links (needs internet).", parameters: { query: { type: "string", description: "What to search for" } }, required: ["query"], label: (a) => `Searching the web for “${a.query ?? ""}”` },
  { name: "wikipedia", description: "Look up a topic on Wikipedia and return a short summary (needs internet).", parameters: { query: { type: "string", description: "Topic to look up" } }, required: ["query"], label: (a) => `Looking up “${a.query ?? ""}” on Wikipedia` },
]

const toolSchema = () =>
  JSON.stringify(
    TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: { type: "object", properties: t.parameters, required: t.required } } })),
  )

export function calculate(expr: string) {
  const e = expr.replace(/,/g, "").replace(/\^/g, "**").replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)").replace(/×/g, "*").replace(/÷/g, "/")
  if (!/^[\d\s+\-*/().a-z_]*$/i.test(e)) throw new Error("Only numbers, + - * / ** ( ) and Math functions are allowed")
  const allowed = new Set(Object.getOwnPropertyNames(Math))
  const names = (e.match(/[a-z_]+/gi) ?? []).filter((n) => !allowed.has(n))
  if (names.length) throw new Error(`Unknown name: ${names[0]}`)
  const v = Function("Math", `with (Math) { return (${e}) }`)(Math)
  if (typeof v !== "number" || !isFinite(v)) throw new Error("That doesn't give a number")
  return Math.round(v * 1e10) / 1e10
}

function runJS(code: string, ms = 3000): Promise<string> {
  return new Promise((resolve) => {
    const src = `const out=[];const log=(...a)=>out.push(a.map(x=>{try{return typeof x==="string"?x:JSON.stringify(x)}catch{return String(x)}}).join(" "));console.log=log;console.info=log;console.warn=log;console.error=log;
      onmessage=async(e)=>{try{const r=await (async()=>{${"\n"}${code}${"\n"}})();postMessage({ok:true,out,result:r===undefined?undefined:(typeof r==="string"?r:JSON.stringify(r))})}catch(err){postMessage({ok:false,out,error:String(err&&err.message||err)})}}`
    let w: Worker
    try {
      w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })))
    } catch (e) {
      return resolve(`Couldn't start the sandbox: ${(e as Error).message}`)
    }
    const t = setTimeout(() => (w.terminate(), resolve("Stopped: the code ran longer than 3 seconds.")), ms)
    w.onmessage = (e) => {
      clearTimeout(t)
      w.terminate()
      const d = e.data as { ok: boolean; out: string[]; result?: string; error?: string }
      const parts = [...d.out]
      if (d.result !== undefined) parts.push(`Returned: ${d.result}`)
      if (!d.ok) parts.push(`Error: ${d.error}`)
      resolve(parts.join("\n").slice(0, 2000) || "(no output)")
    }
    w.onerror = (e) => (clearTimeout(t), w.terminate(), resolve(`Error: ${e.message}`))
    w.postMessage(null)
  })
}

async function wikipedia(q: string) {
  const s = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=1&format=json&origin=*`).then((r) => r.json())
  const title = s?.[1]?.[0]
  if (!title) return `Nothing found on Wikipedia for “${q}”.`
  const p = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`).then((r) => r.json())
  return `${p.title}: ${p.extract ?? "(no summary)"}\nSource: ${p.content_urls?.desktop?.page ?? "https://en.wikipedia.org"}`
}

interface ToolContext {
  state: AppState
  createDoc: (title: string, md: string) => string
  google: ReturnType<typeof useGoogle>
}

async function runTool(name: string, args: Record<string, string>, ctx: ToolContext): Promise<{ output: string; href?: string }> {
  switch (name) {
    case "search_files": {
      const ps = await retrieve(ctx.state.files, String(args.query ?? ""), 4)
      if (!ps.length) return { output: "No matching passages in the workspace files." }
      return { output: ps.map((p, i) => `[${i + 1}] ${p.file.name}: ${p.text.replace(/\s+/g, " ").slice(0, 420)}`).join("\n") }
    }
    case "create_document": {
      const id = ctx.createDoc(String(args.title || "Untitled document"), String(args.content ?? ""))
      return { output: `Created the document “${args.title}”. It's open in the editor at #/app/editor/${id}.`, href: `#/app/editor/${id}` }
    }
    case "calculator":
      return { output: String(calculate(String(args.expression ?? ""))) }
    case "run_javascript":
      return { output: await runJS(String(args.code ?? "")) }
    case "current_time": {
      const d = new Date()
      return { output: `${d.toLocaleString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} (ISO ${d.toISOString().slice(0, 10)})` }
    }
    case "calendar_and_email": {
      const g = ctx.google
      if (!g.status?.connected) return { output: "Google Workspace isn't connected. The user can connect it (or try sample data) in Settings → Integrations." }
      return { output: contextBlock(g.events, g.mail.messages).slice(0, 2500) || "No upcoming events or unread email." }
    }
    case "web_search": {
      const { webSearch } = await import("./websearch")
      const rs = await webSearch(String(args.query ?? ""))
      if (!rs.length) return { output: `No web results for “${args.query ?? ""}”.` }
      return { output: rs.map((r, i) => `[${i + 1}] ${r.title} (${r.url}): ${r.text.replace(/\s+/g, " ").slice(0, 500)}`).join("\n") }
    }
    case "wikipedia":
      return { output: await wikipedia(String(args.query ?? "")) }
    default:
      throw new Error(`There's no tool called ${name}`)
  }
}

/* ------------------------------------------------------------------ parsing */

export function parseToolCall(text: string): { name: string; arguments: Record<string, string> } | null {
  const m = text.match(/<tool_call>\s*([\s\S]*?)\s*(<\/tool_call>|$)/)
  const raw = m?.[1] ?? (/^\s*\{\s*"name"/.test(text) ? text : null)
  if (!raw) return null
  const start = raw.indexOf("{")
  if (start < 0) return null
  // Find the matching closing brace (the model may add text after the JSON).
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < raw.length; i++) {
    const c = raw[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === "{") depth++
    else if (c === "}" && --depth === 0) {
      try {
        const j = JSON.parse(raw.slice(start, i + 1))
        if (typeof j.name === "string") return { name: j.name, arguments: j.arguments ?? j.parameters ?? {} }
      } catch {
        return null
      }
    }
  }
  return null
}

const AGENT_RULES = `This is Agent mode. Complete the user's task by working step by step with tools.

# Tools

You may call one function at a time to help with the task. Function signatures are inside <tools></tools>:
<tools>
%TOOLS%
</tools>

To call a function, reply with ONLY this, and nothing else:
<tool_call>
{"name": "<function-name>", "arguments": {<args-json-object>}}
</tool_call>

The result comes back inside <tool_response></tool_response>. Then decide the next step.
Rules: use search_files before answering anything about the user's own files; never invent tool results; at most 6 tool calls.
When the task is done, reply with the final answer for the user in Markdown (no tool call): what you did, what you found, and links to anything you created.`

/* ------------------------------------------------------------------ built-in planner (no model) */

const STOP = new Set("a an the and or of to for in on at by with about what which who how is are was were do does did my our your me i we you it this that find search look check tell give make write create add then from into please can could would should summary summarize document doc file files notes say says said".split(" "))

function demoPlan(task: string, results: Array<{ tool: string; output: string }>, notes = ""): { name: string; arguments: Record<string, string> } | null {
  const t = task.toLowerCase()
  const done = (n: string) => results.some((r) => r.tool === n)
  // Prices read from an attached image (e.g. a receipt): add them up.
  if (notes && /total|sum|add|spend|spent|how much|cost/.test(t) && !done("calculator")) {
    const amounts = notes
      .split("\n")
      .filter((l) => !/total|subtotal|balance|change|tax/i.test(l))
      // One price per line: "$4.50", "4,50 €" or a bare "4.50" at the end of a line.
      .flatMap((l) => {
        const m = l.match(/[$€£]\s?(\d+(?:[.,]\d{2})?)/) ?? l.match(/(\d+[.,]\d{2})\s*[$€£]?\s*$/)
        return m ? [m[1].replace(",", ".")] : []
      })
    if (amounts.length > 1) return { name: "calculator", arguments: { expression: amounts.join(" + ") } }
  }
  if (/calendar|email|inbox|meeting|my day|focus on/.test(t) && !done("calendar_and_email")) return { name: "calendar_and_email", arguments: {} }
  if (/search the web|web search|look up|look online|on the internet|online|latest|news|current|who is|what is the population|google it/.test(t) && !done("web_search")) {
    const kw = (t.match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w) && w.length > 2 && !/^(search|web|look|online|internet|google|latest|news)$/.test(w)).slice(0, 6).join(" ")
    return { name: "web_search", arguments: { query: kw || task } }
  }
  const wantsFiles = /file|interview|notes|research|launch|pricing|positioning|competitor|customer|project|workspace|our /.test(t)
  if (wantsFiles && !done("search_files")) {
    const kw = (t.match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w) && w.length > 2).slice(0, 5).join(" ")
    return { name: "search_files", arguments: { query: kw || task } }
  }
  const pct = t.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*\$?([\d,]+(?:\.\d+)?)/)
  if (pct && !done("calculator")) return { name: "calculator", arguments: { expression: `${pct[1]} / 100 * ${pct[2].replace(/,/g, "")}` } }
  const calcs = results.filter((r) => r.tool === "calculator").length
  const months = t.match(/over\s+(\d+)\s+months?/)
  if (pct && months && calcs === 1) return { name: "calculator", arguments: { expression: `${results.find((r) => r.tool === "calculator")!.output} / ${months[1]}` } }
  const expr = !pct && t.match(/(?:what is|calculate|compute)\s+([\d\s+\-*/().^,]+)/)
  if (expr && !done("calculator")) return { name: "calculator", arguments: { expression: expr[1].trim() } }
  if (/countdown|days until|how many days/.test(t) && !done("current_time")) return { name: "current_time", arguments: {} }
  if (/(write|create|make|draft).{0,40}(doc|summary|document|brief|report)/.test(t) && !done("create_document")) {
    const found = results.find((r) => r.tool === "search_files")?.output ?? ""
    const lines = found.split("\n").filter(Boolean).map((l) => `- ${l.replace(/^\[\d+\]\s*/, "").slice(0, 300)}`)
    const topic = (t.match(/(?:about|on)\s+([a-z ]{3,40})/)?.[1] ?? "your request").split(/\s+(?:and|then|to|in|for)\s+/)[0].trim()
    const title = `Summary: ${topic.replace(/\b\w/g, (c) => c.toUpperCase())}`
    return { name: "create_document", arguments: { title, content: `# ${title}\n\nWhat the workspace files say:\n\n${lines.join("\n") || "- No matching passages were found."}\n\n*Drafted by Paper Tech Agent.*` } }
  }
  return null
}

function demoFinal(task: string, results: Array<{ tool: string; output: string; href?: string }>) {
  if (!results.length) return "I couldn't find a tool that fits this task in demo mode. On a browser with WebGPU, **Paper Tech 1 Wave** can plan this properly."
  const parts = ["Here's what I did:\n"]
  for (const r of results) {
    if (r.tool === "search_files") parts.push(`- **Searched your files** and found ${r.output.startsWith("No matching") ? "nothing relevant" : `${r.output.split("\n").length} relevant passages`}.`)
    if (r.tool === "calculator") parts.push(`- **Calculated:** ${r.output}`)
    if (r.tool === "create_document") parts.push(`- **Created a document**: [open it](${r.href}).`)
    if (r.tool === "current_time") parts.push(`- **Today is** ${r.output.split(" (")[0]}.`)
    if (r.tool === "calendar_and_email") parts.push(`- **Checked your calendar and inbox.**`)
    if (r.tool === "web_search")
      parts.push(
        r.output.startsWith("No web results")
          ? `- **Searched the web** but found nothing.`
          : `- **Searched the web:**\n${r.output.split("\n").map((l) => { const m = l.match(/^\[(\d+)\] (.*?) \((https?:[^)]+)\): (.*)$/); return m ? `  - [${m[2]}](${m[3]}): ${m[4].slice(0, 220)}…` : `  - ${l.slice(0, 220)}` }).join("\n")}`,
      )
  }
  const cal = results.find((r) => r.tool === "calendar_and_email")
  if (cal && !cal.output.startsWith("Google Workspace isn't")) {
    const first = cal.output.split("\n").find((l) => /\d{1,2}:\d{2}|am|pm/i.test(l))
    parts.push(`\n**Focus first:** ${first ? first.replace(/^[-•*\s]+/, "") : "your next meeting"}, then reply to the unread email that mentions a deadline.`)
  } else if (cal) parts.push("\nConnect Google Workspace in **Settings → Integrations** (or turn on sample data) and ask again.")
  const now = results.find((r) => r.tool === "current_time")
  const search = results.find((r) => r.tool === "search_files")
  if (now && search) {
    const m = search.output.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/)
    if (m) {
      const today = new Date()
      let target = new Date(`${m[1]} ${m[2]}, ${today.getFullYear()}`)
      if (target < today) target = new Date(`${m[1]} ${m[2]}, ${today.getFullYear() + 1}`)
      const days = Math.ceil((target.getTime() - today.getTime()) / 864e5)
      parts.push(`\n**${m[1]} ${m[2]}** is **${days} days** away.`)
    }
  }
  const calc = results.filter((r) => r.tool === "calculator")
  if (calc.length) parts.push(`\n**Answer:** ${calc.map((c) => c.output).join(" → ")}`)
  parts.push(`\n*Demo agent: this browser can't run Paper Tech 1 Wave, so a built-in planner used the same tools for “${task.slice(0, 80)}”.*`)
  return parts.join("\n")
}

/* ------------------------------------------------------------------ the agent loop */

const controllers = new Map<string, AbortController>()
export const stopAgent = (id: string) => controllers.get(id)?.abort()

export function useRunAgent() {
  const { state, update, user } = useStore()
  const google = useGoogle()

  return useCallback(
    async (conversationId: string, task: string, images: ImageRef[] = []) => {
      const convo = state.conversations.find((c) => c.id === conversationId)
      if (!convo || (!task.trim() && !images.length)) return
      if (!task.trim()) task = "Look at the attached image and tell me what's important in it."
      const localModel = convo.localModel ?? state.prefs.modeModels?.agent ?? "pt1-wave"
      const mode = await resolveMode(state.prefs.apiKey, localModel)
      const replyId = uid("m-")
      const userMsg: Message = { id: uid("m-"), role: "user", content: task.trim(), createdAt: Date.now(), ...(images.length ? { images } : {}) }
      update((d) => {
        const c = d.conversations.find((x) => x.id === conversationId)!
        c.messages.push(userMsg, { id: replyId, role: "assistant", content: "", createdAt: Date.now(), status: "streaming", steps: [], model: mode === "device" ? `local:${localModel}` : convo.model })
        c.updatedAt = Date.now()
        if (c.title === "New conversation") c.title = task.trim().replace(/\s+/g, " ").slice(0, 56) + (task.length > 56 ? "…" : "")
      })
      const patch = (fn: (m: Message) => void) =>
        update((d) => {
          const m = d.conversations.find((x) => x.id === conversationId)?.messages.find((x) => x.id === replyId)
          if (m) fn(m)
        })
      const ctrl = new AbortController()
      controllers.set(conversationId, ctrl)
      const ctx: ToolContext = {
        state,
        google,
        createDoc: (title, md) => {
          const id = uid("d-")
          update((d) => void d.docs.unshift({ id, title, html: renderMarkdown(md), status: "draft", updatedAt: Date.now(), versions: [], chat: [] }))
          return id
        },
      }
      // Attached images: read/look at them first, then treat the findings as part of the task.
      let taskText = task.trim()
      if (images.length) {
        const notes = await notesForImages(images, task, { useVision: state.prefs.visionImages !== false, signal: ctrl.signal, onPhase: (p) => patch((m) => void (m.phase = p)) })
        patch((m) => void (m.phase = undefined))
        update((d) => {
          const m = d.conversations.find((x) => x.id === conversationId)?.messages.find((x) => x.id === userMsg.id)
          if (m) m.imageNotes = notes.text
        })
        taskText = withImageNotes(taskText, notes.text)
      }
      const results: Array<{ tool: string; output: string; href?: string }> = []
      const doStep = async (call: { name: string; arguments: Record<string, string> }) => {
        const def = TOOLS.find((t) => t.name === call.name)
        const step: AgentStep = { id: uid("s-"), tool: call.name, label: def ? def.label(call.arguments) : `Using ${call.name}`, input: JSON.stringify(call.arguments), status: "running" }
        patch((m) => void (m.steps = [...(m.steps ?? []), step]))
        let output = ""
        let href: string | undefined
        let ok = true
        try {
          const r = await runTool(call.name, call.arguments, ctx)
          output = r.output
          href = r.href
        } catch (e) {
          ok = false
          output = `Error: ${(e as Error).message}`
        }
        results.push({ tool: call.name, output, href })
        patch((m) => {
          const s = m.steps?.find((x) => x.id === step.id)
          if (s) Object.assign(s, { output, href, status: ok ? "done" : "error" })
        })
        return output
      }

      try {
        if (mode === "demo") {
          // Built-in planner: same tools, simple rules.
          for (let i = 0; i < 5 && !ctrl.signal.aborted; i++) {
            const call = demoPlan(task, results, taskText === task.trim() ? "" : taskText)
            if (!call) break
            await new Promise((r) => setTimeout(r, 450))
            await doStep(call)
          }
          const final = demoFinal(task, results)
          let shown = ""
          for (const w of final.match(/\S+\s*|\s+/g) ?? []) {
            if (ctrl.signal.aborted) break
            shown += w
            const snap = shown
            patch((m) => void (m.content = snap))
            await new Promise((r) => setTimeout(r, 10))
          }
          patch((m) => ((m.status = ctrl.signal.aborted ? "stopped" : "done"), (m.mode = "demo")))
          return
        }

        const system =
          systemPrompt({ workspace: state.workspace?.name, user: user?.name, hasSources: false, web: false, appMode: "agent" }) +
          "\n\n" +
          AGENT_RULES.replace("%TOOLS%", toolSchema())
        const history: ChatTurn[] = convo.messages
          .filter((m) => m.status !== "error" && m.content.trim())
          .map((m) => ({ role: m.role, content: m.role === "user" ? withImageNotes(m.content, m.imageNotes) : m.content }))
          .slice(-6)
        const turns: ChatTurn[] = [...history, { role: "user", content: taskText }]
        let thinking = ""
        for (let step = 0; step < 7 && !ctrl.signal.aborted; step++) {
          let out = ""
          const res = await streamChat({
            messages: step === 6 ? [...turns, { role: "user", content: "Stop using tools now and give your final answer." }] : turns,
            system,
            model: convo.model,
            apiKey: state.prefs.apiKey,
            signal: ctrl.signal,
            localModel,
            maxTokens: 1024,
            onThinking: (t) => {
              thinking += t
              const snap = thinking
              patch((m) => void (m.thinking = snap))
            },
            onText: (t) => {
              out += t
              // Show the answer as it streams, but hide tool-call markup.
              if (!/<tool_call>|^\s*\{\s*"name"/.test(out) && !/^\s*<tool/.test(out)) {
                const snap = out
                patch((m) => void (m.content = snap))
              }
            },
            demo: { passages: [] as Passage[], appMode: "agent" },
          })
          const text = out || res.text
          const call = parseToolCall(text)
          if (!call || step === 6) {
            patch((m) => ((m.content = text.replace(/<\/?tool_call>/g, "").trim()), (m.status = ctrl.signal.aborted ? "stopped" : "done"), (m.mode = res.mode === "device" ? "device" : "live")))
            return
          }
          patch((m) => void (m.content = ""))
          const output = await doStep(call)
          turns.push({ role: "assistant", content: `<tool_call>\n${JSON.stringify(call)}\n</tool_call>` }, { role: "user", content: `<tool_response>\n${output.slice(0, 2400)}\n</tool_response>` })
        }
        patch((m) => void (m.status = "stopped"))
      } catch (err) {
        const aborted = ctrl.signal.aborted
        patch((m) => ((m.status = aborted ? "stopped" : "error"), (m.content = m.content || (aborted ? "" : `Something went wrong: ${(err as Error).message}`))))
        if (!aborted) toast((err as Error).message || "The agent stopped", "error")
      } finally {
        controllers.delete(conversationId)
      }
    },
    [state, update, user, google],
  )
}
