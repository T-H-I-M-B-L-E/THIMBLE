"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSignIn, useUser } from "@clerk/nextjs"
import { useStore } from "@/lib/store"
import { useTheme } from "@/lib/theme-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Sun, Moon } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const signInObj = useSignIn()
  const { user, isLoaded: isUserLoaded } = useUser()
  const { setRole } = useStore()
  const { theme, toggleTheme } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const isDark = theme === "dark"

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  // Handle redirect in useEffect to avoid setState during render
  useEffect(() => {
    if (!isUserLoaded) return

    // If already signed in with Clerk, check for role
    if (user) {
      const role = user.publicMetadata?.role as string | undefined
      if (role) {
        router.push(`/dashboard/${role}`)
      } else {
        router.push("/auth/role-select")
      }
    }
  }, [user, isUserLoaded, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    setIsLoading(true)

    const signIn = (signInObj as any)?.signIn
    const setActive = (signInObj as any)?.setActive

    if (!signIn || !setActive) {
      setError("Authentication not ready. Please try again.")
      setIsLoading(false)
      return
    }

    try {
      const result = await signIn.create({
        identifier: formData.email,
        password: formData.password,
      })

      // Handle result which might be an error object
      if ('error' in result && result.error) {
        throw result.error
      }

      // Type assertion for successful result
      const successResult = result as any

      if (successResult.status === "complete") {
        await setActive({ session: successResult.createdSessionId })

        // Check if user has role in metadata
        const userRole = successResult.userData?.publicMetadata?.role as string | undefined
        if (userRole) {
          setRole(userRole as any)
          router.push(`/dashboard/${userRole}`)
        } else {
          router.push("/auth/role-select")
        }
      } else {
        setError("Sign in failed. Please check your credentials.")
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || "Invalid credentials")
    }
    setIsLoading(false)
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
              A curated space for fashion designers, photographers, and creatives to showcase their work.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-start lg:items-center justify-center px-4 sm:px-6 lg:px-8 xl:px-12 py-6 sm:py-8 lg:py-0 bg-white dark:bg-black min-h-screen lg:min-h-0">
        <div className="w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6 lg:space-y-8">
          <div className="lg:hidden flex items-center justify-between mb-2">
            <h1 className="text-lg sm:text-xl font-light text-black dark:text-white tracking-[0.2em]">THIMBLE</h1>
            <button
              onClick={toggleTheme}
              className="p-2 text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
          </div>

          <div className="text-center space-y-1 sm:space-y-2">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-light text-black dark:text-white">Welcome back</h2>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">Sign in to continue</p>
          </div>

          {error && (
            <div className="rounded-none border border-black dark:border-white p-3 sm:p-4 text-sm text-black dark:text-white bg-transparent">
              {error}
            </div>
          )}

          <div className="border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 lg:space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-10 sm:h-12 rounded-none border-neutral-300 bg-transparent text-black dark:text-white placeholder:text-neutral-400 focus:border-black focus:ring-0"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    Password
                  </Label>
                  <button type="button" className="text-xs text-neutral-500 hover:text-black transition-colors">
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-10 sm:h-12 rounded-none border-neutral-300 bg-transparent pr-11 text-black dark:text-white placeholder:text-neutral-400 focus:border-black focus:ring-0"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !(signInObj as any)?.isLoaded}
                className="w-full h-11 sm:h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs sm:text-sm mt-2 sm:mt-0"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>

          <p className="text-xs text-center text-neutral-400 pb-4 sm:pb-0">
            Don&apos;t have an account?{" "}
            <a href="/auth/signup" className="text-neutral-600 hover:text-black dark:hover:text-white transition-colors">Create account</a>
          </p>
        </div>
      </div>
    </div>
  )
}
