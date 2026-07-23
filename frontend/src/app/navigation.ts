import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  DatabaseBackup,
  Landmark,
  Medal,
  LayoutDashboard,
  School,
  GraduationCap,
  Settings,
  Target,
  Trophy,
  Tv,
  Users,
} from "lucide-react"

export type NavigationItem = {
  label: string
  path: string
  icon: LucideIcon
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
      },
      {
        label: "Teams",
        path: "/teams",
        icon: School,
      },
      {
        label: "Coach Portal",
        path: "/coach",
        icon: GraduationCap,
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
      },
      {
        label: "Registration",
        path: "/registration",
        icon: ClipboardList,
      },
      {
        label: "Squadding",
        path: "/squads",
        icon: Target,
      },
      {
        label: "Live Scoring",
        path: "/scoring",
        icon: Trophy,
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        label: "Reports",
        path: "/reports",
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
      },
      {
        label: "Live Leaderboard",
        path: "/leaderboard",
        icon: Tv,
      },
      {
        label: "Seasons & Imports",
        path: "/operations",
        icon: DatabaseBackup,
      },
      {
        label: "Settings",
        path: "/settings",
        icon: Settings,
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