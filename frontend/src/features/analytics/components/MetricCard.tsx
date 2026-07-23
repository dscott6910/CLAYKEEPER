import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
}: {
  label: string
  value: string | number
  detail: string
  icon: LucideIcon
  href?: string
}) {
  const content = (
    <article className="group h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700 transition group-hover:bg-emerald-100">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  )
  return href ? <Link to={href} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">{content}</Link> : content
}
