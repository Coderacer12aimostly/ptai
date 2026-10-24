import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUpRight, Check, FolderInput, Link2, MessageSquare, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, Trash2, Upload, Eye, FilePen } from "lucide-react"
import { Avatar, Badge, Button, EmptyState, Field, Input, Menu, MenuItem, Modal, Textarea } from "../../components/ui"
import { FileIcon, ProjectIcon, TINTS } from "../../components/icons"
import FilePreview from "../../components/FilePreview"
import ProjectModal from "../../components/ProjectModal"
import { useStore } from "../../lib/store"
import { navigate, useRoute } from "../../lib/router"
import { useNewConversation } from "../../lib/chat"
import { useNewDoc } from "../../lib/docs"
import { deleteText, saveText } from "../../lib/knowledge"
import type { KnowledgeFile, Project } from "../../lib/types"
import { bytes, cx, shortDate, timeAgo, uid } from "../../lib/utils"
import { toast } from "../../components/toast"
import NotFound from "../NotFound"
import DriveImport from "../../components/DriveImport"
import { GoogleG } from "../../components/icons"

type Tab = "all" | "files" | "artifacts" | "links"
type Sort = "name" | "updated"

function StatusBadge({ f }: { f: KnowledgeFile }) {
  if (f.status === "ready") return <span className="text-[12px] text-success">Ready</span>
  if (f.status === "draft") return <span className="text-[12px] text-muted">Draft</span>
  if (f.status === "error") return <span className="text-[12px] text-danger">Error</span>
  return <span className="text-[12px] text-accent">{Math.round((f.progress ?? 0) * 100)}%</span>
}

export function AddLinkModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const { update, user } = useStore()
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  useEffect(() => {
    if (open) (setUrl(""), setTitle(""), setNotes(""))
  }, [open])
  let host = ""
  try {
    host = new URL(url).hostname.replace(/^www\./, "")
  } catch {
    /* invalid */
  }
  async function save() {
    if (!host) return toast("Paste a full link, starting with https://", "error")
    const id = uid("f-")
    const name = title.trim() || host
    await saveText(id, `${name}\n${url}\n\n${notes}`)
    update((d) => void d.files.unshift({ id, projectId, name, kind: "link", size: 0, owner: user?.name ?? "You", updatedAt: Date.now(), status: "ready", meta: `Web link · ${host}`, url, chars: notes.length, summary: notes.slice(0, 160) || undefined }))
    toast("Link added")
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a link"
      description="Save a web page as a source. Paste an excerpt so Paper Tech can cite it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!url}>
            Add link
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="URL" htmlFor="lurl">
          <Input id="lurl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" leading={<Link2 className="size-4 text-faint" />} valid={!!host} />
        </Field>
        <Field label="Title" htmlFor="ltitle">
          <Input id="ltitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={host || "2026 Work Trends Index"} />
        </Field>
        <Field label="Excerpt or notes" htmlFor="lnotes" hint="Optional, but it's what Paper Tech reads when answering.">
          <Textarea id="lnotes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste the key passages from the page…" />
        </Field>
      </div>
    </Modal>
  )
}

