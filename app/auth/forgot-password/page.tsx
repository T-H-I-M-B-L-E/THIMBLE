"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "@/lib/theme-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Sun, Moon, ArrowLeft, X, CheckCircle } from "lucide-react"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"request" | "verify" | "reset">("request")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const isDark = theme === "dark"

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        // Generic message to prevent email enumeration
        setStep("verify")
        setSuccessMessage("If an account exists, a reset code has been sent to your email.")
        return
      }

      setStep("verify")
      setSuccessMessage("If an account exists, a reset code has been sent to your email.")
    } catch (err: any) {
      console.error("Forgot password error:", err)
      // Generic message for security
      setStep("verify")
      setSuccessMessage("If an account exists, a reset code has been sent to your email.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length < 6) return

    setError("")
    setStep("reset")
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError("Password must be 8+ characters with uppercase, lowercase, and number.")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword: password,
        }),
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Password reset failed")
        return
      }

      // Success - redirect to login
      router.push("/auth?reset=success")
    } catch (err: any) {
      console.error("Reset password error:", err)
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
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
              A curated space for fashion designers, photographers, and creatives to showcase their work.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Reset Form */}
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
            <h2 className="text-lg sm:text-xl lg:text-2xl font-light text-black dark:text-white">
              {step === "request"
                ? "Reset password"
                : step === "verify"
                ? "Verify code"
                : "New password"}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              {step === "request"
                ? "Enter your email to receive a reset code"
                : step === "verify"
                ? "Check your email for the verification code"
                : "Enter your new password"}
            </p>
          </div>

          <div className="border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 lg:p-8">
            {step === "request" ? (
              <form onSubmit={handleRequestCode} className="space-y-3 sm:space-y-4 lg:space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 sm:h-12 rounded-none border-neutral-300 bg-transparent text-black dark:text-white placeholder:text-neutral-400 focus:border-black focus:ring-0"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-none border border-red-500 p-3 sm:p-4 text-sm text-red-600 dark:text-red-400 bg-transparent">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 sm:h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs sm:text-sm mt-2 sm:mt-0"
                >
                  {isLoading ? "Sending..." : "Send reset code"}
                </Button>
              </form>
            ) : step === "verify" ? (
              <form onSubmit={handleVerifyCode} className="space-y-4 sm:space-y-6">
                {successMessage && (
                  <div className="rounded-none border border-green-500 p-3 sm:p-4 text-sm text-green-600 dark:text-green-400 bg-transparent flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    Verification Code
                  </Label>
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    disabled={isLoading}
                  >
                    <InputOTPGroup className="flex justify-between gap-2">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-none border border-neutral-300 dark:border-neutral-700 text-center text-lg font-semibold"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && (
                  <div className="rounded-none border border-red-500 p-3 sm:p-4 text-sm text-red-600 dark:text-red-400 bg-transparent">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || code.length < 6}
                  className="w-full h-11 sm:h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs sm:text-sm"
                >
                  {isLoading ? "Verifying..." : "Verify code"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("request")
                    setCode("")
                    setEmail("")
                    setSuccessMessage("")
                  }}
                  className="w-full h-10 sm:h-11 rounded-none border-neutral-300 dark:border-neutral-700 text-black dark:text-white font-normal uppercase tracking-widest text-xs sm:text-sm"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3 sm:space-y-4 lg:space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 chars, uppercase, number"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 sm:h-12 rounded-none border-neutral-300 bg-transparent pr-11 text-black dark:text-white placeholder:text-neutral-400 focus:border-black focus:ring-0"
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

                {error && (
                  <div className="rounded-none border border-red-500 p-3 sm:p-4 text-sm text-red-600 dark:text-red-400 bg-transparent">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 sm:h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs sm:text-sm"
                >
                  {isLoading ? "Resetting..." : "Reset password"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("verify")
                    setPassword("")
                  }}
                  className="w-full h-10 sm:h-11 rounded-none border-neutral-300 dark:border-neutral-700 text-black dark:text-white font-normal uppercase tracking-widest text-xs sm:text-sm"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </form>
            )}
          </div>

          <p className="text-xs text-center text-neutral-400 pb-4 sm:pb-0">
            Remember your password?{" "}
            <a href="/auth" className="text-neutral-600 hover:text-black dark:hover:text-white transition-colors">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
