import { ArrowLeft } from "lucide-react"
import { Button, Logo, PaperMark } from "../components/ui"
import { navigate, useRoute } from "../lib/router"

const LEGAL: Record<string, { title: string; body: string[] }> = {
  "/terms": {
    title: "Terms of Service",
    body: [
      "This is placeholder text for Paper Tech's Terms of Service. Replace it with terms reviewed by your legal counsel before launching.",
      "Using Paper Tech means you agree to use it lawfully, keep your account secure, and respect the rights of others in the content you upload.",
      "You own your content. We only process it to provide the service to you and your workspace.",
    ],
  },
  "/privacy": {
    title: "Privacy Policy",
    body: [
      "This is placeholder text for Paper Tech's Privacy Policy. Replace it with a policy reviewed by your legal counsel before launching.",
      "Private by default: your workspace content is visible only to members you invite, and it is never used to train AI models.",
      "In this version of the app, accounts and workspace data are stored in your browser. AI requests are sent to the AI provider configured by the site owner.",
    ],
  },
}

export default function NotFound({ inApp }: { inApp?: boolean }) {
  const { path } = useRoute()
  const legal = LEGAL[path]
  if (legal) {
    return (
      <div className="min-h-dvh bg-canvas">
        <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
          <Logo href="#/" />
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={() => history.back()}>
            Back
          </Button>
        </header>
        <main className="prose-orbit mx-auto max-w-3xl px-5 pt-8 pb-24">
          <p className="eyebrow">Last updated October 2026</p>
          <h1>{legal.title}</h1>
          {legal.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </main>
      </div>
    )
  }
  return (
    <div className={inApp ? "grid min-h-[70dvh] place-items-center p-8" : "grid min-h-dvh place-items-center bg-canvas p-8"}>
      <div className="text-center">
        <PaperMark className="mx-auto size-12 opacity-80" />
        <p className="eyebrow mt-6">404 · Lost paper</p>
        <h1 className="display mt-2 text-[34px] font-semibold">We couldn't find that page.</h1>
        <p className="mt-2 text-muted">It may have moved, or the link is a little off.</p>
        <Button className="mt-6" onClick={() => navigate(inApp ? "/app" : "/")}>
          {inApp ? "Back to Home" : "Go to the homepage"}
        </Button>
      </div>
    </div>
  )
}
