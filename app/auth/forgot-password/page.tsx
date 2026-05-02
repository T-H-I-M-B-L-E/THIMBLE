"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useClerk, useSignIn } from "@clerk/nextjs"
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
  const clerk = useClerk()
  const signInState = useSignIn() as any
  const isLoaded = signInState.isLoaded?.value ?? signInState.isLoaded ?? !!signInState.signIn
  const signIn = signInState.signIn?.value ?? signInState.signIn ?? signInState
  const { theme, toggleTheme } = useTheme()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"request" | "verify">("request")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const isDark = theme === "dark"

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return
    setError("")
    setIsLoading(true)

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email.trim(),
      })
      
      setStep("verify")
      setSuccessMessage("If an account exists, a reset code has been sent to your email.")
    } catch (err: any) {
      console.error("Forgot password error:", err)
      // Generic success message to prevent email enumeration attacks
      const errCode = err.errors?.[0]?.code
      if (errCode === "form_identifier_not_found") {
        setStep("verify")
        setSuccessMessage("If an account exists, a reset code has been sent to your email.")
      } else {
        setError(err.errors?.[0]?.message || "Something went wrong.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return

    // Strict password validation before API call
    if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/-])/.test(password)) {
      setError("Password must be 8+ characters and contain uppercase, lowercase, number, and special character.")
      return
    }

    setError("")
    setIsLoading(true)

    try {
      let result
      const futureResetFlow =
        signIn?.resetPasswordEmailCode ||
        signInState?.resetPasswordEmailCode

      if (futureResetFlow?.verifyCode && futureResetFlow?.submitPassword) {
        const verifyResult = await futureResetFlow.verifyCode({
          code: code.trim(),
        })

        if (verifyResult?.error) {
          throw verifyResult.error
        }

        const submitResult = await futureResetFlow.submitPassword({
          password,
        })

        if (submitResult?.error) {
          throw submitResult.error
        }

        result = signInState.signIn?.value ?? signInState.signIn ?? signIn
      } else if (signIn?.attemptFirstFactor || signInState?.attemptFirstFactor) {
        const attemptMethod =
          signIn?.attemptFirstFactor ||
          signInState?.attemptFirstFactor

        result = await attemptMethod.bind(signIn || signInState)({
          strategy: "reset_password_email_code",
          code: code.trim(),
          password,
        })
      } else if (signIn?.resetPassword || signInState?.resetPassword) {
        const resetMethod =
          signIn?.resetPassword ||
          signInState?.resetPassword

        result = await resetMethod.bind(signIn || signInState)({
          password,
        })
      } else {
        console.error("Reset methods missing. Available keys on signIn:", Object.keys(signIn || {}))
        console.error("Available keys on signInState:", Object.keys(signInState || {}))
        throw new Error("Password reset is not available in the current authentication state. Refresh and request a new code.")
      }

      if (result.status === "complete") {
        try {
          await clerk.signOut()
        } catch (signOutError) {
          console.warn("Post-reset sign out skipped:", signOutError)
        }
        router.push("/auth")
      } else {
        setError("Password reset did not complete. Request a new code and try again.")
      }
    } catch (err: any) {
      console.error("Reset password error:", err)
      const errCode = err.errors?.[0]?.code
      if (errCode === "form_code_incorrect") {
        setError("The reset code is incorrect. Check the email and try again.")
      } else if (errCode === "verification_expired") {
        setError("This reset code has expired. Request a new one.")
      } else if (errCode === "client_state_invalid") {
        setError("Your reset session expired. Request a new code to continue.")
        setStep("request")
      } else {
        setError(err.errors?.[0]?.message || "Invalid code or password.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const getPasswordStrength = () => {
    if (!password) return 0
    let strength = 0
    if (password.length >= 8) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength()

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

      {/* Right Side - Form */}
      <div className="flex-1 flex items-start lg:items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-0">
        <div className="w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6 lg:space-y-8">
          <div className="lg:hidden flex items-center justify-between mb-2">
            <h1 className="text-lg sm:text-xl font-light text-black dark:text-white tracking-[0.2em]">THIMBLE</h1>
            <button
              onClick={toggleTheme}
              className="p-2 text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl lg:text-2xl font-light text-black dark:text-white">Reset Password</h2>
            <p className="text-sm text-neutral-500">
              {step === "request" ? "Enter your email to receive a reset code." : "Enter the code and your new password."}
            </p>
          </div>

          {error && (
            <div className="rounded-none border border-red-500/50 bg-red-50/50 dark:bg-red-950/20 p-3 sm:p-4 text-xs sm:text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
              <X className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {successMessage && step === "verify" && !error && (
            <div className="rounded-none border border-green-500/50 bg-green-50/50 dark:bg-green-950/20 p-3 sm:p-4 text-xs sm:text-sm text-green-600 dark:text-green-400 flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{successMessage}</p>
            </div>
          )}

          <div className="border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 lg:p-8">
            {step === "request" ? (
              <form onSubmit={handleRequestCode} className="space-y-5">
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
                    className="h-12 rounded-none border-neutral-300 bg-transparent focus:border-black focus:ring-0"
                    required
                  />
                </div>
                
                <div className="pt-2 flex flex-col gap-3">
                  <Button
                    type="submit"
                    disabled={isLoading || !isLoaded}
                    className="w-full h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs"
                  >
                    {isLoading ? "Sending..." : "Send Reset Code"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/auth")}
                    className="w-full h-12 rounded-none font-normal uppercase tracking-widest text-xs"
                  >
                    Back to Login
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-2 text-center">
                  <Label className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    Verification Code
                  </Label>
                </div>

                <div className="flex justify-center py-2">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(val) => setCode(val)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 rounded-none border-neutral-300 bg-transparent pr-11 focus:border-black focus:ring-0"
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

                  {password && (
                    <div className="space-y-1 mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 ${
                              passwordStrength >= level
                                ? passwordStrength === 4
                                  ? "bg-green-500"
                                  : passwordStrength === 3
                                  ? "bg-yellow-500"
                                  : passwordStrength === 2
                                  ? "bg-orange-500"
                                  : "bg-red-500"
                                : "bg-neutral-200 dark:bg-neutral-800"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wider">
                        {passwordStrength === 4
                          ? "Strong password"
                          : passwordStrength === 3
                          ? "Good password"
                          : passwordStrength === 2
                          ? "Fair password"
                          : "Weak password"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  <Button
                    type="submit"
                    disabled={isLoading || code.length < 6 || passwordStrength < 4}
                    className="w-full h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs"
                  >
                    {isLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("request")}
                    className="w-full h-12 rounded-none font-normal uppercase tracking-widest text-xs text-neutral-500 hover:text-black"
                  >
                    <ArrowLeft className="h-3 w-3 mr-2" /> Use a different email
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
