import { lazy, Suspense, type ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AppShell } from "@/app/AppShell"
import { AppErrorBoundary } from "@/components/system/AppErrorBoundary"
import { AuthProvider } from "@/features/auth/AuthProvider"
import { LoginPage } from "@/features/auth/LoginPage"

const ParticipantSignupPage = lazy(() =>
  import("@/features/auth/ParticipantSignupPage").then((module) => ({
    default: module.ParticipantSignupPage,
  })),
)

const OrganizationSignupLandingPage = lazy(() =>
  import("@/features/auth/OrganizationSignupLandingPage").then((module) => ({
    default: module.OrganizationSignupLandingPage,
  })),
)

const StaffSignupPage = lazy(() =>
  import("@/features/auth/StaffSignupPage").then((module) => ({
    default: module.StaffSignupPage,
  })),
)

const SignupDirectoryPage = lazy(() =>
  import("@/features/auth/SignupDirectoryPage").then((module) => ({
    default: module.SignupDirectoryPage,
  })),
)

const CoachActivationPage = lazy(() =>
  import("@/features/auth/CoachActivationPage").then((module) => ({
    default: module.CoachActivationPage,
  })),
)
import { ProtectedRoute } from "@/features/auth/ProtectedRoute"
import { CapabilityRoute } from "@/features/auth/CapabilityRoute"
import { OrganizationHomeRoute } from "@/features/auth/OrganizationHomeRoute"
import { NonMemberRoute } from "@/features/auth/NonMemberRoute"
import { OrganizationProvider } from "@/features/organization/OrganizationProvider"

