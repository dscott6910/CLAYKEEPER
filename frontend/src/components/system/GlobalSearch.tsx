import { Search, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { globalSearch, type GlobalSearchResult } from "@/lib/services/globalSearch"

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      }
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([])
      setError("")
      return
    }
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError("")
      try {
        setResults(await globalSearch(query))
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Search failed")
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [open, query])

  const grouped = useMemo(() => results.reduce<Record<string, GlobalSearchResult[]>>((map, item) => {
    ;(map[item.type] ??= []).push(item)
    return map
  }, {}), [results])

  const choose = (result: GlobalSearchResult) => {
    setOpen(false)
    setQuery("")
    navigate(result.path)
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl hover:bg-slate-800" aria-label="Open global search">
        <Search className="h-4 w-4" /> Search <span className="hidden rounded bg-slate-700 px-1.5 py-0.5 text-xs sm:inline">⌘K</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/55 p-4 pt-[10vh]" onMouseDown={() => setOpen(false)}>
          <section className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-slate-200 px-4">
              <Search className="h-5 w-5 text-slate-400" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search participants, teams, events, and shoots…" className="h-14 min-w-0 flex-1 border-0 bg-transparent text-base outline-none" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close search"><X className="h-5 w-5 text-slate-500" /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {query.trim().length < 2 ? <p className="p-6 text-center text-sm text-slate-500">Enter at least two characters to search.</p> : null}
              {loading ? <p className="p-6 text-center text-sm text-slate-500">Searching…</p> : null}
              {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              {!loading && !error && query.trim().length >= 2 && results.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No matching records found.</p> : null}
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type} className="mb-3">
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{type}s</p>
                  {items.map((item) => <button type="button" key={`${item.type}-${item.id}`} onClick={() => choose(item)} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-emerald-50"><span className="block font-medium text-slate-900">{item.title}</span><span className="block text-xs text-slate-500">{item.subtitle}</span></button>)}
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
