import type { LucideIcon } from "lucide-react"

import type { OrganizationCapability } from "@/lib/permissions"
import {
  Building2,
  BarChart3,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  DatabaseBackup,
  Wrench,
  Landmark,
  RadioTower,
  Medal,
  LayoutDashboard,
  GraduationCap,
  Settings,
  Target,
  Trophy,
  Tv,
  Users,
  UserRound,
  Globe2,
  Smartphone,
  CreditCard,
  FileInput,
} from "lucide-react"

export type NavigationItem = {
  label: string
  path: string
  icon: LucideIcon
  capability?: OrganizationCapability
  memberVisible?: boolean
}

export type NavigationSection = {
  label?: string
  items: NavigationItem[]
}

export const navigationSections: NavigationSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        path: "/",
        icon: LayoutDashboard,
        memberVisible: false,
      },
      {
        label: "My Profile",
        path: "/my-profile",
        icon: UserRound,
        memberVisible: true,
      },
    ],
  },
  {
    label: "Organization",
    items: [
      {
        label: "Participants",
        path: "/participants",
        icon: Users,
        capability: "manageParticipants",
      },
      {
        label: "ActiveNet Import",
        path: "/participants/activenet",
        icon: FileInput,
          capability: "manageImports",
      },
      {
        label: "Coach Portal",
        path: "/coach",
        icon: GraduationCap,
        capability: "manageCoachPortal",
      },
    ],
  },
  {
    label: "Competition",
    items: [
      {
        label: "Events",
        path: "/events",
        icon: CalendarDays,
        capability: "manageEvents",
      },
      {
        label: "Registration",
        path: "/registration",
        icon: ClipboardList,
        capability: "manageRegistration",
      },
      {
        label: "Squadding",
        path: "/squads",
        icon: Target,
        capability: "operateEvents",
      },
      {
        label: "Digital Scoring",
        path: "/scoring",
        icon: Trophy,
          capability: "score",
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        label: "Mobile Operations",
        path: "/mobile",
        icon: Smartphone,
        capability: "operateEvents",
      },
      {
        label: "Event Operations",
        path: "/event-operations",
        icon: RadioTower,
        capability: "operateEvents",
      },
      {
        label: "Reports",
        path: "/reports",
        icon: BarChart3,
        capability: "viewCompetitionReports",
      },
      {
        label: "Analytics",
        path: "/analytics",
        icon: BarChart3,
        capability: "viewCompetitionReports",
      },
      {
        label: "Awards & Results",
        path: "/awards",
        icon: Medal,
        capability: "viewCompetitionReports",
      },
      {
        label: "Treasurer Center",
        path: "/treasurer",
        icon: Landmark,
        capability: "managePayments",
      },
      {
        label: "Registration & Payments",
        path: "/registration-payments",
        icon: CreditCard,
          capability: "managePayments",
      },
      {
        label: "Live Leaderboard",
        path: "/leaderboard",
        icon: Tv,
        capability: "viewCompetitionReports",
      },
      {
        label: "Season Management",
        path: "/seasons",
        icon: CalendarRange,
        capability: "manageSeasons",
      },
      {
        label: "Seasons & Imports",
        path: "/operations",
        icon: DatabaseBackup,
          capability: "manageImports",
      },
      {
        label: "Event Maintenance",
        path: "/event-maintenance",
        icon: Wrench,
          capability: "admin",
      },
      {
        label: "Public Portal",
        path: "/public",
        icon: Globe2,
        capability: "managePublicPortal",
      },
      {
        label: "Create Organization",
        path: "/organizations/new",
        icon: Building2,
        capability: "admin",
      },
      {
        label: "Settings",
        path: "/settings",
        icon: Settings,
          capability: "admin",
      },
    ],
  },
]

// Temporary compatibility export.
// This allows the existing AppSidebar to continue working until
// we update it to display section headings.
export const navigationItems = navigationSections.flatMap(
  (section) => section.items,
)