export default function Knowledge({ projectId }: { projectId?: string }) {
  const { state, update } = useStore()
  const { query } = useRoute()
  const newConversation = useNewConversation()
  const newDoc = useNewDoc()
  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<Sort>("updated")
  const [selected, setSelected] = useState<string | null>(query.get("file"))
  const [preview, setPreview] = useState<KnowledgeFile | null>(null)
  const [editProject, setEditProject] = useState<Project | undefined>()
  const [projectModal, setProjectModal] = useState(false)
  const [linkModal, setLinkModal] = useState(false)
  const [deleteProject, setDeleteProject] = useState<Project | null>(null)
  const [driveOpen, setDriveOpen] = useState(false)
  const project = state.projects.find((p) => p.id === projectId)

  useEffect(() => {
    setSelected(query.get("file"))
  }, [query, projectId])

  const files = useMemo(() => {
    let list = state.files.filter((f) => !projectId || f.projectId === projectId)
    if (tab === "files") list = list.filter((f) => !["artifact", "link"].includes(f.kind))
    if (tab === "artifacts") list = list.filter((f) => f.kind === "artifact")
    if (tab === "links") list = list.filter((f) => f.kind === "link")
    if (q.trim()) list = list.filter((f) => (f.name + " " + (f.summary ?? "") + " " + f.owner).toLowerCase().includes(q.toLowerCase()))
    return [...list].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt))
  }, [state.files, projectId, tab, q, sort])

  const sel = state.files.find((f) => f.id === selected) ?? files[0]
  const scoped = state.files.filter((f) => !projectId || f.projectId === projectId)
  const counts = {
    all: scoped.length,
    files: scoped.filter((f) => !["artifact", "link"].includes(f.kind)).length,
    artifacts: scoped.filter((f) => f.kind === "artifact").length,
    links: scoped.filter((f) => f.kind === "link").length,
  }

  if (projectId && !project) return <NotFound inApp />

  function startChat(f?: KnowledgeFile) {
    const pid = f?.projectId ?? projectId ?? state.projects[0]?.id
    const id = newConversation({ projectId: pid })
    navigate(`/app/chat/${id}${f ? `?q=${encodeURIComponent(`Summarise the key points from “${f.name}”.`)}` : ""}`)
  }

  function open(f: KnowledgeFile) {
    if (f.kind === "artifact" && f.docId) return navigate(`/app/editor/${f.docId}`)
    setPreview(f)
  }

  function remove(f: KnowledgeFile) {
    update((d) => {
      d.files = d.files.filter((x) => x.id !== f.id)
      if (f.docId) d.docs = d.docs.filter((x) => x.id !== f.docId)
    })
    deleteText(f.id)
    setSelected(null)
    toast(`Removed ${f.name}`)
  }

  const projects = projectId ? [] : state.projects

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-8 md:px-10 md:py-12">
      {/* Header */}
      {project ? (
        <div className={cx("rounded-2xl p-6 md:p-8", TINTS[project.tint])}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-accent">
                <ProjectIcon icon={project.icon} className="size-7" />
              </div>
              <h1 className="display mt-4 text-[32px] font-semibold md:text-[38px]">{project.name}</h1>
              <p className="mt-2 max-w-xl text-[15px] text-muted">{project.description || "No description yet."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => (setEditProject(project), setProjectModal(true))}>
                Edit
              </Button>
              <Button variant="secondary" icon={<FilePen className="size-4" />} onClick={() => newDoc(project.id)}>
                New draft
              </Button>
              <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => navigate(`/app/upload/${project.id}`)}>
                Add knowledge
              </Button>
              <Button icon={<MessageSquare className="size-4" />} onClick={() => startChat()}>
                Start a conversation
              </Button>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-5 text-[13px]">
            <span>
              <b className="text-[18px] font-semibold">{counts.files + counts.links}</b> <span className="text-muted">sources</span>
            </span>
            <span>
              <b className="text-[18px] font-semibold">{state.conversations.filter((c) => c.projectId === project.id).length}</b> <span className="text-muted">conversations</span>
            </span>
            <span>
              <b className="text-[18px] font-semibold">{state.docs.filter((d) => d.projectId === project.id).length}</b> <span className="text-muted">drafts</span>
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="display text-[32px] font-semibold md:text-[38px]">A home for what your team knows.</h1>
              <p className="mt-2 text-[15px] text-muted">Keep your sources, conversations, and ideas connected.</p>
            </div>
            <Button size="lg" icon={<Plus className="size-4" />} onClick={() => (setEditProject(undefined), setProjectModal(true))}>
              New project
            </Button>
          </div>
          <div className="mt-10 mb-4 flex items-center justify-between">
            <h2 className="text-[14px]">
              Your projects <span className="text-muted">{projects.length}</span>
            </h2>
          </div>
          {projects.length === 0 ? (
            <EmptyState icon={<Plus />} title="No projects yet" action={<Button onClick={() => setProjectModal(true)}>Create a project</Button>}>
              Projects keep sources, conversations and drafts together.
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => {
                const n = state.files.filter((f) => f.projectId === p.id && f.kind !== "artifact").length
                const c = state.conversations.filter((x) => x.projectId === p.id).length
                return (
                  <div key={p.id} className={cx("group relative rounded-2xl border border-line p-5 transition-shadow hover:shadow-card", TINTS[p.tint])}>
                    <a href={`#/app/knowledge/${p.id}`} className="absolute inset-0 rounded-2xl" aria-label={p.name} />
                    <div className="flex items-start justify-between">
                      <span className="text-accent">
                        <ProjectIcon icon={p.icon} className="size-6" />
                      </span>
                      <div className="relative z-10">
                        <Menu
                          width={190}
                          trigger={() => (
                            <button className="rounded-md p-1 text-muted hover:bg-surface hover:text-ink" aria-label={`${p.name} options`}>
                              <MoreHorizontal className="size-4" />
                            </button>
                          )}
                        >
                          {(close) => (
                            <>
                              <MenuItem icon={<Pencil />} onClick={() => (close(), setEditProject(p), setProjectModal(true))}>
                                Edit
                              </MenuItem>
                              <MenuItem icon={p.pinned ? <PinOff /> : <Pin />} onClick={() => (close(), update((d) => void (d.projects.find((x) => x.id === p.id)!.pinned = !p.pinned)))}>
                                {p.pinned ? "Unpin" : "Pin to sidebar"}
                              </MenuItem>
                              <MenuItem danger icon={<Trash2 />} onClick={() => (close(), setDeleteProject(p))}>
                                Delete
                              </MenuItem>
                            </>
                          )}
                        </Menu>
                      </div>
                    </div>
                    <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.015em]">{p.name}</h3>
                    <p className="mt-1.5 line-clamp-2 min-h-[40px] text-[13px] text-muted">{p.description}</p>
                    <div className="mt-4 flex items-center justify-between text-[11.5px] text-muted">
                      <span>
                        {n} sources · {c} conversations
                      </span>
                      <ArrowUpRight className="size-4 group-hover:text-accent" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Knowledge table */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-5 text-[14px]">
          {(
            [
              ["all", "All knowledge"],
              ["files", "Files"],
              ["artifacts", "Artifacts"],
              ["links", "Links"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cx(tab === k ? "font-medium text-accent" : "text-muted hover:text-ink")}>
              {l} {tab === k && counts[k]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input className="h-10 w-[220px]" leading={<Search className="size-4 text-faint" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search knowledge…" />
          {projectId && (
            <Button variant="secondary" icon={<Link2 className="size-4" />} onClick={() => setLinkModal(true)}>
              Add link
            </Button>
          )}
          <Button variant="secondary" icon={<GoogleG />} onClick={() => setDriveOpen(true)}>
            Google Drive
          </Button>
          <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => navigate(projectId ? `/app/upload/${projectId}` : "/app/upload")}>
            Upload files
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {files.length === 0 ? (
            <EmptyState icon={<Upload />} title={q ? "Nothing matches that search" : "No knowledge here yet"} action={!q && <Button onClick={() => navigate(projectId ? `/app/upload/${projectId}` : "/app/upload")}>Upload files</Button>}>
              {q ? "Try a different word." : "Drop in PDFs, docs, spreadsheets or links. Paper Tech will make them ready for questions."}
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-line font-mono text-[10.5px] tracking-wide text-faint uppercase">
                    <th className="px-3 py-3 font-normal">
                      <button onClick={() => setSort("name")} className={cx("inline-flex items-center gap-1 uppercase", sort === "name" && "text-ink")}>
                        Name {sort === "name" && <ArrowDown className="size-3" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 font-normal">Owner</th>
                    <th className="px-3 py-3 font-normal">
                      <button onClick={() => setSort("updated")} className={cx("inline-flex items-center gap-1 uppercase", sort === "updated" && "text-ink")}>
                        Updated {sort === "updated" && <ArrowDown className="size-3" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => setSelected(f.id)}
                      onDoubleClick={() => open(f)}
                      className={cx("cursor-pointer border-b border-line-soft transition-colors", sel?.id === f.id ? "bg-accent-soft" : "hover:bg-sunken/70")}
                    >
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-3">
                          <FileIcon kind={f.kind} className={sel?.id === f.id ? "text-accent" : "text-muted"} />
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px]">{f.name}</p>
                            <p className="text-[11.5px] text-muted">
                              {f.meta}
                              {!projectId && ` · ${state.projects.find((p) => p.id === f.projectId)?.name ?? ""}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-[12.5px] text-muted">{f.owner}</td>
                      <td className="px-3 py-3.5 text-[12.5px] text-muted">{shortDate(f.updatedAt)}</td>
                      <td className="px-3 py-3.5">
                        <StatusBadge f={f} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-5 text-[12px] text-faint">
            {files.length} item{files.length === 1 ? "" : "s"}
            {project ? ` in ${project.name}` : ""} · Knowledge is shared with your workspace.
          </p>
        </div>

        {sel && (
          <aside className="h-fit rounded-xl border border-line bg-surface p-5 lg:sticky lg:top-4">
            <div className="flex items-start justify-between">
              <span className="grid size-11 place-items-center rounded-lg bg-accent-soft text-accent">
                <FileIcon kind={sel.kind} className="size-5" />
              </span>
              <Menu
                width={210}
                trigger={() => (
                  <button className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink" aria-label="File options">
                    <MoreHorizontal className="size-4" />
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <div className="px-2.5 pt-1 pb-1 text-[11px] text-faint">Move to</div>
                    {state.projects
                      .filter((p) => p.id !== sel.projectId)
                      .map((p) => (
                        <MenuItem key={p.id} icon={<FolderInput />} onClick={() => (close(), update((d) => void (d.files.find((x) => x.id === sel.id)!.projectId = p.id)), toast(`Moved to ${p.name}`))}>
                          {p.name}
                        </MenuItem>
                      ))}
                    <div className="my-1 h-px bg-line-soft" />
                    <MenuItem danger icon={<Trash2 />} onClick={() => (close(), remove(sel))}>
                      Remove
                    </MenuItem>
                  </>
                )}
              </Menu>
            </div>
            <h3 className="mt-5 text-[16px] font-medium break-words">{sel.name}</h3>
            <p className="mt-1 text-[12px] text-muted">
              {sel.meta} {sel.size ? `· ${bytes(sel.size)}` : ""}
            </p>
            <div className="mt-3">
              {sel.status === "ready" ? (
                <Badge tone="success">
                  <Check className="size-3" /> Ready for conversations
                </Badge>
              ) : sel.status === "draft" ? (
                <Badge>Draft</Badge>
              ) : sel.status === "error" ? (
                <Badge tone="danger">Couldn't read</Badge>
              ) : (
                <Badge tone="accent">Processing…</Badge>
              )}
            </div>
            {sel.summary && <p className="mt-5 border-t border-line-soft pt-5 text-[12.5px] leading-relaxed text-muted">{sel.summary}</p>}
            <div className="mt-4 flex items-center gap-2">
              <Avatar name={sel.owner} size={26} />
              <span className="text-[12px] text-muted">
                Added by {sel.owner.split(" ")[0]} · {timeAgo(sel.updatedAt)}
              </span>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              {sel.kind === "artifact" ? (
                <Button variant="secondary" icon={<FilePen className="size-4" />} onClick={() => open(sel)}>
                  Open in editor
                </Button>
              ) : (
                <Button variant="secondary" icon={<MessageSquare className="size-4" />} onClick={() => startChat(sel)} disabled={sel.status !== "ready"}>
                  Start a conversation
                </Button>
              )}
              {sel.kind !== "artifact" && (
                <Button variant="ghost" size="sm" icon={<Eye className="size-4" />} onClick={() => open(sel)}>
                  View source
                </Button>
              )}
            </div>
          </aside>
        )}
      </div>

      <FilePreview file={preview} onClose={() => setPreview(null)} onAsk={(f) => (setPreview(null), startChat(f))} />
      <DriveImport open={driveOpen} onClose={() => setDriveOpen(false)} projectId={projectId} />
      <ProjectModal open={projectModal} onClose={() => setProjectModal(false)} project={editProject} />
      {projectId && <AddLinkModal open={linkModal} onClose={() => setLinkModal(false)} projectId={projectId} />}
      <Modal
        open={!!deleteProject}
        onClose={() => setDeleteProject(null)}
        title={`Delete ${deleteProject?.name}?`}
        description="Its sources and drafts will be removed. Conversations stay, without a project."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteProject(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const p = deleteProject!
                const fileIds = state.files.filter((f) => f.projectId === p.id).map((f) => f.id)
                update((d) => {
                  d.projects = d.projects.filter((x) => x.id !== p.id)
                  d.files = d.files.filter((f) => f.projectId !== p.id)
                  d.docs = d.docs.filter((x) => x.projectId !== p.id)
                  d.conversations.forEach((c) => c.projectId === p.id && (c.projectId = undefined))
                })
                fileIds.forEach(deleteText)
                setDeleteProject(null)
                toast(`Deleted ${p.name}`)
              }}
            >
              Delete project
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-muted">This can't be undone.</p>
      </Modal>
    </div>
  )
}
