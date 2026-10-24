import type { Assistant, Conversation, Doc, KnowledgeFile, Notification, Project } from "./types"
import { DEFAULT_MODEL } from "./models"

const H = 3600_000
const D = 24 * H

/** Text content for the sample project's knowledge, written to IndexedDB on first run. */
export const SAMPLE_TEXT: Record<string, string> = {
  "f-interviews": `Customer interviews — Daybreak discovery (12 sessions, Oct 2026)

Participants: founders, design leads and operators at teams of 5–25 people.

Theme 1 — A fragmented morning. 9 of 12 participants described switching between tools before deciding what to prioritise. "I open five apps before I know what actually needs my attention." (P4, design lead). "By the time I've read Slack, my calendar and three boards, it's 10am and I haven't started anything." (P9, founder).

Theme 2 — Uncertainty costs more than time. Participants did not ask for more speed. They asked for confidence: "I don't need to do more. I need to know what matters first." (P2, operator). 7 of 12 said the worst part of the morning is not knowing whether they've missed something important.

Theme 3 — Rituals over dashboards. 8 of 12 already have a personal morning ritual (a notebook, a sticky note, a pinned doc). Several were tired of dashboards: "Another dashboard is another place to check." (P11).

Theme 4 — Small-team leads are the hub. Hands-on team leads coordinate work and still need time to do it themselves. They are the people others ask "what should I work on?".

Opportunity: a calm daily plan, grounded in the work that is already happening, that a lead can share with their team in one click.`,
  "f-brief": `Daybreak positioning brief (v3, Alex Kim)

Category: daily planning for small teams.
Audience: hands-on team leads in teams of 5–25 — founders, design leads, operators.
Problem: the day starts in a dozen places; priorities live across conversations, tasks and half-finished notes.
Promise: one clear plan to start the day, grounded in the work already happening.
Proof points: connects to the tools teams already use; summarises overnight changes; suggests the three things that matter most.
Tone: calm, human, a little optimistic. Avoid "productivity" clichés, "10x", "supercharge".
Working line: "Start your day with a plan. Not another tab."`,
  "f-competitors": `product,category,price_per_seat,primary_job,weakness_noted
Taskboard,Project management,10,Track tasks,Heavy setup; another place to check
Calendly-style schedulers,Scheduling,8,Book meetings,Doesn't help prioritise
Notes apps,Personal notes,0,Capture ideas,No team context
Chat-first AI tools,AI assistant,20,Answer questions,Not grounded in team work
Morning digest emails,Digest,0,Summarise updates,Read once and forgotten
Team dashboards,Analytics,15,Report status,Retrospective not actionable`,
  "f-voice": `Brand voice guidelines — Studio North

We sound like a thoughtful colleague: clear, warm, specific.
Do: short sentences; concrete moments ("It's 9:04"); plain verbs; one idea per paragraph.
Don't: hype ("revolutionary", "game-changing"), jargon, exclamation marks, "productivity" as a selling point.
Headlines: two short lines that turn — "Less busywork. More possibility."
Calls to action: invite, don't push — "Explore", "Meet", "Start with".`,
  "f-trends": `2026 work trends — summary notes (web source)

Fragmented workflows are making it harder to protect time for focused work. Knowledge workers report switching between apps dozens of times per hour, and many say they lack time and energy to do their job well. Teams increasingly look for tools that reduce context switching rather than add new surfaces.`,
}

export function sampleProjects(now = Date.now()): Project[] {
  return [
    { id: "p-daybreak", name: "Daybreak launch", description: "Research and storytelling for a calmer workday.", icon: "sunrise", tint: "sage", pinned: true, createdAt: now - 2 * D },
    { id: "p-insights", name: "Customer insights", description: "A shared understanding of the people we build for.", icon: "messages", tint: "sand", pinned: true, createdAt: now - 9 * D },
    { id: "p-brand", name: "Brand foundations", description: "Our voice, principles, and the story behind the work.", icon: "shapes", tint: "mist", pinned: true, createdAt: now - 20 * D },
  ]
}

