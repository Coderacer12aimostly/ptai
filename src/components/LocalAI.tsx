import { useEffect, useState } from "react"
import { AlertTriangle, Check, Cpu, Download, HardDrive, ShieldCheck, Trash2, X } from "lucide-react"
import { Badge, Button, Spinner, Toggle } from "./ui"
import { toast } from "./toast"
import { useStore } from "../lib/store"
import { cx } from "../lib/utils"
import {
  LOCAL_MODELS,
  VISION_MODEL,
  checkWebGPU,
  deleteLocal,
  getLocalStatus,
  isDownloaded,
  loadLocal,
  localModel,
  retryLocal,
  subscribeLocal,
  useLocalStatus,
  type GPUSupport,
} from "../lib/local"

export function useGPU() {
  const [gpu, setGpu] = useState<GPUSupport | null>(null)
  useEffect(() => void checkWebGPU().then(setGpu), [])
  return gpu
}

/** Which models are already on this device. Refreshes after downloads and deletes. */
export function useDownloaded() {
  const [have, setHave] = useState<Record<string, boolean>>({})
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    Promise.all(LOCAL_MODELS.map(async (m) => [m.key, await isDownloaded(m.key)] as const)).then((r) => live && setHave(Object.fromEntries(r)))
    return () => void (live = false)
  }, [tick])
  useEffect(() => {
    let last = getLocalStatus().phase
    return subscribeLocal(() => {
      const p = getLocalStatus().phase
      if (p !== last && (p === "ready" || p === "error")) setTick((t) => t + 1)
      last = p
    })
  }, [])
  return { have, refresh: () => setTick((t) => t + 1) }
}

const pct = (p: number) => `${Math.round(p * 100)}%`

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx("h-1.5 overflow-hidden rounded-full bg-line-soft", className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="brand-gradient h-full rounded-full transition-[width] duration-300" style={{ width: pct(value) }} />
    </div>
  )
}

export function statusLine(s: ReturnType<typeof getLocalStatus>) {
  const name = localModel(s.model).name
  if (s.phase === "downloading") return `Downloading ${name} to this device · ${pct(s.progress)}`
  if (s.phase === "loading") return `Starting ${name} on your device · ${pct(s.progress)}`
  return ""
}

/** Shown inside an answer bubble while the model is being prepared. */
export function LocalPreparing() {
  const s = useLocalStatus()
  if (s.phase !== "downloading" && s.phase !== "loading") return null
  return (
    <div className="mt-4 max-w-[420px] rounded-xl border border-line bg-sunken p-3.5">
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <Cpu className="size-4 text-accent" /> {statusLine(s)}
      </p>
      <ProgressBar value={s.progress} className="mt-2.5" />
      {s.phase === "downloading" && <p className="mt-2 text-[12px] text-muted">One-time download. After this, answers are generated privately on your computer — even offline.</p>}
    </div>
  )
}

