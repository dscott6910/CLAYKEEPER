export function StackedParticipationChart({ data }: { data: Array<{ label: string; newParticipants: number; returningParticipants: number }> }) {
  const max = Math.max(1, ...data.map((item) => item.newParticipants + item.returningParticipants))
  if (!data.length) return <p className="py-8 text-center text-sm text-slate-500">No season history is available.</p>
  return (
    <div className="space-y-5">
      {data.map((item) => {
        const total = item.newParticipants + item.returningParticipants
        return (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
              <span className="text-xs font-semibold text-slate-500">{total} participants</span>
            </div>
            <div className="flex h-5 overflow-hidden rounded-full bg-slate-100" style={{ width: `${Math.max(12, (total / max) * 100)}%` }}>
              <div className="bg-emerald-500" style={{ width: total ? `${(item.newParticipants / total) * 100}%` : "0%" }} title={`${item.newParticipants} new`} />
              <div className="bg-slate-400" style={{ width: total ? `${(item.returningParticipants / total) * 100}%` : "0%" }} title={`${item.returningParticipants} returning`} />
            </div>
            <div className="mt-1.5 flex gap-4 text-xs text-slate-500"><span>{item.newParticipants} new</span><span>{item.returningParticipants} returning</span></div>
          </div>
        )
      })}
    </div>
  )
}
