import { useEffect, useState } from "react"
import { Button, Field, Input, Modal, Textarea } from "./ui"
import { PROJECT_ICONS, ProjectIcon, TINTS } from "./icons"
import type { Project } from "../lib/types"
import { useStore } from "../lib/store"
import { cx, uid } from "../lib/utils"
import { planById } from "../lib/plans"
import { openUpgrade } from "./upgrade"
import { toast } from "./toast"
import { navigate } from "../lib/router"

export default function ProjectModal({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project }) {
  const { state, update } = useStore()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState<Project["icon"]>("folder")
  const [tint, setTint] = useState<Project["tint"]>("sage")

  useEffect(() => {
    if (!open) return
    setName(project?.name ?? "")
    setDescription(project?.description ?? "")
    setIcon(project?.icon ?? "folder")
    setTint(project?.tint ?? (["sage", "sand", "mist", "blue"] as const)[state.projects.length % 4])
  }, [open, project, state.projects.length])

  function save() {
    if (!name.trim()) return
    if (project) {
      update((d) => {
        const p = d.projects.find((x) => x.id === project.id)
        if (p) Object.assign(p, { name: name.trim(), description: description.trim(), icon, tint })
      })
      toast("Project updated")
      onClose()
      return
    }
    const limit = planById(state.workspace?.plan ?? "free").projects
    if (state.projects.length >= limit) {
      onClose()
      return openUpgrade(`The Free plan includes ${limit} projects. Upgrade for unlimited projects.`)
    }
    const id = uid("p-")
    update((d) => void d.projects.push({ id, name: name.trim(), description: description.trim(), icon, tint, pinned: true, createdAt: Date.now() }))
    toast(`Created ${name.trim()}`)
    onClose()
    navigate(`/app/knowledge/${id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      description={project ? undefined : "A project keeps sources, conversations and drafts together."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim()}>
            {project ? "Save" : "Create project"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Name" htmlFor="pname">
          <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Q1 launch" />
        </Field>
        <Field label="Description" htmlFor="pdesc" hint="Optional — helps Paper Tech and your team understand the goal.">
          <Textarea id="pdesc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Research and storytelling for…" />
        </Field>
        <div>
          <p className="mb-2 text-[13px] font-medium">Icon & colour</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PROJECT_ICONS) as Project["icon"][]).map((k) => (
              <button type="button" key={k} onClick={() => setIcon(k)} className={cx("grid size-10 place-items-center rounded-lg border", icon === k ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink")} aria-label={k}>
                <ProjectIcon icon={k} />
              </button>
            ))}
            <span className="mx-1 w-px bg-line" />
            {(Object.keys(TINTS) as Project["tint"][]).map((t) => (
              <button type="button" key={t} onClick={() => setTint(t)} className={cx("size-10 rounded-lg border", TINTS[t], tint === t ? "border-accent ring-2 ring-accent/30" : "border-line")} aria-label={`${t} colour`} />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}