/** Floating card in the app shell: download progress and start-up errors. */
export function LocalStatusCard() {
  const s = useLocalStatus()
  const [hidden, setHidden] = useState<string | null>(null)
  const busy = s.phase === "downloading" || s.phase === "loading"
  const key = `${s.phase}:${s.error ?? ""}`
  if (!(busy || s.phase === "error") || hidden === key) return null
  return (
    <div className="fixed right-4 bottom-4 z-40 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-4 shadow-pop" role="status">
      <div className="flex items-start gap-3">
        <span className={cx("grid size-8 shrink-0 place-items-center rounded-lg", s.phase === "error" ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent")}>
          {s.phase === "error" ? <AlertTriangle className="size-4" /> : <Cpu className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          {s.phase === "error" ? (
            <>
              <p className="text-[13.5px] font-medium">On-device AI couldn't start</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{s.error} Paper Tech is using its backup AI for now.</p>
              <div className="mt-2.5 flex gap-3 text-[12.5px]">
                <button className="font-medium text-accent hover:underline" onClick={() => (retryLocal(), loadLocal().catch(() => {}))}>
                  Try again
                </button>
                <a className="text-muted hover:text-ink" href="#/app/settings/ai">
                  Choose a model
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="text-[13.5px] font-medium">{statusLine(s)}</p>
              <ProgressBar value={s.progress} className="mt-2.5" />
              <p className="mt-2 text-[12px] text-muted">{s.phase === "downloading" ? "One-time download. You can keep working." : "Loading from this device's storage."}</p>
            </>
          )}
        </div>
        <button className="text-faint hover:text-ink" onClick={() => setHidden(key)} aria-label="Hide">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

/** Home-page prompt to download the model ahead of the first question. */
export function LocalSetupCard() {
  const { state } = useStore()
  const gpu = useGPU()
  const { have } = useDownloaded()
  const s = useLocalStatus()
  const m = localModel(state.prefs.localModel)
  if (!state.prefs.localAI || !gpu?.ok || have[m.key] === undefined || have[m.key] || state.prefs.apiKey) return null
  const busy = s.phase === "downloading" || s.phase === "loading"
  return (
    <div className="rounded-2xl border border-accent-line bg-accent-soft/60 p-5">
      <p className="flex items-center gap-2 text-[14px] font-semibold">
        <ShieldCheck className="size-4 text-accent" /> Turn on private, on-device AI
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        Paper Tech runs {m.maker === "Paper Tech" ? m.name : `${m.maker}'s ${m.name}`} right in your browser. Download it once ({m.size}) and your questions never leave this computer.
      </p>
      {busy ? (
        <div className="mt-3">
          <p className="text-[12.5px] text-muted">{statusLine(s)}</p>
          <ProgressBar value={s.progress} className="mt-2" />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" icon={<Download className="size-4" />} onClick={() => loadLocal().then(() => toast(`${m.name} is ready on this device`)).catch(() => {})}>
            Download {m.name}
          </Button>
          <a href="#/app/settings/ai" className="text-[12.5px] text-muted hover:text-ink">
            Other models
          </a>
        </div>
      )}
    </div>
  )
}

/** Settings → AI: choose, download and remove on-device models. */
export function LocalModelSettings() {
  const { state, update } = useStore()
  const gpu = useGPU()
  const { have, refresh } = useDownloaded()
  const s = useLocalStatus()
  const on = state.prefs.localAI
  const current = localModel(state.prefs.localModel)
  const busy = s.phase === "downloading" || s.phase === "loading"

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-medium">
            On-device AI <Badge tone="accent">Recommended</Badge>
          </p>
          <p className="mt-1.5 max-w-[560px] text-[13.5px] leading-relaxed text-muted">
            The Paper Tech 1 models run on your computer's graphics chip with WebGPU. Your questions, files and answers never leave this device, there's no usage limit, and it keeps working offline.
          </p>
        </div>
        <Toggle checked={on} onChange={(v) => update((d) => void (d.prefs.localAI = v))} label="Use on-device AI" />
      </div>

      {gpu && !gpu.ok && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-[13px] text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {gpu.reason} You can still use <b>Paper Tech Nano</b>, which runs in every browser. For the Paper Tech 1 models, Paper Tech uses the cloud backup below.
          </span>
        </p>
      )}
      {gpu === null && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
          <Spinner /> Checking this device…
        </p>
      )}

      {gpu && (
        <div className={cx("mt-5 space-y-2", !on && "pointer-events-none opacity-50")}>
          {LOCAL_MODELS.filter((m) => !m.vision).map((m) => {
            const blocked = !gpu.ok && !m.builtin
            const selected = m.key === current.key
            const loadingThis = busy && s.model === m.key
            return (
              <div key={m.key} className={cx("rounded-xl border p-4", selected ? "border-accent bg-accent-soft/40" : "border-line", blocked && "opacity-50")}>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name="local-model"
                      className="mt-1 accent-[var(--accent)]"
                      checked={selected}
                      disabled={blocked}
                      onChange={() => update((d) => void (d.prefs.localModel = m.key))}
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                        {m.name}
                        <span className="text-[12px] font-normal text-faint">by {m.maker}</span>
                        {m.builtin && <Badge tone="accent">Built in · made by us</Badge>}
                        {blocked && <span className="text-[12px] font-normal text-warn">Needs WebGPU</span>}
                        {!m.builtin && have[m.key] && (
                          <Badge tone="success">
                            <Check className="size-3" /> On this device
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-muted">
                        {m.blurb} <span className="text-faint">· {m.size}</span>
                      </span>
                    </span>
                  </label>
                  {m.builtin || blocked ? null : have[m.key] ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="size-4" />}
                      disabled={loadingThis}
                      onClick={async () => {
                        await deleteLocal(m.key)
                        refresh()
                        toast(`${m.name} removed from this device`)
                      }}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Download className="size-4" />}
                      loading={loadingThis}
                      disabled={busy && !loadingThis}
                      onClick={() => {
                        update((d) => void (d.prefs.localModel = m.key))
                        retryLocal()
                        loadLocal(m.key)
                          .then(() => toast(`${m.name} is ready on this device`))
                          .catch(() => {})
                      }}
                    >
                      Download
                    </Button>
                  )}
                </div>
                {loadingThis && (
                  <div className="mt-3 pl-7">
                    <p className="text-[12.5px] text-muted">{statusLine(s)}</p>
                    <ProgressBar value={s.progress} className="mt-1.5" />
                  </div>
                )}
                {s.phase === "error" && s.model === m.key && <p className="mt-2 pl-7 text-[12.5px] text-danger">{s.error}</p>}
              </div>
            )
          })}
          <p className="flex items-center gap-1.5 pt-1 text-[12px] text-faint">
            <HardDrive className="size-3.5" /> Models are stored by your browser. If you don't download one first, it downloads automatically with your first question.
          </p>
        </div>
      )}

      {gpu && <VisionSettings gpuOk={gpu.ok} have={Boolean(have[VISION_MODEL])} refresh={refresh} />}
    </div>
  )
}

/** Settings → AI: image understanding. */
function VisionSettings({ gpuOk, have, refresh }: { gpuOk: boolean; have: boolean; refresh: () => void }) {
  const { state, update } = useStore()
  const s = useLocalStatus()
  const on = state.prefs.visionImages !== false
  const m = localModel(VISION_MODEL)
  const busy = (s.phase === "downloading" || s.phase === "loading") && s.model === VISION_MODEL
  return (
    <div className="mt-6 border-t border-line-soft pt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-medium">Images</p>
          <p className="mt-1.5 max-w-[560px] text-[13.5px] leading-relaxed text-muted">
            Attach images with the image button, by pasting, or by dragging them into the message box. Paper Tech reads the text in images on every device.
            {gpuOk ? " With Paper Tech 1 Vision it also looks at the whole picture — photos, charts, screenshots and sketches." : " Looking at whole pictures needs WebGPU, which this browser doesn't have."}
          </p>
        </div>
        {gpuOk && <Toggle checked={on} onChange={(v) => update((d) => void (d.prefs.visionImages = v))} label="Use Paper Tech 1 Vision for images" />}
      </div>
      {gpuOk && (
        <div className={cx("mt-4 rounded-xl border border-line p-4", !on && "opacity-50")}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                {m.name}
                <span className="text-[12px] font-normal text-faint">built on Phi-3.5-vision (MIT)</span>
                {have && (
                  <Badge tone="success">
                    <Check className="size-3" /> On this device
                  </Badge>
                )}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-muted">
                {m.blurb} <span className="text-faint">· {m.size}</span>
              </span>
            </span>
            {have ? (
              <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={async () => (await deleteLocal(VISION_MODEL), refresh(), toast(`${m.name} removed from this device`))}>
                Remove
              </Button>
            ) : (
              <Button variant="secondary" size="sm" icon={<Download className="size-4" />} loading={busy} disabled={!on} onClick={() => loadLocal(VISION_MODEL).then(() => (refresh(), toast(`${m.name} is ready on this device`))).catch(() => {})}>
                Download
              </Button>
            )}
          </div>
          {busy && (
            <div className="mt-3">
              <p className="text-[12.5px] text-muted">{statusLine(s)}</p>
              <ProgressBar value={s.progress} className="mt-1.5" />
            </div>
          )}
          {!have && !busy && <p className="mt-2 text-[12px] text-faint">If you don't download it now, it downloads the first time you attach an image.</p>}
        </div>
      )}
    </div>
  )
}
