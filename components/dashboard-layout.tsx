"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useClerk } from "@clerk/nextjs"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { VerificationModal } from "./verification-modal"
import { VerificationBanner } from "./verification-banner"
import { 
  Home, 
  Briefcase, 
  User, 
  MessageSquare, 
  LogOut, 
  Shield,
  Menu,
  X,
  Newspaper
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
  const { signOut } = useClerk()
  const { user, logout } = useStore()
  const [showVerification, setShowVerification] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    logout() // Clear local store
    await signOut() // Clear Clerk session
    router.push("/auth")
  }

  const navItems = [
    { href: `/dashboard/${role}`, icon: Home, label: "Dashboard" },
    { href: `/dashboard/${role}/feed`, icon: Newspaper, label: "Feed" },
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
            <div className="relative w-10 h-10 rounded-full overflow-hidden">
              <Image
                src={user?.avatar || "/placeholder-avatar.png"}
                alt={user?.fullName || "User"}
                fill
                className="object-cover"
              />
            </div>
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="text-lg font-light tracking-[0.2em]">
            THIMBLE
          </Link>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 text-neutral-600 dark:text-neutral-300"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

      {/* Mobile Menu Overlay */}
      <div className={cn(
        "fixed inset-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md transition-all duration-300 lg:hidden",
        mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        <div className={cn(
          "fixed inset-y-0 left-0 w-full max-w-xs bg-white dark:bg-black border-r border-neutral-200 dark:border-neutral-800 p-6 flex flex-col transition-transform duration-300 overflow-y-auto",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="text-xl font-light tracking-[0.2em]">
              THIMBLE
            </Link>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 text-neutral-600 dark:text-neutral-300"
              aria-label="Close Menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-8 p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
            <div className="relative w-12 h-12 rounded-full overflow-hidden">
              <Image
                src={user?.avatar || "/placeholder-avatar.png"}
                alt={user?.fullName || "User"}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <p className="font-medium text-black dark:text-white">{user?.fullName}</p>
              <p className="text-xs text-neutral-500 capitalize">{role}</p>
            </div>
          </div>
          
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 min-h-[44px] text-sm transition-colors",
                  pathname === item.href
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 space-y-4 pt-6 border-t border-neutral-200 dark:border-neutral-800">
            {user?.verificationStatus !== "verified" && (
              <Button
                onClick={() => {
                  setShowVerification(true)
                  setMobileMenuOpen(false)
                }}
                variant="outline"
                className="w-full rounded-none min-h-[44px]"
              >
                <Shield className="h-4 w-4 mr-2" />
                Get Verified
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-4 text-neutral-600 hover:text-red-500 min-h-[44px]"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>
      </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-[72px] lg:pt-0 animate-fade-in w-full overflow-x-hidden">
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
          <VerificationBanner />
          {children}
        </div>
      </main>

      {/* Verification Modal */}
      <VerificationModal isOpen={showVerification} onClose={() => setShowVerification(false)} />
    </div>
  )
}

