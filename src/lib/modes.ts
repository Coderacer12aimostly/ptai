/** Paper Tech's four modes: Work, Chat, Code and Agent. */
import type { AppMode } from "./types"

export interface ModeInfo {
  id: AppMode
  label: string
  /** Base route for the mode */
  path: string
  tagline: string
  placeholder: string
  newLabel: string
  suggestions: string[]
}

export const MODES: ModeInfo[] = [
  {
    id: "work",
    label: "Work",
    path: "/app",
    tagline: "Projects, files, documents and your day.",
    placeholder: "Ask anything, or bring a little context…",
    newLabel: "New conversation",
    suggestions: [],
  },
  {
    id: "chat",
    label: "Chat",
    path: "/app/c",
    tagline: "A quick conversation about anything.",
    placeholder: "Message Paper Tech…",
    newLabel: "New chat",
    suggestions: ["Explain black holes in three sentences", "Give me five names for a coffee shop", "Help me write a polite reminder to a client", "What's a good 20-minute workout with no equipment?"],
  },
  {
    id: "code",
    label: "Code",
    path: "/app/code",
    tagline: "Write, fix and run code with a live preview.",
    placeholder: "Describe what to build, or paste code to fix…",
    newLabel: "New session",
    suggestions: ["Build a to-do list web page", "Make a digital clock in HTML and CSS", "Write a Python function that checks for palindromes", "Create a tip calculator page"],
  },
  {
    id: "agent",
    label: "Agent",
    path: "/app/agent",
    tagline: "Give it a task. It plans, uses tools and reports back.",
    placeholder: "Describe a task for the agent…",
    newLabel: "New task",
    suggestions: [
      "Find what our customer interviews say about pricing and write a summary document",
      "What is 18% of 2,450, and how much is that per month over 12 months?",
      "Check my calendar and email, then tell me what to focus on first",
      "Search my files for the launch date and add a countdown in days",
    ],
  },
]

export const modeInfo = (m?: AppMode) => MODES.find((x) => x.id === (m ?? "work"))!

/** The mode a route belongs to. */
export function modeOfPath(path: string): AppMode {
  if (path === "/app/c" || path.startsWith("/app/c/")) return "chat"
  if (path.startsWith("/app/code")) return "code"
  if (path.startsWith("/app/agent")) return "agent"
  return "work"
}

export const convoPath = (mode: AppMode | undefined, id: string) => (mode === "chat" ? `/app/c/${id}` : mode === "code" ? `/app/code/${id}` : mode === "agent" ? `/app/agent/${id}` : `/app/chat/${id}`)

/** Mode-specific guidance added to the system prompt. */
export function modeGuidance(mode: AppMode) {
  if (mode === "chat")
    return "This is Chat mode: a relaxed, general conversation. Answer directly and helpfully. Keep it short unless the user asks for depth. Use Markdown only when it helps."
  if (mode === "code")
    return [
      "This is Code mode. You are an expert programmer.",
      "Always put code in fenced Markdown blocks with a language tag (```html, ```css, ```javascript, ```python, …).",
      "For anything that runs in a browser (pages, widgets, games, demos), write ONE complete, self-contained HTML file in a single ```html block with the CSS and JavaScript inside it, so the user can preview it.",
      "Before the code, say in one or two sentences what you built. After it, list anything the user must change. Keep explanations short.",
    ].join("\n")
  return ""
}

/* ------------------------------------------------------------------ demo fallbacks */

const PAGE = (title: string, css: string, body: string, js: string) =>
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #f5f5f6; color: #1f1f22; }
${css}
  </style>
</head>
<body>
${body}
  <script>
${js}
  </script>
