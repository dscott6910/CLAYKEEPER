export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6" role="status" aria-label="Loading executive dashboard">
      <div className="h-56 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </div>
  )
}
