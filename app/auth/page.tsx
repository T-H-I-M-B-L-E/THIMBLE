"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Sun, Moon } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(prefersDark)
    if (prefersDark) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const success = login(formData.email, formData.password)
    if (success) {
      router.push("/auth/role-select")
    } else {
      setError("Invalid credentials")
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
            <h2 className="text-xl sm:text-2xl font-light text-black dark:text-white">Welcome back</h2>
            <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400">Sign in to continue</p>
          </div>

          {error && (
            <div className="rounded-none border border-black dark:border-white p-3 sm:p-4 text-sm text-black dark:text-white bg-transparent">
              {error}
            </div>
          )}

          <div className="border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
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
                disabled={isLoading}
                className="w-full h-10 sm:h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs sm:text-sm"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>

          <p className="text-xs text-center text-neutral-400">
            Don't have an account?{" "}
            <a href="/auth/signup" className="text-neutral-600 hover:text-black">Create account</a>
          </p>
        </div>
      </div>
    </div>
  )
}
