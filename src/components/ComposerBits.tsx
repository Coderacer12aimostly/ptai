import { useRef, useState } from "react"
import { ArrowUp, Check, Mic, Plus, Square, X } from "lucide-react"
import { Menu } from "./ui"
import { toast } from "./toast"
import { cx } from "../lib/utils"

/** The message box frame: one rounded card with a soft shadow. */
export const composerBox =
  "relative rounded-[22px] border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/4%),0_6px_20px_rgb(0_0_0/5%)] transition-[border-color,box-shadow] focus-within:border-accent-line focus-within:shadow-[0_1px_2px_rgb(0_0_0/5%),0_8px_28px_rgb(0_0_0/8%)]"

/** Voice dictation with the browser's speech recognition. */
export function useDictation(text: string, setText: (t: string) => void) {
  const [listening, setListening] = useState(false)
  const recog = useRef<any>(null)
  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return toast("Voice input isn't supported in this browser. Try Chrome or Edge.", "info")
    if (listening) return recog.current?.stop()
    const r = new SR()
    r.interimResults = true
    r.continuous = false
    r.lang = navigator.language || "en-US"
    const base = text ? text.trimEnd() + " " : ""
    r.onresult = (e: any) => setText(base + Array.from(e.results).map((x: any) => x[0].transcript).join(""))
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recog.current = r
    r.start()
    setListening(true)
  }
  return { listening, toggle }
}

export function IconButton({ children, label, onClick, active, className }: { children: React.ReactNode; label: string; onClick?: () => void; active?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx("grid size-8 place-items-center rounded-full transition-colors [&_svg]:size-[18px]", active ? "bg-accent-soft text-ink" : "text-muted hover:bg-sunken hover:text-ink", className)}
    >
      {children}
    </button>
  )
}

export function MicButton({ listening, onClick }: { listening: boolean; onClick: () => void }) {
  return (
    <IconButton label={listening ? "Stop dictation" : "Dictate"} onClick={onClick} className={listening ? "animate-pulse text-danger" : undefined}>
      <Mic />
    </IconButton>
  )
}

export function SendButton({ busy, disabled, onSend, onStop }: { busy?: boolean; disabled?: boolean; onSend: () => void; onStop?: () => void }) {
  return busy ? (
    <button type="button" onClick={onStop} className="grid size-8 place-items-center rounded-full bg-ink text-canvas" title="Stop" aria-label="Stop">
      <Square className="size-3 fill-current" />
    </button>
  ) : (
    <button type="button" onClick={onSend} disabled={disabled} className="grid size-8 place-items-center rounded-full bg-accent text-on-accent transition-opacity disabled:opacity-30" title="Send" aria-label="Send">
      <ArrowUp className="size-[17px]" />
    </button>
  )
}

export type PlusItem = { icon: React.ReactNode; label: string; hint?: string; onClick: () => void; checked?: boolean } | "divider"

/** The "+" menu: attach things and switch tools on/off. */
export function PlusMenu({ items }: { items: PlusItem[] }) {
  return (
    <Menu
      align="left"
      side="up"
      width={252}
      trigger={(open) => (
        <span className={cx("grid size-8 place-items-center rounded-full transition-colors", open ? "bg-sunken text-ink" : "text-muted hover:bg-sunken hover:text-ink")} title="Add files, tools and more" aria-label="Add files, tools and more" role="button">
          <Plus className={cx("size-[19px] transition-transform", open && "rotate-45")} />
        </span>
      )}
    >
      {(close) =>
        items.map((it, i) =>
          it === "divider" ? (
            <div key={i} className="my-1 h-px bg-line-soft" />
          ) : (
            <button
              key={it.label}
              role="menuitem"
              type="button"
              onClick={() => (close(), it.onClick())}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink hover:bg-sunken [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted"
            >
              {it.icon}
              <span className="min-w-0 flex-1">
                <span className="block">{it.label}</span>
                {it.hint && <span className="block text-[11.5px] text-faint">{it.hint}</span>}
              </span>
              {it.checked !== undefined && (
                <span className={cx("grid size-4 place-items-center rounded-full", it.checked ? "bg-accent text-on-accent" : "border border-line")}>{it.checked && <Check className="size-2.5" />}</span>
              )}
            </button>
          ),
        )
      }
    </Menu>
  )
}

/** A small "tool is on" chip with a remove button. */
export function ToolChip({ icon, label, onRemove }: { icon: React.ReactNode; label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pr-1 pl-2.5 text-[12px] text-ink [&>svg]:size-3.5">
      {icon}
      {label}
      <button type="button" onClick={onRemove} className="grid size-4 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label={`Turn off ${label}`}>
        <X className="size-3" />
      </button>
    </span>
  )
}
