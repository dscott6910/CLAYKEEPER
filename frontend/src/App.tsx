import { BrowserRouter, Route, Routes } from "react-router-dom"

import { AppShell } from "@/app/AppShell"
import { AuthProvider } from "@/features/auth/AuthProvider"
import { LoginPage } from "@/features/auth/LoginPage"
import { ProtectedRoute } from "@/features/auth/ProtectedRoute"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { EventsPage } from "@/features/events/EventsPage"
import { ParticipantsPage } from "@/features/participants/ParticipantsPage"
import { RegistrationPage } from "@/features/registration/RegistrationPage"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />

              <Route
                path="participants"
                element={<ParticipantsPage />}
              />

              <Route
                path="teams"
                element={<ParticipantsPage />}
              />

              <Route
                path="events"
                element={<EventsPage />}
              />

              <Route
                path="registration"
                element={<RegistrationPage />}
              />

              <Route
                path="squads"
                element={<ParticipantsPage />}
              />

              <Route
                path="scoring"
                element={<ParticipantsPage />}
              />

              <Route
                path="reports"
                element={<ParticipantsPage />}
              />

              <Route
                path="settings"
                element={<ParticipantsPage />}
              />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App