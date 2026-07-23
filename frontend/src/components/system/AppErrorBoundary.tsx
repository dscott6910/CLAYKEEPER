import { Component, type ErrorInfo, type ReactNode } from "react"

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ClayKeeper application error", error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-600">ClayKeeper encountered an error</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">This page could not be displayed.</h1>
          <p className="mt-3 text-sm text-slate-600">Your data was not changed. Reload the page to try again. If the issue continues, copy the technical detail below.</p>
          <pre className="mt-5 max-h-40 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{this.state.error.message}</pre>
          <button className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.location.reload()} type="button">Reload ClayKeeper</button>
        </section>
      </main>
    )
  }
}
