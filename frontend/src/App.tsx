import { lazy, Suspense, type ReactNode } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"

import { AppShell } from "@/app/AppShell"
import { AuthProvider } from "@/features/auth/AuthProvider"
import { LoginPage } from "@/features/auth/LoginPage"
import { ProtectedRoute } from "@/features/auth/ProtectedRoute"
import { AppErrorBoundary } from "@/components/system/AppErrorBoundary"

const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })))
const EventWorkspace = lazy(() => import("@/features/events/EventWorkspace").then((module) => ({ default: module.EventWorkspace })))
const EventsPage = lazy(() => import("@/features/events/EventsPage").then((module) => ({ default: module.EventsPage })))
const ParticipantsPage = lazy(() => import("@/features/participants/ParticipantsPage").then((module) => ({ default: module.ParticipantsPage })))
const RegistrationPage = lazy(() => import("@/features/registration/RegistrationPage").then((module) => ({ default: module.RegistrationPage })))
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage").then((module) => ({ default: module.ReportsPage })))
const AwardsPage = lazy(() => import("@/features/reports/AwardsPage").then((module) => ({ default: module.AwardsPage })))
const TreasurerPage = lazy(() => import("@/features/reports/TreasurerPage").then((module) => ({ default: module.TreasurerPage })))
const LeaderboardPage = lazy(() => import("@/features/reports/LeaderboardPage").then((module) => ({ default: module.LeaderboardPage })))
const LiveScoringPage = lazy(() => import("@/features/scoring/LiveScoringPage").then((module) => ({ default: module.LiveScoringPage })))
const SeasonImportPage = lazy(() => import("@/features/operations/SeasonImportPage").then((module) => ({ default: module.SeasonImportPage })))
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })))
const SquadsPage = lazy(() => import("@/features/squads/SquadsPage").then((module) => ({ default: module.SquadsPage })))
const TeamsPage = lazy(() => import("@/features/teams/TeamsPage").then((module) => ({ default: module.TeamsPage })))
const CoachPortalPage = lazy(() => import("@/features/coaches/CoachPortalPage").then((module) => ({ default: module.CoachPortalPage })))
const EventOperationsPage = lazy(() => import("@/features/operations/EventOperationsPage").then((module) => ({ default: module.EventOperationsPage })))
const PublicPortalPage = lazy(() => import("@/features/public/PublicPortalPage").then((module) => ({ default: module.PublicPortalPage })))
const MobileOperationsPage = lazy(() => import("@/features/mobile/MobileOperationsPage").then((module) => ({ default: module.MobileOperationsPage })))

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center p-8" role="status" aria-live="polite">
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
        <p className="mt-4 text-sm font-medium text-slate-600">Loading ClayKeeper…</p>
      </div>
    </div>
  )
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
}

function App() {
  return (
    <AppErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/public" element={<LazyRoute><PublicPortalPage /></LazyRoute>} />
          <Route path="/public/:organizationSlug" element={<LazyRoute><PublicPortalPage /></LazyRoute>} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<LazyRoute><DashboardPage /></LazyRoute>} />
              <Route path="participants" element={<LazyRoute><ParticipantsPage /></LazyRoute>} />
              <Route path="teams" element={<LazyRoute><TeamsPage /></LazyRoute>} />
              <Route path="coach" element={<LazyRoute><CoachPortalPage /></LazyRoute>} />
              <Route path="events" element={<LazyRoute><EventsPage /></LazyRoute>} />
              <Route path="events/:eventId" element={<LazyRoute><EventWorkspace /></LazyRoute>} />
              <Route path="events/:eventId/shoots" element={<LazyRoute><EventWorkspace /></LazyRoute>} />
              <Route path="events/:eventId/participants" element={<LazyRoute><EventWorkspace /></LazyRoute>} />
              <Route path="registration" element={<LazyRoute><RegistrationPage /></LazyRoute>} />
              <Route path="squads" element={<LazyRoute><SquadsPage /></LazyRoute>} />
              <Route path="scoring" element={<LazyRoute><LiveScoringPage /></LazyRoute>} />
              <Route path="reports" element={<LazyRoute><ReportsPage /></LazyRoute>} />
              <Route path="awards" element={<LazyRoute><AwardsPage /></LazyRoute>} />
              <Route path="treasurer" element={<LazyRoute><TreasurerPage /></LazyRoute>} />
              <Route path="leaderboard" element={<LazyRoute><LeaderboardPage /></LazyRoute>} />
              <Route path="event-operations" element={<LazyRoute><EventOperationsPage /></LazyRoute>} />
              <Route path="mobile" element={<LazyRoute><MobileOperationsPage /></LazyRoute>} />
              <Route path="operations" element={<LazyRoute><SeasonImportPage /></LazyRoute>} />
              <Route path="settings" element={<LazyRoute><SettingsPage /></LazyRoute>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </AppErrorBoundary>
  )
}

export default App
