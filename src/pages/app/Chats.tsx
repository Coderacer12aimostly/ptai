import { useMemo, useState } from "react"
import { MessageSquare, Plus, Search, Trash2 } from "lucide-react"
import { Button, EmptyState, Input } from "../../components/ui"
import { useStore } from "../../lib/store"
import { convoPath } from "../../lib/modes"
import { navigate } from "../../lib/router"
import { useNewConversation } from "../../lib/chat"
import { cx, timeAgo } from "../../lib/utils"
import { toast } from "../../components/toast"

export default function Chats() {
  const { state, update } = useStore()
  const newConversation = useNewConversation()
  const [q, setQ] = useState("")
  const [project, setProject] = useState<string>("all")
  const list = useMemo(
    () =>
      [...state.conversations]
        .filter((c) => project === "all" || c.projectId === project)
        .filter((c) => !q.trim() || (c.title + " " + c.messages.map((m) => m.content).join(" ")).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [state.conversations, q, project],
  )
  return (
    <div className="mx-auto max-w-[900px] px-5 py-8 md:px-10 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[32px] font-semibold">Conversations</h1>
          <p className="mt-1 text-muted">Every question you've explored with Paper Tech.</p>
        </div>
        <Button icon={<Plus className="size-4" />} onClick={() => navigate(`/app/chat/${newConversation({})}`)}>
          New conversation
        </Button>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Input className="h-10 min-w-[220px] flex-1" leading={<Search className="size-4 text-faint" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" />
        <select value={project} onChange={(e) => setProject(e.target.value)} className="h-10 rounded-lg border border-line bg-surface px-3 text-[13.5px]">
          <option value="all">All projects</option>
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-6">
        {list.length === 0 ? (
          <EmptyState icon={<MessageSquare />} title={q ? "No matches" : "No conversations yet"} action={!q && <Button onClick={() => navigate(`/app/chat/${newConversation({})}`)}>Start one</Button>}>
            {q ? "Try a different search." : "Ask Paper Tech anything — your conversations will be saved here."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line-soft rounded-xl border border-line bg-surface">
            {list.map((c) => {
              const p = state.projects.find((x) => x.id === c.projectId)
              const last = c.messages.at(-1)
              return (
                <li key={c.id} className="group flex items-center gap-4 px-4 py-3.5 hover:bg-sunken/60">
                  <a href={`#${convoPath(c.appMode, c.id)}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <MessageSquare className="size-[18px] shrink-0 text-muted" strokeWidth={1.7} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{c.title}</span>
                      <span className="block truncate text-[12.5px] text-muted">{last ? last.content.replace(/[#*>\[\]]/g, "").slice(0, 120) : "Empty conversation"}</span>
                    </span>
                    <span className={cx("hidden shrink-0 text-[12px] text-muted sm:block")}>{p?.name ?? "—"}</span>
                    <span className="w-[80px] shrink-0 text-right text-[11.5px] text-faint">{timeAgo(c.updatedAt)}</span>
                  </a>
                  <button
                    className="rounded-md p-1.5 text-faint opacity-0 group-hover:opacity-100 hover:bg-danger-soft hover:text-danger focus:opacity-100"
                    aria-label={`Delete ${c.title}`}
                    onClick={() => {
                      const snapshot = c
                      update((d) => void (d.conversations = d.conversations.filter((x) => x.id !== c.id)))
                      toast(`Deleted “${snapshot.title}”`)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
