import { useEffect, useRef, useState } from "react"
import { ArrowUp, CalendarDays, ChevronDown, Cpu, Folder, FolderPlus, Globe, Lock, Mic, Paperclip, Plus, Square } from "lucide-react"
import { useGoogle } from "./GoogleProvider"
import { resolveMode, serverAI } from "../lib/ai"
import { CHAT_MODELS, checkWebGPU, localModel, useLocalStatus } from "../lib/local"
import { Menu, MenuItem } from "./ui"
import { MODELS, modelName } from "../lib/models"
import { useStore } from "../lib/store"
import { cx } from "../lib/utils"
import { toast } from "./toast"
import { openUpgrade } from "./upgrade"
import { ACCEPT } from "../lib/knowledge"
import { useUploader } from "../lib/upload"
import { DropOverlay, ImageStrip, useImageAttach } from "./ImageAttach"
import { MicButton, PlusMenu, SendButton, ToolChip, composerBox, useDictation, type PlusItem } from "./ComposerBits"
import type { ImageRef } from "../lib/types"

interface Props {
  placeholder?: string
  onSend: (text: string, images: ImageRef[]) => void
  busy?: boolean
  onStop?: () => void
  model: string
  onModel: (m: string) => void
  web: boolean
  onWeb: (v: boolean) => void
  projectId?: string
  onProject?: (id: string | undefined) => void
  size?: "lg" | "md" | "sm"
  autoFocus?: boolean
  initial?: string
  className?: string
  /** Include today's Google Calendar + Gmail as context */
  google?: boolean
  onGoogle?: (v: boolean) => void
}

