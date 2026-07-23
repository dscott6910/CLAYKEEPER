import type { NamedMetric } from "@/lib/services/participationAnalytics"

export function HorizontalBarChart({ data, valueSuffix = "" }: { data: NamedMetric[]; valueSuffix?: string }) {
  const max = Math.max(1, ...data.map((item) => item.value))
  if (!data.length) return <p className="py-8 text-center text-sm text-slate-500">No data is available for the selected filters.</p>
  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
            <span className="truncate font-medium text-slate-700">{item.label}</span>
            <span className="font-semibold text-slate-950">{item.value}{valueSuffix}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