const DashboardPage = lazy(() =>
  import("@/features/dashboard/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
)


const CourseBuilderPage = lazy(() =>
  import("@/features/events/CourseBuilderPage").then((module) => ({
    default: module.CourseBuilderPage,
  })),
)

const EventWorkspace = lazy(() =>
  import("@/features/events/EventWorkspace").then((module) => ({
    default: module.EventWorkspace,
  })),
)

const EventsPage = lazy(() =>
  import("@/features/events/EventsPage").then((module) => ({
    default: module.EventsPage,
  })),
)

const ParticipantsPage = lazy(() =>
  import("@/features/participants/ParticipantsPage").then((module) => ({
    default: module.ParticipantsPage,
  })),
)

const ParticipantProfilePage = lazy(() =>
  import("@/features/participants/ParticipantProfilePage").then(
    (module) => ({
      default: module.ParticipantProfilePage,
    }),
  ),
)

const ParticipantHomePage = lazy(() =>
  import("@/features/participants/ParticipantHomePage").then(
    (module) => ({
      default: module.ParticipantHomePage,
    }),
  ),
)

const ActiveNetImportPage = lazy(() =>
  import("@/features/participants/ActiveNetImportPage").then((module) => ({
    default: module.ActiveNetImportPage,
  })),
)

const RegistrationPage = lazy(() =>
  import("@/features/registration/RegistrationPage").then((module) => ({
    default: module.RegistrationPage,
  })),
)

const ReportsPage = lazy(() =>
  import("@/features/reports/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  })),
)

const AwardsPage = lazy(() =>
  import("@/features/reports/AwardsPage").then((module) => ({
    default: module.AwardsPage,
  })),
)

const TreasurerPage = lazy(() =>
  import("@/features/reports/TreasurerPage").then((module) => ({
    default: module.TreasurerPage,
  })),
)

const LeaderboardPage = lazy(() =>
  import("@/features/reports/LeaderboardPage").then((module) => ({
    default: module.LeaderboardPage,
  })),
)

const LiveScoringEventSelectorPage = lazy(() =>
  import("@/features/scoring/LiveScoringEventSelectorPage").then((module) => ({
    default: module.LiveScoringEventSelectorPage,
  })),
)

const LiveScoringPage = lazy(() =>
  import("@/features/scoring/LiveScoringPage").then((module) => ({
    default: module.LiveScoringPage,
  })),
)



const DigitalScoringPage = lazy(() =>
  import("@/features/scoring/DigitalScoringPage").then((module) => ({
    default: module.DigitalScoringPage,
  })),
)

const SeasonImportPage = lazy(() =>
  import("@/features/operations/SeasonImportPage").then((module) => ({
    default: module.SeasonImportPage,
  })),
)

const SeasonManagementPage = lazy(() =>
  import("@/features/operations/SeasonManagementPage").then((module) => ({
    default: module.SeasonManagementPage,
  })),
)

const SeasonStandingsPage = lazy(() =>
  import("@/features/operations/SeasonStandingsPage").then((module) => ({
    default: module.SeasonStandingsPage,
  })),
)

const SeasonQualificationPage = lazy(() =>
  import("@/features/operations/SeasonQualificationPage").then((module) => ({
    default: module.SeasonQualificationPage,
  })),
)

const SeasonTeamRankingsPage = lazy(() =>
  import("@/features/operations/SeasonTeamRankingsPage").then((module) => ({
    default: module.SeasonTeamRankingsPage,
  })),
)

const SeasonFinalsPage = lazy(() =>
  import("@/features/operations/SeasonFinalsPage").then((module) => ({
    default: module.SeasonFinalsPage,
  })),
)

const SettingsPage = lazy(() =>
  import("@/features/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
)

const CreateOrganizationPage = lazy(() =>
  import("@/features/organization/CreateOrganizationPage").then((module) => ({
    default: module.CreateOrganizationPage,
  })),
)

const NotFoundPage = lazy(() =>
  import("@/features/system/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
)

const SquadsPage = lazy(() =>
  import("@/features/squads/SquadsPage").then((module) => ({
    default: module.SquadsPage,
  })),
)

const CoachPortalPage = lazy(() =>
  import("@/features/coaches/CoachPortalPage").then((module) => ({
    default: module.CoachPortalPage,
  })),
)

const CheckInCenterPage = lazy(() =>
  import("@/features/events/CheckInCenterPage").then((module) => ({
    default: module.CheckInCenterPage,
  })),
)

const DirectorDashboardPage = lazy(() =>
  import("@/features/events/DirectorDashboardPage").then((module) => ({
    default: module.DirectorDashboardPage,
  })),
)

const TournamentOperationsCenterPage = lazy(() =>
  import("@/features/events/TournamentOperationsCenterPage").then(
    (module) => ({
      default: module.TournamentOperationsCenterPage,
    }),
  ),
)

const EventOperationsPage = lazy(() =>
  import("@/features/operations/EventOperationsPage").then((module) => ({
    default: module.EventOperationsPage,
  })),
)

const PublicPortalPage = lazy(() =>
  import("@/features/public/PublicPortalPage").then((module) => ({
    default: module.PublicPortalPage,
  })),
)

const PublicEventPage = lazy(() =>
  import("@/features/public/PublicEventPage").then((module) => ({
    default: module.PublicEventPage,
  })),
)

const PublicEventSettingsPage = lazy(() =>
  import("@/features/events/PublicEventSettingsPage").then((module) => ({
    default: module.PublicEventSettingsPage,
  })),
)

const MobileOperationsPage = lazy(() =>
  import("@/features/mobile/MobileOperationsPage").then((module) => ({
    default: module.MobileOperationsPage,
  })),
)

const RegistrationPaymentCenterPage = lazy(() =>
  import("@/features/payments/RegistrationPaymentCenterPage").then(
    (module) => ({
      default: module.RegistrationPaymentCenterPage,
    }),
  ),
)

const AnalyticsPage = lazy(() =>
  import("@/features/analytics/AnalyticsPage").then((module) => ({
    default: module.AnalyticsPage,
  })),
)

const EventMaintenancePage = lazy(() =>
  import("@/features/maintenance/EventMaintenancePage").then((module) => ({
    default: module.EventMaintenancePage,
  })),
)


const ScorecardCenterPage = lazy(() =>
  import("@/features/scorecards/ScorecardCenterPage").then((module) => ({
    default: module.ScorecardCenterPage,
  })),
)

const ScorecardScanLabPage = lazy(() =>
  import("@/features/scorecards/ScorecardScanLabPage").then((module) => ({
    default: module.ScorecardScanLabPage,
  })),
)

const ScorecardTemplateDesignerPage = lazy(() =>
  import(
    "@/features/scorecards/ScorecardTemplateDesignerPage"
  ).then((module) => ({
    default: module.ScorecardTemplateDesignerPage,
  })),
)

function RouteLoadingFallback() {
  return (
    <div
      className="flex min-h-[55vh] items-center justify-center p-8"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />

        <p className="mt-4 text-sm font-medium text-slate-600">
          Loading ClayKeeper…
        </p>
      </div>
    </div>
  )
}

function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      {children}
    </Suspense>
  )
}

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/signup"
              element={
                <LazyRoute>
                  <SignupDirectoryPage />
                </LazyRoute>
              }
            />

            <Route
              path="/coach-activate/:token"
              element={
                <LazyRoute>
                  <CoachActivationPage />
                </LazyRoute>
              }
            />

            <Route
              path="/signup/:organizationSlug"
              element={
                <LazyRoute>
                  <OrganizationSignupLandingPage />
                </LazyRoute>
              }
            />

            <Route
              path="/signup/:organizationSlug/youth"
              element={
                <LazyRoute>
                  <ParticipantSignupPage />
                </LazyRoute>
              }
            />

            <Route
              path="/signup/:organizationSlug/staff"
              element={
                <LazyRoute>
                  <StaffSignupPage />
                </LazyRoute>
              }
            />

            <Route
              path="/public"
              element={
                <LazyRoute>
                  <PublicPortalPage />
                </LazyRoute>
              }
            />

            <Route
              path="/public/events/:eventId"
              element={
                <LazyRoute>
                  <PublicEventPage />
                </LazyRoute>
              }
            />

            <Route
              path="/public/:organizationSlug"
              element={
                <LazyRoute>
                  <PublicPortalPage />
                </LazyRoute>
              }
            />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route
                  index
                  element={
                    <OrganizationHomeRoute>
                      <LazyRoute>
                        <DashboardPage />
                      </LazyRoute>
                    </OrganizationHomeRoute>
                  }
                />

                <Route element={<NonMemberRoute />}>
                  <Route
                  path="participants"
                  element={
                    <LazyRoute>
                      <ParticipantsPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route
                  path="my-profile"
                  element={
                    <LazyRoute>
                      <ParticipantHomePage />
                    </LazyRoute>
                  }
                />

                <Route
                  path="participants/:athleteId"
                  element={
                    <LazyRoute>
                      <ParticipantProfilePage />
                    </LazyRoute>
                  }
                />

                <Route element={<CapabilityRoute capability="manageImports" />}>
                  <Route
                    path="participants/activenet"
                    element={
                      <LazyRoute>
                        <ActiveNetImportPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route path="teams" element={<Navigate to="/coach" replace />} />

                <Route element={<CapabilityRoute capability="manageCoachPortal" />}>
                  <Route
                    path="coach"
                    element={
                      <LazyRoute>
                        <CoachPortalPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route element={<CapabilityRoute capability="manageEvents" />}>
                  <Route
                    path="events"
                    element={
                      <LazyRoute>
                        <EventsPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route element={<NonMemberRoute />}>
                  <Route
                  path="events/:eventId"
                  element={
                    <LazyRoute>
                      <EventWorkspace />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="operateEvents" />}>
                  <Route
                  path="events/:eventId/check-in"
                  element={
                    <LazyRoute>
                      <CheckInCenterPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="operateEvents" />}>
                  <Route
                  path="events/:eventId/director"
                  element={
                    <LazyRoute>
                      <DirectorDashboardPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="operateEvents" />}>
                  <Route
                  path="events/:eventId/operations"
                  element={
                    <LazyRoute>
                      <TournamentOperationsCenterPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="managePublicPortal" />}>
                  <Route
                  path="events/:eventId/public"
                  element={
                    <LazyRoute>
                      <PublicEventSettingsPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="operateEvents" />}>
                  <Route
                  path="events/:eventId/course"
                  element={
                    <LazyRoute>
                      <CourseBuilderPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="score" />}>
                  <Route
                  path="events/:eventId/live-scoring"
                  element={
                    <LazyRoute>
                      <LiveScoringPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="score" />}>
                  <Route
                    path="events/:eventId/digital-scoring"
                    element={
                      <LazyRoute>
                        <DigitalScoringPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route element={<NonMemberRoute />}>
                  <Route
                  path="events/:eventId/leaderboard"
                  element={
                    <LazyRoute>
                      <LeaderboardPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="score" />}>
                  <Route
                  path="events/:eventId/scoring"
                  element={
                    <LazyRoute>
                      <ScorecardCenterPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<NonMemberRoute />}>
                  <Route
                  path="events/:eventId/shoots"
                  element={
                    <LazyRoute>
                      <EventWorkspace />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<NonMemberRoute />}>
                  <Route
                  path="events/:eventId/participants"
                  element={
                    <LazyRoute>
                      <EventWorkspace />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="manageRegistration" />}>
                  <Route
                    path="registration"
                    element={
                      <LazyRoute>
                        <RegistrationPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route element={<CapabilityRoute capability="operateEvents" />}>
                  <Route
                    path="squads"
                    element={
                      <LazyRoute>
                        <SquadsPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route element={<CapabilityRoute capability="score" />}>
                  <Route
                    path="scoring"
                    element={
                      <LazyRoute>
                        <LiveScoringEventSelectorPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                  <Route
                    path="scorecard-templates"
                    element={
                       <LazyRoute>
                         <ScorecardTemplateDesignerPage />
                       </LazyRoute>
                   }
                />
                
                <Route element={<CapabilityRoute capability="viewCompetitionReports" />}>
                  <Route
                  path="events/:eventId/reports"
                  element={
                    <LazyRoute>
                      <ReportsPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="viewCompetitionReports" />}>
                  <Route
                  path="reports"
                  element={
                    <LazyRoute>
                      <ReportsPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="viewCompetitionReports" />}>
                  <Route
                  path="analytics"
                  element={
                    <LazyRoute>
                      <AnalyticsPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="viewCompetitionReports" />}>
                  <Route
                  path="events/:eventId/awards"
                  element={
                    <LazyRoute>
                      <AwardsPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="viewCompetitionReports" />}>
                  <Route
                  path="awards"
                  element={
                    <LazyRoute>
                      <AwardsPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="managePayments" />}>
                  <Route
                    path="treasurer"
                    element={
                      <LazyRoute>
                        <TreasurerPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route element={<CapabilityRoute capability="managePayments" />}>
                  <Route
                    path="registration-payments"
                    element={
                      <LazyRoute>
                        <RegistrationPaymentCenterPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route element={<CapabilityRoute capability="viewCompetitionReports" />}>
                  <Route
                  path="leaderboard"
                  element={
                    <LazyRoute>
                      <LeaderboardPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="operateEvents" />}>
                  <Route
                    path="event-operations"
                    element={
                      <LazyRoute>
                        <EventOperationsPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route element={<CapabilityRoute capability="operateEvents" />}>
                  <Route
                    path="mobile"
                    element={
                      <LazyRoute>
                        <MobileOperationsPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route element={<CapabilityRoute capability="manageSeasons" />}>
                  <Route
                    path="seasons"
                    element={
                      <LazyRoute>
                        <SeasonManagementPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route element={<NonMemberRoute />}>
                  <Route
                  path="seasons/:seasonId/standings"
                  element={
                    <LazyRoute>
                      <SeasonStandingsPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<NonMemberRoute />}>
                  <Route
                  path="seasons/:seasonId/qualification"
                  element={
                    <LazyRoute>
                      <SeasonQualificationPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<NonMemberRoute />}>
                  <Route
                  path="seasons/:seasonId/teams"
                  element={
                    <LazyRoute>
                      <SeasonTeamRankingsPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<NonMemberRoute />}>
                  <Route
                  path="seasons/:seasonId/finals"
                  element={
                    <LazyRoute>
                      <SeasonFinalsPage />
                    </LazyRoute>
                  }
                />
                </Route>

                <Route element={<CapabilityRoute capability="manageImports" />}>
                  <Route
                    path="operations"
                    element={
                      <LazyRoute>
                        <SeasonImportPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route element={<CapabilityRoute capability="admin" />}>
                  <Route
                    path="event-maintenance"
                    element={
                      <LazyRoute>
                        <EventMaintenancePage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route
                  path="scorecard-scan-lab"
                  element={
                    <LazyRoute>
                      <ScorecardScanLabPage />
                    </LazyRoute>
                  }
                />

                <Route element={<CapabilityRoute capability="admin" />}>
                  <Route
                    path="settings"
                    element={
                      <LazyRoute>
                        <SettingsPage />
                      </LazyRoute>
                    }
                  />

                  <Route
                    path="organizations/new"
                    element={
                      <LazyRoute>
                        <CreateOrganizationPage />
                      </LazyRoute>
                    }
                  />
                </Route>

                <Route
                  path="*"
                  element={
                    <LazyRoute>
                      <NotFoundPage />
                    </LazyRoute>
                  }
                />
              </Route>
            </Route>
            </Routes>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}

export default App
