"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { VerificationModal } from "./verification-modal"
import { 
  Home, 
  Briefcase, 
  User, 
  MessageSquare, 
  LogOut, 
  Shield,
  Menu,
  X
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: React.ReactNode
  role: string
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useStore()
  const [showVerification, setShowVerification] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push("/auth")
  }

  const navItems = [
    { href: `/dashboard/${role}`, icon: Home, label: "Dashboard" },
    { href: `/dashboard/${role}/gigs`, icon: Briefcase, label: "Gigs" },
    { href: `/dashboard/${role}/messages`, icon: MessageSquare, label: "Messages" },
    { href: `/dashboard/${role}/profile`, icon: User, label: "Profile" },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-black flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black fixed left-0 top-0 h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <Link href="/" className="text-xl font-light tracking-[0.2em] text-black dark:text-white">
            THIMBLE
          </Link>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <img
              src={user?.avatar}
              alt={user?.fullName}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-black dark:text-white">
                {user?.fullName}
              </p>
              <p className="text-xs text-neutral-500 capitalize">{role}</p>
            </div>
          </div>
          
          {/* Verification Status */}
          <div className="mt-3 flex items-center gap-2">
            {user?.verificationStatus === "verified" ? (
              <Badge variant="verified">Verified</Badge>
            ) : user?.verificationStatus === "pending" ? (
              <Badge variant="secondary">Pending</Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVerification(true)}
                className="text-xs rounded-none"
              >
                <Shield className="h-3 w-3 mr-1" />
                Get Verified
              </Button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-neutral-600 hover:text-black"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-black border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="text-lg font-light tracking-[0.2em]">
            THIMBLE
          </Link>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={user?.avatar}
                alt={user?.fullName}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <p className="font-medium">{user?.fullName}</p>
                <p className="text-xs text-neutral-500 capitalize">{role}</p>
              </div>
            </div>
            
            {user?.verificationStatus !== "verified" && (
              <Button
                onClick={() => {
                  setShowVerification(true)
                  setMobileMenuOpen(false)
                }}
                variant="outline"
                size="sm"
                className="w-full rounded-none"
              >
                <Shield className="h-4 w-4 mr-2" />
                Get Verified
              </Button>
            )}

            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm",
                    pathname === item.href
                      ? "bg-neutral-100 dark:bg-neutral-900"
                      : "text-neutral-600"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-3"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
          {children}
        </div>
      </main>

      {/* Verification Modal */}
      <VerificationModal isOpen={showVerification} onClose={() => setShowVerification(false)} />
    </div>
  )
}