</body>
</html>`

const SAMPLES: Array<{ match: RegExp; intro: string; lang: string; code: string; outro: string }> = [
  {
    match: /to-?do|task list|checklist/i,
    intro: "Here's a to-do list page. You can add tasks, tick them off and clear finished ones. Tasks are saved in the browser.",
    lang: "html",
    code: PAGE(
      "To-do list",
      `    .card { width: min(420px, 92vw); background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px #0001; }
    h1 { margin: 0 0 16px; font-size: 22px; }
    form { display: flex; gap: 8px; }
    input[type=text] { flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 10px; font: inherit; }
    button { padding: 10px 14px; border: 0; border-radius: 10px; background: #2d2d32; color: #fff; font: inherit; cursor: pointer; }
    ul { list-style: none; padding: 0; margin: 16px 0 0; }
    li { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #eee; }
    li.done span { text-decoration: line-through; color: #999; }
    .clear { margin-top: 12px; background: transparent; color: #666; padding: 0; }`,
      `  <div class="card">
    <h1>My tasks</h1>
    <form id="form"><input id="text" type="text" placeholder="Add a task…" /><button>Add</button></form>
    <ul id="list"></ul>
    <button class="clear" id="clear">Clear finished</button>
  </div>`,
      `    let tasks = JSON.parse(localStorage.getItem("tasks") || "[]")
    const list = document.getElementById("list")
    function save() { localStorage.setItem("tasks", JSON.stringify(tasks)); render() }
    function render() {
      list.innerHTML = ""
      tasks.forEach((t, i) => {
        const li = document.createElement("li")
        li.className = t.done ? "done" : ""
        li.innerHTML = '<input type="checkbox"' + (t.done ? " checked" : "") + '><span></span>'
        li.querySelector("span").textContent = t.text
        li.querySelector("input").onchange = () => { tasks[i].done = !tasks[i].done; save() }
        list.appendChild(li)
      })
    }
    document.getElementById("form").onsubmit = (e) => {
      e.preventDefault()
      const text = document.getElementById("text").value.trim()
      if (text) tasks.push({ text, done: false })
      document.getElementById("text").value = ""
      save()
    }
    document.getElementById("clear").onclick = () => { tasks = tasks.filter((t) => !t.done); save() }
    render()`,
    ),
    outro: "Open **Preview** to try it. Want due dates or categories next?",
  },
  {
    match: /clock|time/i,
    intro: "Here's a digital clock that updates every second and shows the date underneath.",
    lang: "html",
    code: PAGE(
      "Digital clock",
      `    body { background: #161618; color: #ececee; }
    .clock { font: 700 min(18vw, 120px)/1 ui-monospace, monospace; letter-spacing: -0.04em; text-align: center; }
    .date { margin-top: 12px; font-size: 20px; color: #a3a3aa; text-align: center; }`,
      `  <div>
    <div class="clock" id="clock">00:00:00</div>
    <div class="date" id="date"></div>
  </div>`,
      `    function tick() {
      const now = new Date()
      document.getElementById("clock").textContent = now.toLocaleTimeString([], { hour12: false })
      document.getElementById("date").textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    }
    tick()
    setInterval(tick, 1000)`,
    ),
    outro: "Open **Preview** to see it run. I can add an alarm or a 12-hour switch if you like.",
  },
  {
    match: /tip|calculator|calc/i,
    intro: "Here's a tip calculator. Enter the bill, pick a tip and split it between people.",
    lang: "html",
    code: PAGE(
      "Tip calculator",
      `    .card { width: min(380px, 92vw); background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px #0001; display: grid; gap: 14px; }
    label { display: grid; gap: 6px; font-size: 14px; color: #555; }
    input { padding: 10px 12px; border: 1px solid #ddd; border-radius: 10px; font: inherit; }
    .total { font-size: 28px; font-weight: 700; }`,
      `  <div class="card">
    <h2 style="margin:0">Tip calculator</h2>
    <label>Bill ($)<input id="bill" type="number" value="48" min="0" step="0.01" /></label>
    <label>Tip (%)<input id="tip" type="range" min="0" max="30" value="18" /><span id="tipv">18%</span></label>
    <label>People<input id="people" type="number" value="2" min="1" /></label>
    <div>Each person pays</div>
    <div class="total" id="total"></div>
  </div>`,
      `    const $ = (id) => document.getElementById(id)
    function calc() {
      const bill = +$("bill").value || 0, tip = +$("tip").value, people = Math.max(1, +$("people").value || 1)
      $("tipv").textContent = tip + "%"
      $("total").textContent = "$" + ((bill * (1 + tip / 100)) / people).toFixed(2)
    }
    ["bill", "tip", "people"].forEach((id) => $(id).addEventListener("input", calc))
    calc()`,
    ),
    outro: "Open **Preview** to try it.",
  },
  {
    match: /python|palindrome/i,
    intro: "Here's a Python function that checks whether text reads the same backwards, ignoring spaces, punctuation and case.",
    lang: "python",
    code: `import re


def is_palindrome(text: str) -> bool:
    """Return True if text is a palindrome (ignores case, spaces and punctuation)."""
    cleaned = re.sub(r"[^a-z0-9]", "", text.lower())
    return cleaned == cleaned[::-1]


if __name__ == "__main__":
    for sample in ["Racecar", "A man, a plan, a canal: Panama", "Paper Tech"]:
        print(f"{sample!r}: {is_palindrome(sample)}")`,
    outro: "Run it with `python3 palindrome.py`. Python doesn't run in the browser preview, but HTML and JavaScript do.",
  },
]

const DEFAULT_SAMPLE = {
  intro: "Here's a small starter page with a button that counts clicks. Tell me what you'd like to build and I'll shape it from here.",
  lang: "html",
  code: PAGE(
    "Starter page",
    `    button { padding: 14px 22px; border: 0; border-radius: 12px; background: #2d2d32; color: #fff; font: 600 18px system-ui; cursor: pointer; }
    p { text-align: center; color: #666; }`,
    `  <div>
    <button id="btn">Clicked 0 times</button>
    <p>Built with Paper Tech 1 Renat</p>
  </div>`,
    `    let n = 0
    const btn = document.getElementById("btn")
    btn.onclick = () => { n++; btn.textContent = "Clicked " + n + (n === 1 ? " time" : " times") }`,
  ),
  outro: "Open **Preview** to try it.",
}

/** A ready-made coding answer used when no model can run in this browser. */
export function codeDemo(question: string) {
  const s = SAMPLES.find((x) => x.match.test(question)) ?? DEFAULT_SAMPLE
  return `${s.intro}\n\n\`\`\`${s.lang}\n${s.code}\n\`\`\`\n\n${s.outro}\n\n*Demo answer: this browser can't run Paper Tech 1 Renat (it needs WebGPU), so this is a built-in example.*`
}

/* ------------------------------------------------------------------ code blocks */

export interface CodeBlock {
  lang: string
  code: string
  /** Position in the message (0-based) */
  index: number
}

export function codeBlocks(md: string): CodeBlock[] {
  const out: CodeBlock[] = []
  const re = /```([\w+#.-]*)[^\n]*\n([\s\S]*?)(```|$)/g
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(md))) out.push({ lang: (m[1] || "text").toLowerCase(), code: m[2].replace(/\n$/, ""), index: i++ })
  return out
}

