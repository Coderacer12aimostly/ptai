import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Bell,
  ChevronDown,
  ChevronRight,
  PencilLine,
  Trash2,
  ChevronsUpDown,
  CircleHelp,
  Command,
  FileText,
  FolderOpen,
  House,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Upload,
  X,
  Zap,
} from "lucide-react"
import { Avatar, Badge, Kbd, Menu, MenuItem, Modal, PaperMark, Wordmark } from "./ui"
import { AssistantIcon, FileIcon, ProjectIcon } from "./icons"
import ProjectModal from "./ProjectModal"
import { useStore } from "../lib/store"
import { navigate } from "../lib/router"
import { cx, timeAgo } from "../lib/utils"
import { aiLabel, resolveMode, type AIMode } from "../lib/ai"
import { useLocalStatus } from "../lib/local"
import { LocalStatusCard } from "./LocalAI"
import { planById } from "../lib/plans"
import { useNewConversation } from "../lib/chat"
import { useNewDoc } from "../lib/docs"
import { GoogleProvider, useGoogle } from "./GoogleProvider"
import { navigate as nav2, useRoute } from "../lib/router"
import { CalendarDays, Cpu } from "lucide-react"
import { MODES, convoPath, modeInfo, modeOfPath } from "../lib/modes"
import { ModeIcon } from "../pages/app/Mode"
import type { AppMode } from "../lib/types"
import { toast } from "./toast"

/* ---------- Topbar slot: pages can put actions in the top bar ---------- */
export function TopbarActions({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setEl(document.getElementById("topbar-actions"))
  }, [])
  return el ? createPortal(children, el) : null
}

const ShellCtx = createContext<{ openProject: () => void; openSearch: () => void; openHelp: () => void }>({ openProject: () => {}, openSearch: () => {}, openHelp: () => {} })
export const useShell = () => useContext(ShellCtx)

export function useAIMode(modelKey?: string) {
  const { state } = useStore()
  const [mode, setMode] = useState<AIMode | null>(null)
  const local = useLocalStatus()
  useEffect(() => {
    let live = true
    resolveMode(state.prefs.apiKey, modelKey).then((m) => live && setMode(m))
    aiLabel(state.prefs.apiKey, modelKey).then((l) => live && setLabelGlobal(l))
    return () => {
      live = false
    }
  }, [state.prefs.apiKey, state.prefs.localAI, state.prefs.localModel, modelKey, local.phase])
  return mode
}

let labelGlobal = "AI"
const labelListeners = new Set<(l: string) => void>()
function setLabelGlobal(l: string) {
  labelGlobal = l
  labelListeners.forEach((f) => f(l))
}
export function useAILabel() {
  const [l, setL] = useState(labelGlobal)
  useEffect(() => {
    labelListeners.add(setL)
    return () => void labelListeners.delete(setL)
  }, [])
  return l
}

function NavItem({ href, icon, label, active, hint, onClick }: { href?: string; icon: React.ReactNode; label: string; active?: boolean; hint?: React.ReactNode; onClick?: () => void }) {
  const cls = cx(
    "flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-[14px] transition-colors [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:stroke-[1.75]",
    active ? "bg-panel font-medium text-ink" : "text-ink/85 hover:bg-panel/70 hover:text-ink",
  )
  const inner = (
    <>
      {icon}
      <span className="flex-1 truncate text-left">{label}</span>
      {hint}
    </>
  )
  return href ? (
    <a href={href} className={cls} aria-current={active ? "page" : undefined}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

function ModeSwitcher({ mode }: { mode: AppMode }) {
  return (
    <div className="grid grid-cols-4 gap-0.5 rounded-xl bg-panel/80 p-[3px]" role="tablist" aria-label="Mode">
      {MODES.map((m) => (
        <a
          key={m.id}
          href={`#${m.path}`}
          role="tab"
          aria-selected={mode === m.id}
          title={`${m.label} — ${m.tagline}`}
          className={cx(
            "flex items-center justify-center gap-1.5 rounded-[9px] py-1.5 text-[12px] font-medium transition-colors",
            mode === m.id ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/8%)]" : "text-muted hover:text-ink",
          )}
        >
          <ModeIcon mode={m.id} className="size-[14px]" />
          <span className="hidden xl:inline">{m.label}</span>
          <span className="sr-only xl:hidden">{m.label}</span>
        </a>
      ))}
    </div>
  )
}

