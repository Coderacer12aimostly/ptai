import { useCallback, useEffect, useRef, useState } from "react"
import { FileText, Paperclip, X } from "lucide-react"
import { ATTACH_ACCEPT, MAX_ATTACHMENTS, MAX_IMAGES, getImage, isImageFile, prepareDoc, prepareImage } from "../lib/images"
import type { ImageRef } from "../lib/types"
import { Modal, Spinner } from "./ui"
import { toast } from "./toast"
import { cx } from "../lib/utils"

/** Attach images and files (PDF, Word, text, CSV, code) by button, paste or drag & drop. */
export function useImageAttach() {
  const [images, setImages] = useState<ImageRef[]>([])
  const [busy, setBusy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const add = useCallback(
    async (files: FileList | File[]) => {
      const list = [...files]
      if (!list.length) return
      const room = MAX_ATTACHMENTS - images.length
      if (room <= 0) return toast(`You can attach up to ${MAX_ATTACHMENTS} things per message.`, "info")
      if (list.length > room) toast(`Only the first ${room} file${room > 1 ? "s were" : " was"} added (max ${MAX_ATTACHMENTS}).`, "info")
      let pics = images.filter((x) => !x.doc).length
      for (const f of list.slice(0, room)) {
        const pic = isImageFile(f)
        if (pic && pics >= MAX_IMAGES) {
          toast(`You can attach up to ${MAX_IMAGES} images per message.`, "info")
          continue
        }
        if (pic) pics++
        setBusy((b) => b + 1)
        try {
          const ref = pic ? await prepareImage(f) : await prepareDoc(f)
          setImages((xs) => (xs.length >= MAX_ATTACHMENTS ? xs : [...xs, ref]))
        } catch (e) {
          toast((e as Error).message, "error")
        } finally {
          setBusy((b) => b - 1)
        }
      }
    },
    [images.length],
  )

  return {
    images,
    busy: busy > 0,
    dragging,
    remove: (id: string) => setImages((xs) => xs.filter((x) => x.id !== id)),
    clear: () => setImages([]),
    open: () => input.current?.click(),
    input: (
      <input
        ref={input}
        type="file"
        accept={ATTACH_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void add(e.target.files)
          e.target.value = ""
        }}
      />
    ),
    onPaste: (e: React.ClipboardEvent) => {
      const files = [...e.clipboardData.files]
      if (files.length) {
        e.preventDefault()
        void add(files)
      }
    },
    dropProps: {
      onDragOver: (e: React.DragEvent) => {
        if ([...e.dataTransfer.items].some((i) => i.kind === "file")) {
          e.preventDefault()
          setDragging(true)
        }
      },
      onDragLeave: () => setDragging(false),
      onDrop: (e: React.DragEvent) => {
        setDragging(false)
        const files = [...e.dataTransfer.files]
        if (files.length) {
          e.preventDefault()
          void add(files)
        }
      },
    },
  }
}

export function AttachImageButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid size-8 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" title="Attach images or files: PDF, Word, text, CSV, code (or paste / drop them)" aria-label="Attach images or files">
      <Paperclip className="size-[18px]" />
    </button>
  )
}

/** Thumbnails of images waiting to be sent. */
export function ImageStrip({ images, busy, onRemove }: { images: ImageRef[]; busy?: boolean; onRemove: (id: string) => void }) {
  if (!images.length && !busy) return null
  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3">
      {images.map((im) => (
        <div key={im.id} className="group relative">
          {im.doc ? <FileChip im={im} /> : <img src={im.thumb} alt={im.name} className="size-16 rounded-lg border border-line object-cover" />}
          <button
            type="button"
            onClick={() => onRemove(im.id)}
            className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ink text-canvas opacity-90 hover:opacity-100"
            aria-label={`Remove ${im.name}`}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
      {busy && (
        <div className="grid size-16 place-items-center rounded-lg border border-dashed border-line text-muted">
          <Spinner className="size-4" />
        </div>
      )}
    </div>
  )
}

function FileChip({ im }: { im: ImageRef }) {
  return (
    <div className="flex h-16 max-w-[220px] items-center gap-2.5 rounded-lg border border-line bg-surface px-3" title={im.name}>
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-sunken text-muted">
        <FileText className="size-[18px]" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-[13px] font-medium">{im.name}</span>
        <span className="block truncate text-[11.5px] text-muted">{im.doc?.meta}</span>
      </span>
    </div>
  )
}

/** Images shown inside a sent message; click to see full size. */
export function MessageImages({ images, align = "end" }: { images: ImageRef[]; align?: "start" | "end" }) {
  const [open, setOpen] = useState<ImageRef | null>(null)
  const [full, setFull] = useState<string | null>(null)
  useEffect(() => {
    setFull(null)
    if (open) void getImage(open.id).then((u) => setFull(u ?? open.thumb))
  }, [open])
  return (
    <>
      <div className={cx("flex flex-wrap gap-2", align === "end" ? "justify-end" : "justify-start")}>
        {images.filter((im) => im.doc).map((im) => <FileChip key={im.id} im={im} />)}
        {images.filter((im) => !im.doc).map((im) => (
          <button key={im.id} type="button" onClick={() => setOpen(im)} className="overflow-hidden rounded-xl border border-line" title={im.name}>
            <img src={im.thumb} alt={im.name} className={cx("block object-cover", images.filter((x) => !x.doc).length === 1 ? "max-h-56 max-w-[min(320px,70vw)]" : "size-28")} />
          </button>
        ))}
      </div>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name ?? "Image"} width={900}>
        {open && (
          <div className="grid place-items-center">
            <img src={full ?? open.thumb} alt={open.name} className="max-h-[70vh] max-w-full rounded-lg" />
            <p className="mt-2 text-[12px] text-muted">
              {open.w}×{open.h}
              {open.colors?.length ? ` · ${open.colors.join(", ")}` : ""}
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}

/** The notes the model received about the images (shown under the reply's images on request). */
export function DropOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-surface/90 text-[14px] font-medium">
      <span className="inline-flex items-center gap-2">
        <Paperclip className="size-5" /> Drop images or files to attach
      </span>
    </div>
  )
}
