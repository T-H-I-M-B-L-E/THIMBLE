"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useStore, type UserRole } from "@/lib/store"
import { useTheme } from "@/lib/theme-context"
import { User, Palette, Factory, Camera, Building2, Sun, Moon } from "lucide-react"

const roles: { id: UserRole; label: string; description: string; icon: React.ElementType }[] = [
  {
    id: "model",
    label: "Model",
    description: "Showcase your portfolio and find gigs",
    icon: User,
  },
  {
    id: "designer",
    label: "Designer",
    description: "Share designs and find manufacturers",
    icon: Palette,
  },
  {
    id: "manufacturer",
    label: "Manufacturer",
    description: "Offer production services",
    icon: Factory,
  },
  {
    id: "photographer",
    label: "Photographer",
    description: "Share your work and find shoots",
    icon: Camera,
  },
  {
    id: "brand",
    label: "Brand",
    description: "Post campaigns and discover talent",
    icon: Building2,
  },
]

export default function RoleSelectPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const { setRole } = useStore()
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isDark = theme === "dark"

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle redirects in useEffect to avoid setState during render
  useEffect(() => {
    if (!isLoaded) return

    // If not signed in with Clerk, redirect to auth
    if (!user) {
      router.push("/auth")
      return
    }

    // If role already set in Clerk metadata, redirect to dashboard
    const clerkRole = user.publicMetadata?.role as string | undefined
    if (clerkRole) {
      router.push(`/dashboard/${clerkRole}`)
    }
  }, [isLoaded, user, router])

  const handleSelectRole = async (role: UserRole) => {
    if (!user) return

    try {
      // Update Clerk user metadata with role
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          role: role,
        },
      })

      // Also update local store for UI state
      setRole(role)

      // Redirect to dashboard
      router.push(`/dashboard/${role}`)
    } catch (error) {
      console.error("Failed to update role:", error)
      // Still redirect even if metadata update fails
      setRole(role)
      router.push(`/dashboard/${role}`)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-black">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative bg-neutral-100 dark:bg-neutral-950 overflow-hidden">
        <div className="absolute top-6 right-6">
          <button
            onClick={toggleTheme}
            className="p-2 text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
        <div className="relative z-10 flex flex-col justify-center px-8 xl:px-16 2xl:px-32 w-full">
          <div className="space-y-6 xl:space-y-8 max-w-xl">
            <h1 className="text-5xl xl:text-6xl 2xl:text-7xl font-light text-black dark:text-white tracking-[0.2em] whitespace-nowrap">
              THIMBLE
            </h1>
            <div className="w-16 xl:w-24 h-px bg-black dark:bg-white" />
            <p className="text-base xl:text-lg 2xl:text-xl text-neutral-600 dark:text-neutral-400 leading-relaxed font-light">
              Choose your role to get started. You can always change this later.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Role Selection */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-12 bg-white dark:bg-black min-h-screen lg:min-h-0">
        <div className="w-full max-w-sm sm:max-w-md space-y-6 sm:space-y-8">
          <div className="lg:hidden text-center flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-light text-black dark:text-white tracking-[0.2em]">THIMBLE</h1>
            <button
              onClick={toggleTheme}
              className="p-2 text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>

          <div className="text-center space-y-2 sm:space-y-3">
            <h2 className="text-xl sm:text-2xl font-light text-black dark:text-white">Select your role</h2>
            <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400">
              How will you use THIMBLE?
            </p>
          </div>

          <div className="space-y-3">
            {roles.map((role) => {
              const Icon = role.icon
              return (
                <button
                  key={role.id}
                  onClick={() => handleSelectRole(role.id)}
                  className="w-full flex items-center gap-4 p-4 border border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all text-left group"
                >
                  <div className="w-12 h-12 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 group-hover:bg-black dark:group-hover:bg-white transition-colors">
                    <Icon className="h-6 w-6 text-neutral-600 dark:text-neutral-400 group-hover:text-white dark:group-hover:text-black transition-colors" />
                  </div>
                  <div>
                    <p className="font-medium text-black dark:text-white">{role.label}</p>
                    <p className="text-sm text-neutral-500">{role.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
