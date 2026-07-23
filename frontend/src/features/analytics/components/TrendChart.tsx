import type { AnalyticsTrendPoint } from "@/lib/services/analytics"

export function TrendChart({ data }: { data: AnalyticsTrendPoint[] }) {
  const max = Math.max(1, ...data.map((point) => point.registrations))
  return (
    <div className="flex h-48 items-end gap-3 pt-4" aria-label="Six month registration trend">
      {data.map((point) => {
        const height = Math.max(6, Math.round((point.registrations / max) * 132))
        return (
          <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="text-xs font-semibold text-slate-700">{point.registrations}</span>
            <div className="w-full max-w-12 rounded-t-lg bg-emerald-500/90 transition-all" style={{ height }} title={`${point.label}: ${point.registrations} registrations`} />
            <span className="text-xs text-slate-500">{point.label}</span>
          </div>
        )
      })}
    </div>
  )
}
