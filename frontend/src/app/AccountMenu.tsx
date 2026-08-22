import { useEffect, useRef, useState } from "react"
import { ChevronDown, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/features/auth/useAuth"

function userDisplayName(
  email: string | undefined,
  metadata: Record<string, unknown> | undefined,
) {
  const fullName =
    typeof metadata?.full_name === "string"
      ? metadata.full_name.trim()
      : ""

  const name =
    typeof metadata?.name === "string"
      ? metadata.name.trim()
      : ""

  if (fullName) return fullName
  if (name) return name
  if (email) return email

  return "User"
}

function userInitials(name: string) {
  const parts = name
    .replace(/@.*$/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  return parts[0]?.slice(0, 2).toUpperCase() || "U"
}

export function AccountMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = userDisplayName(
    user?.email,
    user?.user_metadata as Record<string, unknown> | undefined,
  )

  const initials = userInitials(displayName)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
    }
  }, [])

  async function handleSignOut() {
    if (signingOut) return

    setSigningOut(true)

    try {
      await signOut()
      setMenuOpen(false)
      navigate("/login", { replace: true })
    } catch (error) {
      console.error("Unable to sign out:", error)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
          {initials}
        </div>

        <span className="hidden max-w-48 truncate text-sm font-semibold text-slate-800 sm:block">
          {displayName}
        </span>

        <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">
              {displayName}
            </p>

            {user?.email && displayName !== user.email ? (
              <p className="mt-1 truncate text-xs text-slate-500">
                {user.email}
              </p>
            ) : null}
          </div>

          <div className="p-1">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
