import type { LucideIcon } from "lucide-react"

type ModulePlaceholderProps = {
  title: string
  description: string
  icon: LucideIcon
}

export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
}: ModulePlaceholderProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex max-w-2xl items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <Icon className="size-6 text-slate-700" />
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {description}
          </p>

          <p className="mt-4 text-sm font-medium text-slate-500">
            This ClayKeeper module is ready for development.
          </p>
        </div>
      </div>
    </section>
  )
}