const LANG_NAMES: Record<string, string> = { js: "JavaScript", javascript: "JavaScript", ts: "TypeScript", typescript: "TypeScript", html: "HTML", css: "CSS", py: "Python", python: "Python", json: "JSON", bash: "Shell", sh: "Shell", sql: "SQL", jsx: "JSX", tsx: "TSX", text: "Text" }
export const langName = (l: string) => LANG_NAMES[l] ?? l.toUpperCase()
export const fileExt: Record<string, string> = { javascript: "js", js: "js", typescript: "ts", ts: "ts", html: "html", css: "css", python: "py", py: "py", json: "json", bash: "sh", sh: "sh", sql: "sql", jsx: "jsx", tsx: "tsx" }

/** Build a previewable page from the blocks of one answer (HTML, plus any CSS/JS blocks). */
export function previewDoc(blocks: CodeBlock[]): string | null {
  const html = blocks.find((b) => b.lang === "html")
  const css = blocks.filter((b) => b.lang === "css").map((b) => b.code).join("\n")
  const js = blocks.filter((b) => b.lang === "js" || b.lang === "javascript").map((b) => b.code).join("\n")
  if (!html && !js && !css) return null
  const hook = `<script>(()=>{const send=(t,a)=>parent.postMessage({__ptconsole:true,type:t,text:a.map(x=>{try{return typeof x==="string"?x:JSON.stringify(x)}catch{return String(x)}}).join(" ")},"*");for(const t of["log","info","warn","error"]){const o=console[t];console[t]=(...a)=>{send(t,a);o.apply(console,a)}}addEventListener("error",e=>send("error",[e.message]))})()</script>`
  if (html) {
    let doc = html.code
    if (css) doc = doc.includes("</head>") ? doc.replace("</head>", `<style>${css}</style></head>`) : `<style>${css}</style>` + doc
    if (js) doc = doc.includes("</body>") ? doc.replace("</body>", `<script>${js}</script></body>`) : doc + `<script>${js}</script>`
    return doc.includes("<head>") ? doc.replace("<head>", "<head>" + hook) : hook + doc
  }
  return `<!doctype html><html><head>${hook}<style>body{font-family:system-ui,sans-serif;padding:16px}${css}</style></head><body><div id="app"></div><script>${js}</script></body></html>`
}
