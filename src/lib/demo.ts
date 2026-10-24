/**
 * Offline demo engine. Used when no AI key is configured so every screen
 * still works end-to-end. It grounds answers in the user's own knowledge
 * (keyword retrieval) and streams like a real model. Swap in a real key
 * (server env var or Settings → AI connection) for real answers.
 */
import type { StreamOptions } from "./ai"
import type { Passage } from "./knowledge"
import type { GEvent, GMail } from "./google"

function composeDay(q: string, events: GEvent[], mail: GMail[]) {
  const lower = q.toLowerCase()
  const now = Date.now()
  const upcoming = events.filter((e) => Date.parse(e.end) >= now)
  const today = upcoming.filter((e) => new Date(e.start).toDateString() === new Date().toDateString())
  const time = (e: GEvent) => (e.allDay ? "All day" : new Date(e.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))
  const mins = (e: GEvent) => Math.round((Date.parse(e.start) - now) / 60000)
  const important = mail.filter((m) => m.important)

  const replyTo = /\b(reply to|respond to|draft a reply|draft a short|write back|answer this)\b/.test(lower) && !/\bbrief\b/.test(lower) ? mail.find((m) => lower.includes(m.from.split(" ")[0].toLowerCase()) || lower.includes(m.subject.toLowerCase().slice(0, 12))) ?? important[0] ?? mail[0] : null
  if (replyTo) {
    const first = replyTo.from.split(" ")[0]
    return `Here's a draft reply to **${replyTo.from}** about *“${replyTo.subject}”*:\n\n---\n\nHi ${first},\n\nThanks for this — ${replyTo.snippet.length > 20 ? "I've read through it and it's really helpful." : "really appreciated."} I'll take a closer look today and come back to you with next steps by tomorrow.\n\nIf it's easier, happy to talk it through${today.length ? ` after my ${time(today[today.length - 1])} meeting` : ""}.\n\nBest,\n[Your name]\n\n---\n\nWant it shorter, more formal, or with a specific answer?`
  }

  const next = upcoming.find((e) => !e.allDay)
  const parts = [`## Your day`]
  if (next) parts.push(`**Next up:** ${next.title} at ${time(next)}${mins(next) > 0 && mins(next) < 120 ? ` (in ${mins(next)} min)` : ""}${next.attendees ? ` with ${next.attendees} people` : ""}${next.meetLink ? " · Google Meet" : ""}.`)
  parts.push(`### Calendar`)
  parts.push(today.length ? today.map((e) => `- **${time(e)}** — ${e.title}${e.location ? ` · ${e.location}` : ""}`).join("\n") : "- Nothing else scheduled today.")
  parts.push(`### Inbox — ${mail.length} unread`)
  parts.push(mail.length ? mail.slice(0, 5).map((m) => `- **${m.from}:** ${m.subject} — ${m.snippet.slice(0, 90)}${m.snippet.length > 90 ? "…" : ""}`).join("\n") : "- Inbox zero. Nice.")
  const focus: string[] = []
  if (next) focus.push(`Prep for **${next.title}**${next.description ? ` — ${next.description.slice(0, 80).replace(/[.\s]+$/, "")}` : ""}.`)
  if (important[0]) focus.push(`Reply to **${important[0].from}** about “${important[0].subject}”.`)
  const last = today.filter((e) => !e.allDay).slice(-1)[0]
  focus.push(last ? `Protect time after ${new Date(last.end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} for focused work.` : "Block a focused hour this morning before messages pile up.")
  parts.push(`### Where to focus first`)
  parts.push(focus.map((f, i) => `${i + 1}. ${f}`).join("\n"))
  parts.push(`Want me to draft any of those replies?`)
  return parts.join("\n\n")
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function lastUser(o: StreamOptions) {
  return [...o.messages].reverse().find((m) => m.role === "user")?.content ?? ""
}

function sentence(s: string, max = 220) {
  const clean = s.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  return cut.slice(0, cut.lastIndexOf(" ")) + "…"
}

function quoteFrom(p: Passage) {
  const m = p.text.match(/[“"]([^”"]{28,160})[”"]/)
  return m ? m[1] : null
}

function topicOf(q: string) {
  const t = q
    .replace(/[?.!]+$/, "")
    .replace(/^(can you|could you|please|help me|i want to|i need to|let's|lets)\s+/i, "")
    .replace(/^(write|draft|create|make|give me|summari[sz]e|explain|brainstorm|research|find|tell me about|what is|what are|who is|how do i|how to)\s+/i, "")
  return t.length > 80 ? t.slice(0, 80) + "…" : t || "this"
}

/** Bold a short leading label ("Theme 1 — A fragmented morning." / "Audience:"). */
function lead(text: string, max = 230) {
  const t = sentence(text, max)
  const label = t.match(/^([A-Z][\w\s/&-]{1,28}):\s+(.*)$/)
  if (label) return `**${label[1]}:** ${label[2]}`
  const first = t.match(/^(.{6,70}?[.!?])\s+(.*)$/)
  if (first && first[1].split(" ").length <= 9) return `**${first[1]}** ${first[2]}`
  return t
}

/** Drop near-duplicate passages so each point says something new. */
function distinct(passages: Passage[], n: number) {
  const out: Passage[] = []
  for (const p of passages) {
    const key = p.text.slice(0, 50)
    if (!out.some((o) => o.text.slice(0, 50) === key)) out.push(p)
    if (out.length >= n) break
  }
  return out
}

function cites(passages: Passage[], i: number) {
  return `[${sourceIndex(passages, i)}]`
}

/** 1-based number of a file in first-seen order. */
function sourceIndex(passages: Passage[], idx: number) {
  const order: string[] = []
  for (const p of passages) if (!order.includes(p.file.id)) order.push(p.file.id)
  return order.indexOf(passages[idx].file.id) + 1
}

function compose(o: StreamOptions): string {
  const q = lastUser(o)
  const lower = q.toLowerCase()
  const passages = o.demo?.passages ?? []
  const topic = topicOf(q)
  const has = passages.length > 0

  if (o.demo?.kind === "edit") return composeEdit(q, o.demo.doc ?? "")
  if (o.demo?.google && /\b(day|today|tomorrow|calendar|meeting|meetings|schedule|agenda|inbox|email|emails|mail|brief|plate|focus|reply|respond)\b/.test(lower)) {
    return composeDay(q, o.demo.google.events, o.demo.google.mail)
  }

  if (/^(hi|hey|hello|yo|hiya|good (morning|afternoon|evening))\b/i.test(q.trim())) {
    return `Hi! I'm Paper Tech AI — a thinking partner for research and writing.\n\nA few things I can do right now:\n\n- **Research** a question using your project's sources${has ? "" : " (add files under *Add knowledge*)"}\n- **Draft** a brief, post, email or narrative\n- **Explore** a file — summarise it, pull quotes, find themes\n\nWhat are you working on?`
  }

  if (/\b(summar\w*|tl;?dr|overview|recap|key points|main points)\b/.test(lower)) {
    if (!has) return noSources(topic)
    const picks = distinct(passages, 4)
    const pts = picks.map((p) => `- ${lead(p.text, 200)} ${cites(passages, passages.indexOf(p))}`)
    const q1 = picks.map(quoteFrom).find(Boolean)
    return `## Summary\n\nHere are the key points from your sources:\n\n${pts.join("\n")}\n\n${q1 ? `> “${q1}”\n\n` : ""}Want me to go deeper on one of these, or turn them into a brief?`
  }

  if (/\b(brainstorm|ideas?|options|names?|taglines?|headlines?|angles?)\b/.test(lower)) {
    const seed = has ? sentence(passages[0].text, 120) : topic
    const q1 = has ? quoteFrom(passages[0]) : null
    return `Here are three directions for **${topic}**:\n\n1. **The concrete moment.** Open with a specific, recognisable scene — "It's 9:04 and you're still deciding where to start." Grounds the idea in real life.\n2. **The quiet promise.** Lead with the outcome people actually want: clarity and calm, not speed. *"Know what matters first."*\n3. **The contrast.** Name what you're *not*: "Not another dashboard. Not another tab." Sharp, memorable, easy to repeat.\n\n${has ? `These build on what your sources say: ${q1 ? `“${q1}”` : seed} ${cites(passages, 0)}\n\n` : ""}Want me to develop one of these into a full draft?`
  }

  if (/\b(write|draft|email|post|announcement|blog|copy|tweet|linkedin|letter|brief|narrative|pitch)\b/.test(lower)) {
    const isEmail = /\bemail\b/.test(lower)
    const point = has ? sentence(passages[0].text, 160) : `the core idea behind ${topic}`
    const q1 = has ? passages.map(quoteFrom).find(Boolean) : null
    if (isEmail) {
      return `**Subject:** A calmer way to start the day\n\nHi there,\n\nMost mornings start in a dozen places — chat, calendar, a few boards — before anyone knows what matters most. ${has ? `Our research found the same thing: ${point.toLowerCase()} ${cites(passages, 0)}` : ""}\n\nWe built something to help: one clear plan to start the day, grounded in the work that's already happening.\n\nWould you be open to a 20-minute look next week?\n\nBest,\n[Your name]`
    }
    return `## ${topic.charAt(0).toUpperCase() + topic.slice(1)}\n\nIt's 9:04. You've opened three tools and you still aren't sure where to begin. ${q1 ? `As one person put it: “${q1}” ${cites(passages, 0)}` : ""}\n\n${has ? point + " " + cites(passages, 0) : "Most teams don't need to do more. They need to know what matters first."}\n\nThat's the gap worth closing — a quiet starting point that turns scattered signals into one clear next step.\n\n> Start with a plan. Not another tab.\n\n*Want it shorter, more formal, or in a different format?*`
  }

  if (!has) return noSources(topic)

  const picks = distinct(passages, 3)
  const bullets = picks.map((p, i) => `${i + 1}. ${lead(p.text)} ${cites(passages, passages.indexOf(p))}`)
  const q1 = passages.map(quoteFrom).find(Boolean)
  const files = new Set(picks.map((p) => p.file.id)).size
  return `## What your sources say\n\nI looked across ${files} source${files === 1 ? "" : "s"} for “${topic}”. Here's what stands out:\n\n${bullets.join("\n")}\n\n${q1 ? `> “${q1}”\n\n` : ""}**Next step:** want me to turn this into a brief, or dig into one of these points?`
}

function noSources(topic: string) {
  return `Here's how I'd approach **${topic}**:\n\n1. **Frame the question.** What decision will this answer inform, and by when?\n2. **Gather evidence.** Add interviews, docs or links to a project so I can cite them.\n3. **Separate signal from noise.** Look for patterns that show up in more than one source.\n4. **Make it usable.** End with a one-line takeaway and a next step.\n\nI don't have any sources for this yet — upload files under **Add knowledge** and I'll ground my answer in them.`
}

function composeEdit(q: string, html: string) {
  const lower = q.toLowerCase()
  const div = document.createElement("div")
  div.innerHTML = html
  let note = ""

  if (/\b(bullet|list|takeaway)/.test(lower)) {
    const items = Array.from(div.querySelectorAll("li, p"))
      .map((e) => (e.textContent ?? "").replace(/\[\d+\]/g, "").trim())
      .filter((t) => t.split(" ").length > 5)
      .slice(0, 4)
      .map((t) => `<li>${t.split(/(?<=[.!?])\s/)[0]}</li>`)
    div.insertAdjacentHTML("beforeend", `<h2>Key takeaways</h2><ul>${items.join("") || "<li>One clear plan to start the day</li>"}</ul>`)
    note = "Added a short list of key takeaways at the end."
  } else if (/\b(title|headline|heading)\b/.test(lower)) {
    const h1 = div.querySelector("h1")
    if (h1) h1.innerHTML = "Start with a plan.<br>Not another tab."
    note = "Swapped the headline for the line people remembered most."
  } else if (/\b(shorten|shorter|concise|tighten|tight|trim|cut)/.test(lower)) {
    div.querySelectorAll("p").forEach((p) => {
      const parts = (p.textContent ?? "").split(/(?<=[.!?])\s+/)
      if (parts.length > 1) p.textContent = parts.slice(0, Math.ceil(parts.length / 2)).join(" ")
    })
    note = "Tightened every paragraph to its strongest sentences."
  } else if (/\b(warm|friendl|human|casual)/.test(lower)) {
    div.querySelectorAll("p").forEach((p) => {
      p.textContent = (p.textContent ?? "").replace(/\bteams\b/g, "teams like yours").replace(/\bIt helps\b/g, "It helps you")
    })
    note = "Warmed up the tone and spoke more directly to the reader."
  } else if (/\b(formal|professional)/.test(lower)) {
    div.querySelectorAll("p").forEach((p) => {
      p.textContent = (p.textContent ?? "").replace(/’|'/g, "'").replace(/\byou're\b/gi, "you are").replace(/\bthere's\b/gi, "there is").replace(/\bdon't\b/gi, "do not")
    })
    note = "Made the language more formal (no contractions)."
  } else {
    const topic = topicOf(q)
    div.insertAdjacentHTML(
      "beforeend",
      `<h2>${topic.charAt(0).toUpperCase() + topic.slice(1)}</h2><p>Here is a first pass at this section. It keeps the same calm voice as the rest of the draft and gives the reader one concrete next step.</p>`,
    )
    note = `Added a new section on “${topic}” at the end.`
  }
  return `${note} Review the highlighted changes in the document.\n<document>${div.innerHTML}</document>`
}

export async function demoReply(o: StreamOptions) {
  const text = compose(o)
  await sleep(450)
  // Stream word by word, but emit any <document> block in one go.
  const docAt = text.indexOf("<document>")
  const visible = docAt >= 0 ? text.slice(0, docAt) : text
  const tokens = visible.match(/\S+\s*|\s+/g) ?? []
  let out = ""
  for (const t of tokens) {
    if (o.signal?.aborted) return out
    out += t
    o.onText(t)
    await sleep(t.includes("\n") ? 30 : 12 + Math.random() * 22)
  }
  if (docAt >= 0) {
    out += text.slice(docAt)
    o.onText(text.slice(docAt))
  }
  return out
}