export default function Composer({ placeholder = "Ask anything…", onSend, busy, onStop, model, onModel, web, onWeb, projectId, onProject, size = "md", autoFocus, initial = "", className, google, onGoogle }: Props) {
  const g = useGoogle()
  const gReady = Boolean(g.status?.connected && (g.has("calendar") || g.has("gmail")))
  const { state, update } = useStore()
  // When the server runs a non-Claude model (e.g. free Llama on Groq), show that instead of the Claude picker.
  const [serverModel, setServerModel] = useState<string | null>(null)
  const [onDevice, setOnDevice] = useState(false)
  const [gpuOk, setGpuOk] = useState(true)
  useEffect(() => void checkWebGPU().then((g) => setGpuOk(g.ok)), [])
  const local = useLocalStatus()
  useEffect(() => {
    let live = true
    resolveMode(state.prefs.apiKey).then(async (m) => {
      if (!live) return
      setOnDevice(m === "device")
      if (m === "server") {
        const s = await serverAI()
        if (live) setServerModel(s.provider === "openai" ? s.label || "AI" : null)
      } else setServerModel(null)
    })
    return () => void (live = false)
  }, [state.prefs.apiKey, state.prefs.localAI, state.prefs.localModel, local.phase])
  const [text, setText] = useState(initial)
  const ta = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const upload = useUploader()
  const plan = state.workspace?.plan ?? "free"
  const project = state.projects.find((p) => p.id === projectId)
  const sourceCount = state.files.filter((f) => f.projectId === projectId && f.status === "ready").length

  useEffect(() => {
    setText(initial)
  }, [initial])
  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 260) + "px"
  }, [text])
  useEffect(() => {
    if (autoFocus) ta.current?.focus()
  }, [autoFocus])

  const att = useImageAttach()
  const mic = useDictation(text, setText)
  const listening = mic.listening
  function submit() {
    if (busy || att.busy || (!text.trim() && !att.images.length)) return
    onSend(text, att.images)
    setText("")
    att.clear()
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    let target = projectId
    if (!target) {
      target = state.projects[0]?.id
      if (!target) return toast("Create a project first so Paper Tech knows where to keep files.", "info")
      onProject?.(target)
    }
    toast(`Adding ${files.length} file${files.length > 1 ? "s" : ""} to ${state.projects.find((p) => p.id === target)?.name}`, "info")
    await upload(files, target)
  }

  const pad = size === "lg" ? "px-4 pt-4 pb-2.5" : size === "sm" ? "px-3 pt-2.5 pb-2" : "px-4 pt-3.5 pb-2.5"

  return (
    <div
      className={cx(composerBox, pad, className)}
      onDragOver={(e) => {
        e.preventDefault()
        att.dropProps.onDragOver(e)
      }}
      onDragLeave={att.dropProps.onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        // Dropped images and documents are attached to the message (add to a project from the + menu).
        att.dropProps.onDrop(e)
      }}
    >
      <DropOverlay show={att.dragging} />
      {att.input}
      {onProject && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Menu
            align="left"
            width={240}
            trigger={() => (
              <button className={cx("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px]", project ? "bg-accent-soft text-accent" : "bg-sunken text-muted hover:text-ink")}>
                <Folder className="size-3.5" />
                {project?.name ?? "No project"}
                <ChevronDown className="size-3" />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2.5 pt-1 pb-1.5 text-[11px] text-faint">Ground answers in a project</div>
                <MenuItem active={!projectId} onClick={() => (onProject(undefined), close())}>
                  No project
                </MenuItem>
                {state.projects.map((p) => (
                  <MenuItem key={p.id} icon={<Folder />} active={p.id === projectId} onClick={() => (onProject(p.id), close())}>
                    {p.name}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
          {google && gReady && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-[12px] text-accent">
              <CalendarDays className="size-3.5" /> Calendar & inbox
            </span>
          )}
          {project && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-sunken px-2 py-1 text-[12px] text-muted">
              <Paperclip className="size-3.5" />
              {sourceCount} source{sourceCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
      <ImageStrip images={att.images} busy={att.busy} onRemove={att.remove} />
      <textarea
        ref={ta}
        onPaste={att.onPaste}
        rows={size === "lg" ? 2 : 1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && (state.prefs.enterToSend || e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={listening ? "Listening…" : placeholder}
        aria-label="Message"
        className={cx("w-full resize-none bg-transparent leading-relaxed text-ink outline-none placeholder:text-faint", size === "lg" ? "min-h-[56px] py-1 text-[17px]" : "py-1 text-[14.5px]")}
      />
      <div className="mt-2 flex items-center gap-1">
        <input ref={fileRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ""))} />
        <PlusMenu
          items={[
            { icon: <Paperclip />, label: "Add files or photos", hint: "Attach to this message", onClick: att.open },
            { icon: <FolderPlus />, label: "Add files to a project", hint: "Keep them as sources for later", onClick: () => fileRef.current?.click() },
            "divider",
            { icon: <Globe />, label: "Web search", hint: "Look things up before answering", onClick: () => (onWeb(!web), toast(web ? "Web search off" : "Web search on — answers will include web sources", "info")), checked: web },
            ...(onGoogle && gReady
              ? [{ icon: <CalendarDays />, label: "Calendar & inbox", hint: "Use today's events and unread email", onClick: () => onGoogle(!google), checked: Boolean(google) } as PlusItem]
              : []),
          ]}
        />
        <MicButton listening={listening} onClick={mic.toggle} />
        {web && <ToolChip icon={<Globe />} label="Web search" onRemove={() => onWeb(false)} />}
        {google && gReady && onGoogle && <ToolChip icon={<CalendarDays />} label="Calendar" onRemove={() => onGoogle(false)} />}
        <div className="flex-1" />
        {onDevice ? (
          <Menu
            align="right"
            side="up"
            width={270}
            trigger={() => (
              <button className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] whitespace-nowrap text-ink hover:bg-sunken" title="Runs privately on this device">
                {localModel(state.prefs.localModel).name}
                <ChevronDown className="size-3.5" />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2.5 pt-1 pb-1.5 text-[11px] text-faint">Runs privately on this device</div>
                {CHAT_MODELS.map((m) => {
                  const blocked = !gpuOk && !m.builtin
                  return (
                    <MenuItem
                      key={m.key}
                      active={m.key === localModel(state.prefs.localModel).key}
                      onClick={() => {
                        close()
                        if (blocked) return toast(`${m.name} needs WebGPU, which this browser doesn't have`, "info")
                        update((d) => void (d.prefs.localModel = m.key))
                      }}
                    >
                      <span className={cx("block", blocked && "opacity-50")}>
                        {m.name} <span className="text-faint">· {blocked ? "needs WebGPU" : m.size}</span>
                      </span>
                      <span className={cx("block text-[11px] text-faint", blocked && "opacity-50")}>{m.blurb}</span>
                    </MenuItem>
                  )
                })}
              </>
            )}
          </Menu>
        ) : serverModel ? (
          <span className="px-2 py-1.5 text-[12.5px] whitespace-nowrap text-muted" title="Set by the server">{serverModel}</span>
        ) : (
        <Menu
          align="right"
          side="up"
          width={250}
          trigger={() => (
            <button className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] whitespace-nowrap text-ink hover:bg-sunken">
              {modelName(model)}
              <ChevronDown className="size-3.5" />
            </button>
          )}
        >
          {(close) => [
            <MenuItem
              key="mini"
              icon={<Cpu />}
              onClick={() => {
                close()
                update((d) => void ((d.prefs.localModel = "nano"), (d.prefs.localAI = true)))
              }}
            >
              <span className="block">Paper Tech Nano</span>
              <span className="block text-[11px] text-faint">Our own tiny model · on device, works everywhere</span>
            </MenuItem>,
            ...MODELS.map((m) => {
              const locked = m.minPlan === "pro" && plan === "free"
              return (
                <MenuItem
                  key={m.id}
                  active={m.id === model}
                  icon={locked ? <Lock /> : undefined}
                  onClick={() => {
                    close()
                    if (locked) return openUpgrade(`${m.name} is available on Pro and Team.`)
                    onModel(m.id)
                  }}
                >
                  <span className="block">{m.name}</span>
                  <span className="block text-[11px] text-faint">{m.blurb}</span>
                </MenuItem>
              )
            }),
          ]}
        </Menu>
        )}
        <SendButton busy={busy} onStop={onStop} onSend={submit} disabled={(!text.trim() && !att.images.length) || att.busy} />
      </div>
    </div>
  )
}
