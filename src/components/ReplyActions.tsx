import { useEffect, useState } from "react"
import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp, Volume2, VolumeX } from "lucide-react"
import { toast } from "./toast"
import { cx } from "../lib/utils"

function plain(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " (code) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/[*_#>|-]{1,3}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Embedded viewers can block the clipboard API; fall back to a hidden textarea.
    try {
      const t = document.createElement("textarea")
      t.value = text
      t.style.position = "fixed"
      t.style.opacity = "0"
      document.body.appendChild(t)
      t.select()
      const ok = document.execCommand("copy")
      t.remove()
      return ok
    } catch {
      return false
    }
  }
}

let speaking: string | null = null

/** Copy · read aloud · thumbs up/down · retry — under every finished reply. */
export default function ReplyActions({ id, text, onRetry, feedback, onFeedback, meta, extra }: { id: string; text: string; onRetry?: () => void; feedback?: "up" | "down"; onFeedback?: (f: "up" | "down" | undefined) => void; meta?: React.ReactNode; extra?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const [talking, setTalking] = useState(false)
  useEffect(() => () => void (speaking === id && speechSynthesis.cancel()), [id])
  const btn = "grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-sunken hover:text-ink [&_svg]:size-[15px]"
  return (
    <div className="mt-2 flex items-center gap-0.5">
      <button
        className={btn}
        title={copied ? "Copied" : "Copy"}
        aria-label="Copy"
        onClick={async () => {
          if (await copyText(text)) {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } else toast("Couldn't copy here — select the text instead.", "info")
        }}
      >
        {copied ? <Check /> : <Copy />}
      </button>
      <button
        className={cx(btn, talking && "text-ink")}
        title={talking ? "Stop reading" : "Read aloud"}
        aria-label={talking ? "Stop reading" : "Read aloud"}
        onClick={() => {
          if (!("speechSynthesis" in window)) return toast("Reading aloud isn't supported in this browser.", "info")
          speechSynthesis.cancel()
          if (talking) return setTalking(false)
          const u = new SpeechSynthesisUtterance(plain(text))
          u.onend = u.onerror = () => setTalking(false)
          speaking = id
          speechSynthesis.speak(u)
          setTalking(true)
        }}
      >
        {talking ? <VolumeX /> : <Volume2 />}
      </button>
      <button className={cx(btn, feedback === "up" && "text-ink")} title="Good answer" aria-label="Good answer" aria-pressed={feedback === "up"} onClick={() => (onFeedback?.(feedback === "up" ? undefined : "up"), feedback !== "up" && toast("Thanks for the feedback", "info"))}>
        <ThumbsUp className={feedback === "up" ? "fill-current" : undefined} />
      </button>
      <button className={cx(btn, feedback === "down" && "text-ink")} title="Bad answer" aria-label="Bad answer" aria-pressed={feedback === "down"} onClick={() => (onFeedback?.(feedback === "down" ? undefined : "down"), feedback !== "down" && toast("Thanks — that helps Paper Tech get better", "info"))}>
        <ThumbsDown className={feedback === "down" ? "fill-current" : undefined} />
      </button>
      {onRetry && (
        <button className={btn} title="Try again" aria-label="Try again" onClick={onRetry}>
          <RotateCcw />
        </button>
      )}
      {meta && <span className="ml-2 flex min-w-0 items-center gap-1.5 truncate text-[11.5px] text-faint">{meta}</span>}
      {extra && <span className="ml-auto">{extra}</span>}
    </div>
  )
}
