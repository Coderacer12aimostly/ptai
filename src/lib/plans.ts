import type { PlanId } from "./types"

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  monthly: number | null
  yearly: number | null
  perSeat: boolean
  messages: number
  seats: number
  storage: string
  projects: number
  assistants: number
  highlight?: boolean
  cta: string
  features: string[]
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "For trying Paper Tech on a side project.",
    monthly: 0,
    yearly: 0,
    perSeat: false,
    messages: 100,
    seats: 1,
    storage: "500 MB",
    projects: 2,
    assistants: 2,
    cta: "Start for free",
    features: [
      "Unlimited on-device AI (Paper Tech 1)",
      "Web search with citations",
      "100 cloud AI messages a month",
      "2 projects & 2 assistants",
      "500 MB knowledge storage",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For one person doing a lot of thinking.",
    monthly: 14,
    yearly: 12,
    perSeat: false,
    messages: 2000,
    seats: 1,
    storage: "5 GB",
    projects: 999,
    assistants: 999,
    cta: "Start 14-day trial",
    features: [
      "Unlimited on-device AI, every model",
      "2,000 cloud AI messages a month",
      "Unlimited projects & assistants",
      "Claude web research (cloud)",
      "5 GB knowledge storage",
    ],
  },
  {
    id: "team",
    name: "Team",
    tagline: "For small teams who share context.",
    monthly: 24,
    yearly: 20,
    perSeat: true,
    messages: 2000,
    seats: 5,
    storage: "10 GB",
    projects: 999,
    assistants: 999,
    highlight: true,
    cta: "Start 14-day trial",
    features: [
      "Everything in Pro",
      "2,000 cloud messages per member",
      "Shared projects & assistants",
      "Roles, invites & admin controls",
      "10 GB knowledge storage",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For organisations with real requirements.",
    monthly: null,
    yearly: null,
    perSeat: true,
    messages: 10000,
    seats: 999,
    storage: "Unlimited",
    projects: 999,
    assistants: 999,
    cta: "Talk to us",
    features: [
      "Everything in Team",
      "SSO / SAML & SCIM",
      "Audit logs & data residency",
      "Custom message limits",
      "Dedicated success partner",
    ],
  },
]

export const planById = (id: PlanId) => PLANS.find((p) => p.id === id) ?? PLANS[0]

export function priceLabel(plan: Plan, billing: "monthly" | "yearly") {
  const v = billing === "yearly" ? plan.yearly : plan.monthly
  if (v === null) return "Custom"
  if (v === 0) return "$0"
  return `$${v}`
}

export const COMPARISON: Array<{ label: string; values: Record<PlanId, string | boolean> }> = [
  { label: "On-device AI", values: { free: "Unlimited", pro: "Unlimited", team: "Unlimited", enterprise: "Unlimited" } },
  { label: "Cloud AI messages / month", values: { free: "100", pro: "2,000", team: "2,000 / member", enterprise: "Custom" } },
  { label: "Projects", values: { free: "2", pro: "Unlimited", team: "Unlimited", enterprise: "Unlimited" } },
  { label: "Custom assistants", values: { free: "2", pro: "Unlimited", team: "Unlimited", enterprise: "Unlimited" } },
  { label: "Knowledge storage", values: { free: "500 MB", pro: "5 GB", team: "10 GB", enterprise: "Unlimited" } },
  { label: "Claude Opus (cloud)", values: { free: false, pro: true, team: true, enterprise: true } },
  { label: "Web search with citations", values: { free: true, pro: true, team: true, enterprise: true } },
  { label: "Claude web research (cloud)", values: { free: false, pro: true, team: true, enterprise: true } },
  { label: "Shared workspace", values: { free: false, pro: false, team: true, enterprise: true } },
  { label: "Admin roles & invites", values: { free: false, pro: false, team: true, enterprise: true } },
  { label: "SSO / SAML", values: { free: false, pro: false, team: false, enterprise: true } },
  { label: "Audit logs", values: { free: false, pro: false, team: false, enterprise: true } },
]
