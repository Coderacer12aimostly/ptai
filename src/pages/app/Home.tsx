import { useState } from "react"
import { ArrowUpRight, Command, FileText, MessageSquare, Paperclip, PenLine, ScanSearch } from "lucide-react"
import Composer from "../../components/Composer"
import { LocalSetupCard } from "../../components/LocalAI"
import { Avatar, Badge, Button } from "../../components/ui"
import { ProjectIcon, TINTS } from "../../components/icons"
import { useStore } from "../../lib/store"
import { convoPath } from "../../lib/modes"
import { stashImages } from "../../lib/images"
import type { ImageRef } from "../../lib/types"
import { navigate } from "../../lib/router"
import { useNewConversation } from "../../lib/chat"
import { cx, greeting, timeAgo } from "../../lib/utils"
import { useShell } from "../../components/AppShell"
import { useGoogle } from "../../components/GoogleProvider"
import { GoogleG } from "../../components/icons"
import { eventTime, startsIn } from "../../lib/google"

export default function Home() {
  const { state, user } = useStore()
  const { openProject, openSearch } = useShell()
  const newConversation = useNewConversation()
  const focus = state.projects.find((p) => p.pinned) ?? state.projects[0]
  const [projectId, setProjectId] = useState<string | undefined>(focus?.id)
  const [model, setModel] = useState(state.prefs.defaultModel)
  const [web, setWeb] = useState(false)
  const google = useGoogle()
  const [useG, setUseG] = useState(false)
  const [prefill, setPrefill] = useState({ text: "", n: 0 })
  const first = user?.name.split(" ")[0] ?? ""

  const recent = [
    ...state.conversations.map((c) => ({
      id: c.id,
      kind: "chat" as const,
      title: c.title,
      at: c.updatedAt,
      sub: `${state.files.filter((f) => f.projectId === c.projectId && f.status === "ready").length} sources · ${state.projects.find((p) => p.id === c.projectId)?.name ?? "No project"}`,
      href: `#${convoPath(c.appMode, c.id)}`,
      icon: c.web ? ScanSearch : MessageSquare,
    })),
    ...state.docs.map((d) => ({
      id: d.id,
      kind: "doc" as const,
      title: d.title,
      at: d.updatedAt,
      sub: `Draft v${d.versions.length + 1} · Edited with Paper Tech`,
      href: `#/app/editor/${d.id}`,
      icon: FileText,
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 4)

  const stats = focus
    ? {
        sources: state.files.filter((f) => f.projectId === focus.id && f.kind !== "artifact").length,
        convos: state.conversations.filter((c) => c.projectId === focus.id).length,
        drafts: state.docs.filter((d) => d.projectId === focus.id).length,
      }
    : null

  function send(text: string, images: ImageRef[] = []) {
    const id = newConversation({ projectId, model, web, google: useG })
    stashImages(id, images)
    navigate(`/app/chat/${id}?q=${encodeURIComponent(text)}`)
  }

  const chips = [
    { icon: ScanSearch, label: "Research a topic", text: "Research " },
    { icon: PenLine, label: "Draft something", text: "Draft a " },
    { icon: Paperclip, label: "Explore a file", text: "Summarise the key points from our sources" },
  ]

  return (
    <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-8 md:px-10 md:py-12 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="display mt-3 text-[34px] font-semibold md:text-[42px]">
          {greeting()}, {first}.
          <br />
          <span className="text-muted">Where should we take things?</span>
        </h1>
        <p className="mt-3 text-[15px] text-muted">Pick up a thread, explore a question, or start something new.</p>

        <div className="mt-6">
          <LocalSetupCard />
        </div>
        <div className="mt-6">
          <Composer
            key={prefill.n}
            initial={prefill.text}
            size="lg"
            autoFocus={prefill.n > 0}
            placeholder="Ask anything, or bring a little context…"
            onSend={send}
            model={model}
            onModel={setModel}
            web={web}
            onWeb={setWeb}
            projectId={projectId}
            onProject={setProjectId}
            google={useG}
            onGoogle={setUseG}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.label}
                onClick={() => (c.label === "Explore a file" && !projectId ? navigate("/app/upload") : setPrefill((p) => ({ text: c.text, n: p.n + 1 })))}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:border-accent-line hover:text-ink"
              >
                <c.icon className="size-4" strokeWidth={1.7} />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[17px] font-medium">Pick up where you left off</h2>
            <a href="#/app/chats" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
              View all <ArrowUpRight className="size-3.5" />
            </a>
          </div>
          {recent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-[13.5px] text-muted">Your conversations and drafts will show up here.</div>
          ) : (
            <div className="space-y-3">
              {recent.map((r) => (
                <a key={r.id} href={r.href} className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-card">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-accent">
                    <r.icon className="size-[18px]" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium">{r.title}</span>
                      {r.kind === "doc" && <Badge>Draft</Badge>}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-muted">{r.sub}</span>
                  </span>
                  <span className="hidden text-[11.5px] text-faint sm:block">{timeAgo(r.at)}</span>
                  <ArrowUpRight className="size-4 text-faint transition-colors group-hover:text-accent" />
                </a>
              ))}
            </div>
          )}
        </div>
        <button onClick={openSearch} className="mt-8 inline-flex items-center gap-2 text-[12.5px] text-faint hover:text-muted">
          <Command className="size-3.5" /> A shortcut to anything. Press ⌘ K to search your workspace.
        </button>
      </div>

      <aside className="space-y-8">
        {focus && stats ? (
          <a href={`#/app/knowledge/${focus.id}`} className={cx("group block rounded-2xl p-6", TINTS[focus.tint])}>
            <div className="flex items-center justify-between">
              <span className="eyebrow">In focus</span>
              <ArrowUpRight className="size-4 text-muted group-hover:text-accent" />
            </div>
            <div className="mt-5 text-accent">
              <ProjectIcon icon={focus.icon} className="size-7" />
            </div>
            <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">{focus.name}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{focus.description}</p>
            <div className="mt-5 flex items-center -space-x-1.5">
              {(state.workspace?.members ?? []).slice(0, 4).map((m) => (
                <Avatar key={m.id} name={m.name} size={26} />
              ))}
              <span className="pl-3 text-[12px] text-muted">{state.workspace?.members.length} collaborators</span>
            </div>
            <div className="mt-5 grid grid-cols-3 border-t border-line pt-5">
              {[
                [stats.sources, "sources"],
                [stats.convos, "conversations"],
                [stats.drafts, "drafts"],
              ].map(([n, l]) => (
                <div key={l as string}>
                  <p className="text-[22px] font-semibold">{n}</p>
                  <p className="text-[11px] text-muted">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[12.5px] text-accent">Open project →</p>
          </a>
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center">
            <p className="text-[14px] font-medium">Start a project</p>
            <p className="mt-1 text-[12.5px] text-muted">Projects keep sources, conversations and drafts together.</p>
            <Button className="mt-4" size="sm" onClick={openProject}>
              New project
            </Button>
          </div>
        )}

        <div>
          <h3 className="mb-4 text-[15px] font-medium">Around your workspace</h3>
          {state.notifications.length === 0 && <p className="text-[13px] text-muted">Quiet for now.</p>}
          <ul className="space-y-5">
            {state.notifications.slice(0, 3).map((n) => (
              <li key={n.id}>
                <a href={n.href} className="flex gap-3">
                  <Avatar name={n.who ?? "Paper Tech"} size={28} />
                  <span className="min-w-0">
                    <span className="block text-[12.5px]">{n.text}</span>
                    {n.sub && <span className="block truncate text-[12px] text-muted">{n.sub}</span>}
                    <span className="block text-[11px] text-faint">{timeAgo(n.at)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {google.status?.connected ? (
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <GoogleG className="size-3.5" /> Your day
              </p>
              <a href="#/app/today" className="text-[12px] text-accent hover:underline">
                Open Today →
              </a>
            </div>
            <ul className="mt-3 space-y-2.5">
              {google.events.filter((e) => Date.parse(e.end) >= Date.now()).slice(0, 3).map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 text-[12.5px]">
                  <span className="w-[62px] shrink-0 font-mono text-[11px] text-muted">{eventTime(e)}</span>
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  <span className="shrink-0 text-[11px] text-accent">{startsIn(e)}</span>
                </li>
              ))}
              {google.has("calendar") && google.events.length === 0 && <li className="text-[12.5px] text-muted">No more meetings today.</li>}
            </ul>
            {google.has("gmail") && (
              <p className="mt-3 border-t border-line-soft pt-3 text-[12.5px] text-muted">
                <b className="font-medium text-ink">{google.mail.unread}</b> unread email{google.mail.unread === 1 ? "" : "s"}
                {google.mail.messages[0] ? ` · latest from ${google.mail.messages[0].from}` : ""}
              </p>
            )}
            <button
              className="mt-3 text-[12.5px] text-accent hover:underline"
              onClick={() => navigate(`/app/chat/${newConversation({ google: true, title: "Daily briefing" })}?q=${encodeURIComponent("Brief me on my day: what's on my calendar, which emails need a reply, and what should I focus on first?")}`)}
            >
              Brief me on my day →
            </button>
          </div>
        ) : (
          <a href="#/app/settings/integrations" className="block rounded-xl border border-line bg-surface p-5 hover:shadow-card">
            <p className="flex items-center gap-2 text-[13px] font-medium">
              <GoogleG className="size-4" /> Link your Google Workspace
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">Get meeting reminders, new-email alerts and Drive updates — and let Paper Tech brief you on your day.</p>
            <p className="mt-3 text-[12.5px] text-accent">Connect Google →</p>
          </a>
        )}
      </aside>
    </div>
  )
}