export function sampleFiles(owner: string, now = Date.now()): KnowledgeFile[] {
  return [
    { id: "f-interviews", projectId: "p-daybreak", name: "Customer interviews.pdf", kind: "pdf", size: 2_400_000, owner: "Jonah Lee", updatedAt: now - 24 * 60_000, status: "ready", meta: "PDF · 24 pages", summary: "12 conversations with founders and team leads about their daily planning rituals.", chars: SAMPLE_TEXT["f-interviews"].length },
    { id: "f-brief", projectId: "p-daybreak", name: "Daybreak positioning brief", kind: "doc", size: 180_000, owner: "Alex Kim", updatedAt: now - 2 * D, status: "ready", meta: "Document · 8 pages", summary: "A daily planning ritual for small teams who want clarity, not another dashboard.", chars: SAMPLE_TEXT["f-brief"].length },
    { id: "f-competitors", projectId: "p-daybreak", name: "Competitive landscape.csv", kind: "csv", size: 128_000, owner: "Jonah Lee", updatedAt: now - 1 * D, status: "ready", meta: "CSV · 6 rows", summary: "How adjacent tools position themselves, with prices and gaps.", chars: SAMPLE_TEXT["f-competitors"].length },
    { id: "f-narrative", projectId: "p-daybreak", name: "Daybreak launch narrative", kind: "artifact", size: 12_000, owner, updatedAt: now - 38 * 60_000, status: "draft", meta: "Artifact · 246 words", docId: "d-narrative" },
    { id: "f-voice", projectId: "p-brand", name: "Brand voice guidelines.pdf", kind: "pdf", size: 1_100_000, owner: "Alex Kim", updatedAt: now - 3 * D, status: "ready", meta: "PDF · 12 pages", summary: "How Studio North sounds: clear, warm, specific.", chars: SAMPLE_TEXT["f-voice"].length },
    { id: "f-trends", projectId: "p-daybreak", name: "2026 Work Trends Index", kind: "link", size: 0, owner, updatedAt: now - 5 * H, status: "ready", meta: "Web link · microsoft.com", url: "https://www.microsoft.com/en-us/worklab", summary: "Fragmented workflows make it harder to protect time for focused work.", chars: SAMPLE_TEXT["f-trends"].length },
  ]
}

const RESEARCH_ANSWER = `## Lead with clarity, not productivity.

Daybreak's strongest entry point is the small-team lead whose day starts in a dozen places. They don't need to do more. They need to know what matters first.

1. **The audience: hands-on team leads.** Focus on founders, design leads, and operators in teams of 5–25. They coordinate work and still need time to do it. [1][2]
2. **The friction: a fragmented morning.** 9 of 12 interviewees described switching between tools before deciding what to prioritise. The cost is uncertainty, not just time. [1][4]
3. **The opening: a calmer daily ritual.** Position Daybreak as a quiet starting point: one clear plan, grounded in the work that is already happening. [2][3]

> "Start your day with a plan. Not another tab."`

export function sampleConversations(now = Date.now()): Conversation[] {
  return [
    {
      id: "c-research",
      title: "Launch audience research",
      projectId: "p-daybreak",
      assistantId: "a-researcher",
      createdAt: now - 12 * 60_000,
      updatedAt: now - 12 * 60_000,
      web: true,
      model: DEFAULT_MODEL,
      messages: [
        { id: "m1", role: "user", createdAt: now - 13 * 60_000, content: "Who should we focus on for the Daybreak launch? Use our customer interviews and recent research. I'm looking for the strongest audience and a clear messaging angle." },
        {
          id: "m2", role: "assistant", createdAt: now - 12 * 60_000, content: RESEARCH_ANSWER, status: "done", model: DEFAULT_MODEL,
          sources: [
            { n: 1, fileId: "f-interviews", title: "Customer interviews", meta: "PDF · 24 pages", quote: "I open five apps before I know what actually needs my attention." },
            { n: 2, fileId: "f-brief", title: "Daybreak positioning brief", meta: "Doc · Internal knowledge", quote: "A daily planning ritual for small teams who want clarity, not another dashboard." },
            { n: 3, fileId: "f-competitors", title: "Competitive landscape", meta: "CSV · 6 products" },
            { n: 4, fileId: "f-trends", title: "2026 Work Trends Index", meta: "Web · microsoft.com", url: "https://www.microsoft.com/en-us/worklab", quote: "Fragmented workflows are making it harder to protect time for focused work." },
          ],
        },
      ],
    },
    {
      id: "c-story",
      title: "A clearer launch story",
      projectId: "p-daybreak",
      createdAt: now - 40 * 60_000,
      updatedAt: now - 38 * 60_000,
      web: false,
      model: DEFAULT_MODEL,
      messages: [
        { id: "m3", role: "user", createdAt: now - 40 * 60_000, content: "What's the one-sentence story for Daybreak?" },
        { id: "m4", role: "assistant", createdAt: now - 39 * 60_000, status: "done", model: DEFAULT_MODEL, content: "**Daybreak gives small-team leads one calm plan to start the day — grounded in the work that's already happening.**\n\nIf you want it shorter for a headline: *Start your day with a plan. Not another tab.*" },
      ],
    },
    {
      id: "c-competitors",
      title: "Competitor landscape",
      projectId: "p-daybreak",
      createdAt: now - 1 * D,
      updatedAt: now - 1 * D,
      web: false,
      model: DEFAULT_MODEL,
      messages: [
        { id: "m5", role: "user", createdAt: now - 1 * D, content: "Summarise the competitive landscape in a short table." },
        { id: "m6", role: "assistant", createdAt: now - 1 * D, status: "done", model: DEFAULT_MODEL, content: "| Tool type | Job | Gap Daybreak fills |\n|---|---|---|\n| Project management | Track tasks | Heavy setup, another place to check |\n| Chat-first AI | Answer questions | Not grounded in the team's work |\n| Dashboards | Report status | Looks back, doesn't tell you what's next |\n| Digest emails | Summarise updates | Read once and forgotten |\n\nThe white space is a *daily ritual*: forward-looking, grounded, and shareable. [1]", sources: [{ n: 1, fileId: "f-competitors", title: "Competitive landscape", meta: "CSV · 6 products" }] },
      ],
    },
  ]
}

