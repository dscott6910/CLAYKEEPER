import type { LucideIcon } from "lucide-react"

import type { OrganizationCapability } from "@/lib/permissions"
import {
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
        label: "Live Scoring",
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
      },
      {
        label: "Analytics",
        path: "/analytics",
        icon: BarChart3,
      },
      {
        label: "Awards & Results",
        path: "/awards",
        icon: Medal,
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