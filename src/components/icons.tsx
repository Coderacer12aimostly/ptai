import { BookOpen, ChartNoAxesCombined, Compass, FileText, Folder, Image, Lightbulb, Link2, MessagesSquare, PenLine, Rocket, ScanSearch, Shapes, Sheet, Sparkles, Sunrise, FilePen } from "lucide-react"
import type { Assistant, FileKind, Project } from "../lib/types"
import { cx } from "../lib/utils"

export const PROJECT_ICONS = { sunrise: Sunrise, messages: MessagesSquare, shapes: Shapes, folder: Folder, rocket: Rocket, book: BookOpen } as const
export const ASSISTANT_ICONS = { scan: ScanSearch, pen: PenLine, bulb: Lightbulb, chart: ChartNoAxesCombined, sparkles: Sparkles, compass: Compass } as const
export const TINTS: Record<Project["tint"], string> = {
  sage: "bg-[#ececee] dark:bg-[#242427]",
  sand: "bg-[#f0f0f1] dark:bg-[#27272a]",
  mist: "bg-[#e9e9ec] dark:bg-[#222225]",
  blue: "bg-[#e6e6ea] dark:bg-[#2a2a2e]",
}

export function ProjectIcon({ icon, className = "size-[18px]" }: { icon: Project["icon"]; className?: string }) {
  const I = PROJECT_ICONS[icon] ?? Folder
  return <I className={className} strokeWidth={1.7} />
}

export function AssistantIcon({ icon, className = "size-[18px]" }: { icon: Assistant["icon"]; className?: string }) {
  const I = ASSISTANT_ICONS[icon] ?? Sparkles
  return <I className={className} strokeWidth={1.7} />
}

export function FileIcon({ kind, className }: { kind: FileKind; className?: string }) {
  const I = { pdf: FileText, doc: FileText, csv: Sheet, text: FileText, link: Link2, image: Image, artifact: FilePen }[kind] ?? FileText
  return <I className={cx("size-[18px]", className)} strokeWidth={1.7} />
}

export function GoogleG({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  )
}