export function sampleAssistants(now = Date.now()): Assistant[] {
  return [
    {
      id: "a-researcher", name: "Launch researcher", tagline: "Sources first, always.", icon: "scan",
      instructions: "You are a thoughtful research partner. Start with our project sources, then use the web to fill gaps. Separate evidence from interpretation. Cite every factual claim. Be concise, specific, and honest about uncertainty.",
      model: DEFAULT_MODEL, tools: { web: true, knowledge: true, code: false }, creativity: 0.3, shared: true, updatedAt: now - 2 * H,
    },
    {
      id: "a-writer", name: "Writing partner", tagline: "Clearer words. Your voice.", icon: "pen",
      instructions: "You help the team write clearly in our brand voice: warm, specific, short sentences, no hype. When editing, keep the author's meaning and explain the biggest change in one line.",
      model: DEFAULT_MODEL, tools: { web: false, knowledge: true, code: false }, creativity: 0.6, shared: true, updatedAt: now - 1 * D,
    },
    {
      id: "a-thinker", name: "Thinking partner", tagline: "A fresh perspective.", icon: "bulb",
      instructions: "You are a curious sparring partner. Ask one sharp question when the problem is fuzzy, offer three distinct options when asked for ideas, and point out the strongest counter-argument.",
      model: DEFAULT_MODEL, tools: { web: true, knowledge: false, code: false }, creativity: 0.8, shared: false, updatedAt: now - 3 * D,
    },
  ]
}

export const NARRATIVE_HTML = `<h1>A clearer start.<br>A different kind of day.</h1>
<p><em>Daybreak · Launch narrative · October 2026</em></p>
<blockquote>It's 9:04. You've checked Slack, opened your calendar, and scanned three project boards. You know what everyone is doing. You're still not sure where to begin.</blockquote>
<h2>The work before the work</h2>
<p>For small teams, the day rarely starts in one place. Priorities live across conversations, tasks, and half-finished notes. Before the real work begins, there's a quieter job: making sense of it all.</p>
<h2>Meet your morning, differently.</h2>
<p>Daybreak brings your work into one clear daily plan. It helps you see what needs attention, choose what matters, and make room for the work only you can do.</p>
<blockquote>Start your day with a plan.<br>Not another tab.</blockquote>
<p><small>Informed by 12 customer interviews and the Daybreak positioning brief.</small></p>`

export function sampleDocs(now = Date.now()): Doc[] {
  return [
    {
      id: "d-narrative", title: "Daybreak launch narrative", projectId: "p-daybreak", html: NARRATIVE_HTML, status: "draft", updatedAt: now - 38 * 60_000,
      versions: [{ id: "v1", html: NARRATIVE_HTML.replace("It's 9:04. You've checked Slack, opened your calendar, and scanned three project boards. You know what everyone is doing. You're still not sure where to begin.", "Mornings are busy. Daybreak helps."), title: "Daybreak launch narrative", at: now - 50 * 60_000, note: "First draft" }],
      chat: [
        { id: "dm1", role: "user", createdAt: now - 45 * 60_000, content: "Turn our audience research into a launch narrative. Keep it clear, human, and a little optimistic. No productivity clichés." },
        { id: "dm2", role: "assistant", createdAt: now - 44 * 60_000, status: "done", content: "I've shaped the story around a calmer morning, with the small-team lead at its centre. The draft moves from a familiar problem to a simple promise." },
        { id: "dm3", role: "user", createdAt: now - 40 * 60_000, content: "Make the opening feel more concrete. Less manifesto, more Monday morning." },
        { id: "dm4", role: "assistant", createdAt: now - 39 * 60_000, status: "done", content: "**Opening updated.** The new opening starts with the moment before the work begins — 9:04, three tools open, still unsure where to start." },
      ],
    },
  ]
}

export function sampleNotifications(now = Date.now()): Notification[] {
  return [
    { id: "n1", who: "Jonah Lee", text: "Jonah added a source", sub: "Customer interviews.pdf", at: now - 24 * 60_000, read: false, href: "#/app/knowledge" },
    { id: "n2", who: "Alex Kim", text: "Alex updated a draft", sub: "Daybreak launch narrative", at: now - 60 * 60_000, read: false, href: "#/app/editor/d-narrative" },
    { id: "n3", who: "You", text: "You created a project", sub: "Daybreak launch", at: now - D, read: true, href: "#/app/knowledge/p-daybreak" },
  ]
}
