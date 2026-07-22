import { BrowserRouter, Route, Routes } from "react-router-dom"

import { AppShell } from "@/app/AppShell"
import { AuthProvider } from "@/features/auth/AuthProvider"
import { LoginPage } from "@/features/auth/LoginPage"
import { ProtectedRoute } from "@/features/auth/ProtectedRoute"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { EventWorkspace } from "@/features/events/EventWorkspace"
import { EventsPage } from "@/features/events/EventsPage"
import { ParticipantsPage } from "@/features/participants/ParticipantsPage"
import { RegistrationPage } from "@/features/registration/RegistrationPage"
import { ReportsPage } from "@/features/reports/ReportsPage"
import { LiveScoringPage } from "@/features/scoring/LiveScoringPage"
import { SettingsPage } from "@/features/settings/SettingsPage"
import { SquadsPage } from "@/features/squads/SquadsPage"
import { TeamsPage } from "@/features/teams/TeamsPage"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="participants" element={<ParticipantsPage />} />
              <Route path="teams" element={<TeamsPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="events/:eventId" element={<EventWorkspace />} />
              <Route path="events/:eventId/shoots" element={<EventWorkspace />} />
              <Route path="events/:eventId/participants" element={<EventWorkspace />} />
              <Route path="registration" element={<RegistrationPage />} />
              <Route path="squads" element={<SquadsPage />} />
              <Route path="scoring" element={<LiveScoringPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