const convoHref = (c: { id: string; appMode?: AppMode }) => (c.appMode && c.appMode !== "work" ? convoPath(c.appMode, c.id) : `/app/chat/${c.id}`)

function Sidebar({ path, onNavigate, onCollapse }: { path: string; onNavigate?: () => void; onCollapse?: () => void }) {
  const { state, user, signOut, update } = useStore()
  const { openSearch, openHelp } = useShell()
  const newConversation = useNewConversation()
  const google = useGoogle()
  const ws = state.workspace!
  const plan = planById(ws.plan)
  const appMode = modeOfPath(path)
  const recentsOpen = !state.prefs.integrations.__recentsClosed
  const recents = [...state.conversations].filter((c) => c.messages.length || path === convoHref(c)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40)
  const trialDays = ws.trialEndsAt ? Math.ceil((ws.trialEndsAt - Date.now()) / 864e5) : 0
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
  const dark = document.documentElement.classList.contains("dark")
  const startNew = () => {
    if (appMode === "work") navigate(`/app/chat/${newConversation({ projectId: undefined })}`)
    else navigate(modeInfo(appMode).path)
    onNavigate?.()
  }

  return (
    <div className="flex h-full flex-col bg-sidebar" onClick={(e) => (e.target as HTMLElement).closest("a") && onNavigate?.()}>
      <div className="flex items-center gap-1 px-3 pt-3 pb-3">
        <a href="#/app/c" className="flex items-center gap-2 rounded-lg px-1.5 py-1" title="Paper Tech">
          <PaperMark className="size-6" />
          <Wordmark className="h-[18px]" />
          <span className="sr-only">Paper Tech AI</span>
        </a>
        <div className="flex-1" />
        {onCollapse && (
          <button onClick={onCollapse} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-panel hover:text-ink" aria-label="Hide sidebar" title={`Hide sidebar (${isMac ? "⌘" : "Ctrl"} \\)`}>
            <PanelLeft className="size-[18px]" />
          </button>
        )}
      </div>
      <div className="px-3">
        <ModeSwitcher mode={appMode} />
      </div>

      <nav className="mt-3 grid gap-px px-2">
        <NavItem icon={<Plus />} label={modeInfo(appMode).newLabel} onClick={startNew} />
        <NavItem icon={<Search />} label="Search" onClick={openSearch} hint={<span className="text-[11px] text-faint">{isMac ? "⌘" : "Ctrl"} K</span>} />
        <NavItem href="#/app/knowledge" icon={<FolderOpen />} label="Projects" active={path.startsWith("/app/knowledge") || path.startsWith("/app/upload")} />
        <NavItem href="#/app/assistants" icon={<Sparkles />} label="Assistants" active={path.startsWith("/app/assistants")} />
        <NavItem
          href="#/app/today"
          icon={<CalendarDays />}
          label="Today"
          active={path === "/app/today"}
          hint={google.status?.connected && google.mail.unread > 0 ? <span className="rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-on-accent">{google.mail.unread > 99 ? "99+" : google.mail.unread}</span> : undefined}
        />
        <NavItem href="#/app/settings/ai" icon={<SlidersHorizontal />} label="Customize" active={path.startsWith("/app/settings")} />
      </nav>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => update((d) => void (d.prefs.integrations.__recentsClosed = recentsOpen))}
          className="flex items-center gap-1 self-start px-5 pb-1.5 text-[12.5px] text-faint hover:text-muted"
          aria-expanded={recentsOpen}
        >
          Recents <ChevronDown className={cx("size-3 transition-transform", !recentsOpen && "-rotate-90")} />
        </button>
        {recentsOpen && (
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {recents.length === 0 && <p className="px-3 py-1 text-[13px] text-faint">Your chats will show up here</p>}
            {recents.map((c) => {
              const href = convoHref(c)
              return (
                <a
                  key={c.id}
                  href={`#${href}`}
                  className={cx("group flex items-center gap-2 rounded-lg px-3 py-[7px] text-[13.5px] transition-colors", path === href ? "bg-panel text-ink" : "text-ink/80 hover:bg-panel/70 hover:text-ink")}
                  title={c.title}
                >
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 text-faint opacity-70 group-hover:opacity-100" title={modeInfo(c.appMode ?? "work").label}>
                    <ModeIcon mode={c.appMode ?? "work"} className="size-3.5" />
                  </span>
                </a>
              )
            })}
            {state.conversations.length > 8 && (
              <a href="#/app/chats" className="block px-3 py-[7px] text-[12.5px] text-faint hover:text-ink">
                All conversations
              </a>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-line-soft px-2 py-2">
        <Menu
          align="left"
          side="up"
          width={250}
          trigger={() => (
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-panel/70">
              <Avatar name={user?.name ?? "?"} size={28} />
              <span className="min-w-0 truncate text-[14px]">
                <span className="font-medium">{user?.name.split(" ")[0]}</span>
                <span className="text-muted"> · {plan.name}</span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-2.5 pt-1 pb-1.5 text-[11.5px] text-faint">{user?.email}</div>
              <div className="mx-1 mb-1 rounded-lg bg-sunken px-2.5 py-2 text-[12.5px]">
                <span className="block font-medium">{ws.name}</span>
                <span className="block text-muted">
                  {plan.name} plan{trialDays > 0 ? ` · trial, ${trialDays} day${trialDays === 1 ? "" : "s"} left` : ""}
                </span>
              </div>
              <MenuItem icon={<Settings2 />} onClick={() => (close(), navigate("/app/settings/account"))}>
                Settings
              </MenuItem>
              <MenuItem icon={<Zap />} onClick={() => (close(), navigate("/app/plans"))}>
                {plan.id === "free" ? "Upgrade plan" : "Plans & billing"}
              </MenuItem>
              <MenuItem icon={<Plus />} onClick={() => (close(), navigate("/app/settings/members"))}>
                Invite people
              </MenuItem>
              <MenuItem icon={dark ? <Sun /> : <Moon />} onClick={() => (close(), update((d) => void (d.prefs.theme = dark ? "light" : "dark")))}>
                {dark ? "Light mode" : "Dark mode"}
              </MenuItem>
              <MenuItem icon={<CircleHelp />} onClick={() => (close(), openHelp())}>
                Help & shortcuts
              </MenuItem>
              <MenuItem icon={<FileText />} onClick={() => (close(), navigate("/about"))}>
                Paper Tech website
              </MenuItem>
              <div className="my-1 h-px bg-line-soft" />
              <MenuItem
                danger
                icon={<LogOut />}
                onClick={() => {
                  close()
                  signOut()
                  navigate("/")
                  toast("Signed out. See you soon.")
                }}
              >
                Sign out
              </MenuItem>
            </>
          )}
        </Menu>
        <button onClick={openHelp} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel hover:text-ink" aria-label="Help & shortcuts" title="Help & shortcuts">
          <CircleHelp className="size-[17px]" />
        </button>
      </div>
    </div>
  )
}

/** Conversation title with a menu (rename, delete), like a document title. */
function ConversationTitle({ id }: { id: string }) {
  const { state, update } = useStore()
  const c = state.conversations.find((x) => x.id === id)
  const [editing, setEditing] = useState(false)
  if (!c) return null
  if (editing)
    return (
      <input
        autoFocus
        defaultValue={c.title}
        aria-label="Conversation name"
        className="w-full max-w-[420px] rounded-lg border border-accent-line bg-surface px-2 py-1 text-[14.5px] outline-none"
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => {
          const t = e.currentTarget.value.trim()
          if (t) update((d) => void (d.conversations.find((x) => x.id === id)!.title = t))
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") setEditing(false)
        }}
      />
    )
  const back = c.appMode && c.appMode !== "work" ? modeInfo(c.appMode).path : "/app"
  return (
    <Menu
      align="left"
      width={220}
      trigger={(open) => (
        <button type="button" className={cx("flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[14.5px] hover:bg-sunken", open && "bg-sunken")}>
          <span className="truncate">{c.title}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem
            icon={<PencilLine />}
            onClick={() => {
              close()
              setEditing(true)
            }}
          >
            Rename
          </MenuItem>
          <MenuItem
            danger
            icon={<Trash2 />}
            onClick={() => {
              close()
              update((d) => void (d.conversations = d.conversations.filter((x) => x.id !== id)))
              navigate(back)
              toast("Conversation deleted")
            }}
          >
            Delete
          </MenuItem>
        </>
      )}
    </Menu>
  )
}

function Breadcrumbs({ path }: { path: string }) {
  const { state } = useStore()
  const parts: Array<{ label: string; href?: string }> = []
  const proj = (id?: string) => state.projects.find((p) => p.id === id)
  let m: RegExpMatchArray | null
  const am = modeOfPath(path)
  if (am !== "work") {
    const id = path.split("/")[3]
    parts.push({ label: modeInfo(am).label, href: id ? `#${modeInfo(am).path}` : undefined })
    if (id) parts.push({ label: state.conversations.find((x) => x.id === id)?.title ?? "Conversation" })
  } else if (path === "/app" || path === "/app/home") parts.push({ label: "Home" })
  else if ((m = path.match(/^\/app\/chat\/(.+)$/))) {
    const c = state.conversations.find((x) => x.id === m![1])
    const p = proj(c?.projectId)
    if (p) parts.push({ label: p.name, href: `#/app/knowledge/${p.id}` })
    parts.push({ label: c?.title ?? "Conversation" })
  } else if (path === "/app/chats") parts.push({ label: "Conversations" })
  else if (path === "/app/knowledge") parts.push({ label: "Projects & knowledge" })
  else if ((m = path.match(/^\/app\/knowledge\/(.+)$/))) parts.push({ label: "Projects", href: "#/app/knowledge" }, { label: proj(m[1])?.name ?? "Project" })
  else if ((m = path.match(/^\/app\/upload(?:\/(.+))?$/))) {
    const p = proj(m[1])
    if (p) parts.push({ label: p.name, href: `#/app/knowledge/${p.id}` })
    parts.push({ label: "Add knowledge" })
  } else if (path.startsWith("/app/assistants")) parts.push({ label: "Assistants" })
  else if ((m = path.match(/^\/app\/editor\/(.+)$/))) {
    const d = state.docs.find((x) => x.id === m![1])
    const p = proj(d?.projectId)
    if (p) parts.push({ label: p.name, href: `#/app/knowledge/${p.id}` })
    parts.push({ label: d?.title ?? "Document" })
  } else if (path.startsWith("/app/settings")) parts.push({ label: "Settings" })
  else if (path === "/app/today") parts.push({ label: "Today" })
  else if (path === "/app/plans") parts.push({ label: "Settings", href: "#/app/settings/billing" }, { label: "Plans" })
  return (
    <nav className="flex min-w-0 items-center gap-2 text-[13px]" aria-label="Breadcrumb">
      {parts.map((p, i) => (
        <span key={i} className="flex min-w-0 items-center gap-2">
          {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-faint" />}
          {p.href ? (
            <a href={p.href} className="truncate text-muted hover:text-ink">
              {p.label}
            </a>
          ) : (
            <span className="truncate text-ink">{p.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

function Notifications() {
  const { state, update } = useStore()
  const unread = state.notifications.filter((n) => !n.read).length
  return (
    <Menu
      width={320}
      trigger={() => (
        <button className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-canvas" />}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-2.5 pt-1 pb-2">
            <span className="text-[13px] font-medium">Around your workspace</span>
            {unread > 0 && (
              <button className="text-[11.5px] text-accent hover:underline" onClick={() => update((d) => d.notifications.forEach((n) => (n.read = true)))}>
                Mark all read
              </button>
            )}
          </div>
          <div className="scroll-thin max-h-[360px] overflow-y-auto">
            {state.notifications.length === 0 && <p className="px-2.5 py-6 text-center text-[12.5px] text-muted">You're all caught up.</p>}
            {state.notifications.map((n) => (
              <button
                key={n.id}
                className="flex w-full gap-3 rounded-md px-2.5 py-2.5 text-left hover:bg-sunken"
                onClick={() => {
                  update((d) => {
                    const x = d.notifications.find((y) => y.id === n.id)
                    if (x) x.read = true
                  })
                  close()
                  if (n.url) window.open(n.url, "_blank", "noopener")
                  else if (n.href) navigate(n.href)
                }}
              >
                <Avatar name={n.who ?? "Paper Tech"} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px]">{n.text}</span>
                  {n.sub && <span className="block truncate text-[12px] text-muted">{n.sub}</span>}
                  <span className="block text-[11px] text-faint">{timeAgo(n.at)}</span>
                </span>
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </Menu>
  )
}

type Hit = { id: string; label: string; sub?: string; icon: React.ReactNode; run: () => void; group: string }

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, update } = useStore()
  const { openProject } = useShell()
  const newConversation = useNewConversation()
  const newDoc = useNewDoc()
  const [q, setQ] = useState("")
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) {
      setQ("")
      setSel(0)
    }
  }, [open])

  const hits = useMemo<Hit[]>(() => {
    const go = (h: string) => () => navigate(h)
    const actions: Hit[] = [
      { id: "a-new", group: "Actions", label: q ? `Ask Paper Tech: “${q}”` : "New conversation", icon: <Plus />, run: () => navigate(`/app/chat/${newConversation({})}${q ? `?q=${encodeURIComponent(q)}` : ""}`) },
      { id: "a-chat", group: "Modes", label: "Chat mode — a quick conversation", icon: <MessageSquare />, run: go("/app/c") },
      { id: "a-code", group: "Modes", label: "Code mode — write and run code", icon: <Command />, run: go("/app/code") },
      { id: "a-agent", group: "Modes", label: "Agent mode — give it a task", icon: <Sparkles />, run: go("/app/agent") },
      { id: "a-upload", group: "Actions", label: "Add knowledge", icon: <Upload />, run: go("/app/upload") },
      { id: "a-proj", group: "Actions", label: "New project", icon: <FolderOpen />, run: openProject },
      { id: "a-doc", group: "Actions", label: "New document", icon: <FileText />, run: () => newDoc(state.projects[0]?.id) },
      { id: "a-today", group: "Actions", label: "Today — calendar, inbox & Drive", icon: <CalendarDays />, run: go("/app/today") },
      { id: "a-asst", group: "Actions", label: "New assistant", icon: <Sparkles />, run: go("/app/assistants/new") },
      { id: "a-theme", group: "Actions", label: "Toggle dark mode", icon: <Moon />, run: () => update((d) => void (d.prefs.theme = document.documentElement.classList.contains("dark") ? "light" : "dark")) },
      { id: "a-settings", group: "Actions", label: "Settings", icon: <Settings2 />, run: go("/app/settings/account") },
    ]
    const all: Hit[] = [
      ...state.conversations.map((c) => ({ id: c.id, group: "Conversations", label: c.title, sub: c.messages.at(-1)?.content.replace(/[#*>|`_\[\]-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90), icon: <MessageSquare />, run: go(convoPath(c.appMode, c.id)) })),
      ...state.projects.map((p) => ({ id: p.id, group: "Projects", label: p.name, sub: p.description, icon: <ProjectIcon icon={p.icon} />, run: go(`/app/knowledge/${p.id}`) })),
      ...state.docs.map((d) => ({ id: d.id, group: "Documents", label: d.title, icon: <FileText />, run: go(`/app/editor/${d.id}`) })),
      ...state.files.filter((f) => f.kind !== "artifact").map((f) => ({ id: f.id, group: "Files", label: f.name, sub: f.meta, icon: <FileIcon kind={f.kind} />, run: go(`/app/knowledge/${f.projectId}?file=${f.id}`) })),
      ...state.assistants.map((a) => ({ id: a.id, group: "Assistants", label: a.name, sub: a.tagline, icon: <AssistantIcon icon={a.icon} />, run: go(`/app/assistants/${a.id}`) })),
    ]
    const needle = q.trim().toLowerCase()
    const filtered = needle ? all.filter((h) => (h.label + " " + (h.sub ?? "")).toLowerCase().includes(needle)).slice(0, 12) : all.slice(0, 6)
    const acts = needle ? actions.filter((a) => a.id === "a-new" || a.label.toLowerCase().includes(needle)) : actions
    return [...acts, ...filtered]
  }, [q, state, newConversation, newDoc, openProject, update])

  useEffect(() => {
    setSel(0)
  }, [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" })
  }, [sel])

  if (!open) return null
  let lastGroup = ""
  return (
    <div className="fade fixed inset-0 z-[90] flex items-start justify-center bg-[rgb(20_22_20/38%)] p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rise w-full max-w-[600px] overflow-hidden rounded-2xl border border-line bg-canvas shadow-pop" role="dialog" aria-label="Search">
        <div className="flex items-center gap-3 border-b border-line-soft px-4">
          <Search className="size-4 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(s + 1, hits.length - 1)))
              if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)))
              if (e.key === "Enter" && hits[sel]) (hits[sel].run(), onClose())
              if (e.key === "Escape") onClose()
            }}
            placeholder="Search conversations, projects, files — or ask Paper Tech"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} className="scroll-thin max-h-[420px] overflow-y-auto p-2">
          {hits.map((h, i) => {
            const header = h.group !== lastGroup ? h.group : null
            lastGroup = h.group
            return (
              <div key={h.group + h.id}>
                {header && <p className="px-2.5 pt-2.5 pb-1 font-mono text-[10.5px] tracking-wide text-faint uppercase">{header}</p>}
                <button
                  data-i={i}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => (h.run(), onClose())}
                  className={cx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left [&_svg]:size-4", i === sel ? "bg-accent-soft text-accent" : "text-ink")}
                >
                  <span className={cx("shrink-0", i === sel ? "text-accent" : "text-muted")}>{h.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px]">{h.label}</span>
                    {h.sub && <span className="block truncate text-[12px] text-muted">{h.sub}</span>}
                  </span>
                  {i === sel && <Kbd>↵</Kbd>}
                </button>
              </div>
            )
          })}
          {hits.length === 0 && <p className="py-8 text-center text-[13px] text-muted">No matches.</p>}
        </div>
      </div>
    </div>
  )
}

function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"
  const rows = [
    [`${mod} K`, "Search anything / quick actions"],
    [`${mod} ⇧ O`, "New conversation"],
    [`${mod} \\`, "Toggle sidebar"],
    ["?", "Show this help"],
    ["Enter", "Send message"],
    ["Shift Enter", "New line"],
    [`${mod} S`, "Save a version (in the editor)"],
    ["Esc", "Close dialogs"],
  ]
  return (
    <Modal open={open} onClose={onClose} title="Help & shortcuts" width={520}>
      <div className="grid gap-6">
        <div>
          <p className="mb-2 text-[13px] font-medium">Keyboard shortcuts</p>
          <div className="divide-y divide-line-soft rounded-xl border border-line">
            {rows.map(([k, l]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                <span className="text-muted">{l}</span>
                <span className="flex gap-1">
                  {k.split(" ").map((x) => (
                    <Kbd key={x}>{x}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium">Getting the most from Paper Tech</p>
          <ul className="space-y-2 text-[13px] text-muted">
            <li>• Switch modes at the top of the sidebar: Work, Chat, Code (with a live preview) and Agent (it uses tools and shows each step).</li>
            <li>• Pick a model under the message box: Wave for deep thinking, Mini for quick answers, Renat for code.</li>
            <li>• Attach images with the image button, or paste / drag them into the message box. Paper Tech reads the text in them, and Paper Tech 1 Vision looks at the whole picture.</li>
            <li>• Pick a project in the composer so answers are grounded in its sources — citations like [1] are clickable.</li>
            <li>• Turn on the globe to let Paper Tech research the web (Pro & Team).</li>
            <li>• Use “Turn into a brief” on any answer to open it in the editor.</li>
            <li>• Build assistants with their own instructions and tools, then test them in the playground.</li>
          </ul>
        </div>
      </div>
    </Modal>
  )
}

export default function AppShell({ path, children }: { path: string; children: React.ReactNode }) {
  const { state, update } = useStore()
  const [mobileNav, setMobileNav] = useState(false)
  const [search, setSearch] = useState(false)
  const [help, setHelp] = useState(false)
  const [projectModal, setProjectModal] = useState(false)
  const collapsed = Boolean(state.prefs.integrations.__sidebarCollapsed)
  const appMode = modeOfPath(path)
  const mode = useAIMode(appMode === "work" ? undefined : state.prefs.modeModels?.[appMode])
  const label = useAILabel()
  const newConversation = useNewConversation()
  const convoId = path.match(/^\/app\/(?:chat|c|code|agent)\/([^/?]+)/)?.[1]
  const fullBleed = path.startsWith("/app/chat/") || path.startsWith("/app/editor/") || /^\/app\/(c|code|agent)\/./.test(path)

  useEffect(() => {
    setMobileNav(false)
  }, [path])
  const { query } = useRoute()
  useEffect(() => {
    const flag = query.get("google")
    if (!flag) return
    if (flag === "connected") toast("Google Workspace connected. Paper Tech will keep an eye on your calendar, inbox and Drive.")
    else if (flag === "denied") toast("Google connection was cancelled.", "info")
    else toast("Couldn't connect Google. Check the server's Google settings and try again.", "error")
    nav2(path, { replace: true })
  }, [query, path])
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const typing = /input|textarea|select/i.test((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable
      if (mod && e.key.toLowerCase() === "k") (e.preventDefault(), setSearch((s) => !s))
      else if (mod && e.shiftKey && e.key.toLowerCase() === "o") (e.preventDefault(), appMode === "work" ? navigate(`/app/chat/${newConversation({})}`) : navigate(modeInfo(appMode).path))
      else if (mod && e.key === "\\") (e.preventDefault(), update((d) => void (d.prefs.integrations.__sidebarCollapsed = !d.prefs.integrations.__sidebarCollapsed)))
      else if (e.key === "?" && !typing) setHelp(true)
      else if (e.key === "Escape") setMobileNav(false)
    }
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
  }, [newConversation, update, appMode])

  const ctx = useMemo(() => ({ openProject: () => setProjectModal(true), openSearch: () => setSearch(true), openHelp: () => setHelp(true) }), [])

  return (
    <ShellCtx.Provider value={ctx}>
      <GoogleProvider>
      <div className="flex h-dvh overflow-hidden bg-canvas">
        <aside className={cx("hidden shrink-0 overflow-hidden border-r border-line-soft transition-[width] duration-200 lg:block", collapsed ? "w-0 border-r-0" : "w-[264px]")}>
          <div className="h-full w-[264px]">
            <Sidebar path={path} onCollapse={() => update((d) => void (d.prefs.integrations.__sidebarCollapsed = true))} />
          </div>
        </aside>

        {mobileNav && (
          <div className="fade fixed inset-0 z-[70] bg-[rgb(20_22_20/40%)] lg:hidden" onClick={() => setMobileNav(false)}>
            <div className="rise h-full w-[280px] border-r border-line-soft shadow-pop" onClick={(e) => e.stopPropagation()}>
              <button className="absolute top-3 left-[290px] grid size-9 place-items-center rounded-full bg-surface text-ink" onClick={() => setMobileNav(false)} aria-label="Close menu">
                <X className="size-4" />
              </button>
              <Sidebar path={path} onNavigate={() => setMobileNav(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print flex h-[56px] shrink-0 items-center gap-2 border-b border-line-soft px-3 md:px-5">
            <button className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">
              <MenuIcon className="size-[18px]" />
            </button>
            {collapsed && (
              <button
                className="hidden size-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink lg:grid"
                onClick={() => update((d) => void (d.prefs.integrations.__sidebarCollapsed = false))}
                aria-label="Show sidebar"
                title="Show sidebar"
              >
                <PanelLeft className="size-[18px]" />
              </button>
            )}
            <div className="min-w-0 flex-1">{convoId ? <ConversationTitle id={convoId} /> : <Breadcrumbs path={path} />}</div>
            <div id="topbar-actions" className="flex items-center gap-2" />
            <button className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink md:hidden" onClick={() => setSearch(true)} aria-label="Search">
              <Command className="size-[18px]" />
            </button>
            {mode && (
              <a href="#/app/settings/ai" className="hidden sm:block" title={mode === "demo" ? "Demo AI — connect a real AI in Settings" : mode === "device" ? `${label} runs privately on this device` : `Connected to ${label}`}>
                {mode === "demo" ? (
                  <Badge tone="warn">
                    <span className="size-1.5 rounded-full bg-warn" /> Demo AI
                  </Badge>
                ) : mode === "device" ? (
                  <Badge tone="success">
                    <Cpu className="size-3" /> {label} · on device
                  </Badge>
                ) : (
                  <Badge tone="success">
                    <span className="size-1.5 rounded-full bg-success" /> {label} connected
                  </Badge>
                )}
              </a>
            )}
            <Notifications />
          </header>
          <main className={cx("scroll-thin min-h-0 flex-1", fullBleed ? "overflow-hidden" : "overflow-y-auto")}>{children}</main>
        </div>
      </div>
      <LocalStatusCard />
      <CommandPalette open={search} onClose={() => setSearch(false)} />
      <HelpModal open={help} onClose={() => setHelp(false)} />
      <ProjectModal open={projectModal} onClose={() => setProjectModal(false)} />
      </GoogleProvider>
    </ShellCtx.Provider>
  )
}
