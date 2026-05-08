"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/useAuth"
import { useStore } from "@/lib/store"
import { useTheme } from "@/lib/theme-context"
import { getPostAuthPath } from "@/lib/platform"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, X, Sun, Moon, ArrowLeft } from "lucide-react"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

interface FormErrors {
  fullName?: string
  email?: string
  password?: string
}

export default function SignupPage() {
  const router = useRouter()
  const { user, isLoading: isAuthLoading } = useAuth()
  const { signup } = useStore()
  const { theme, toggleTheme } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [verifying, setVerifying] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [tempEmail, setTempEmail] = useState("")
  const isDark = theme === "dark"

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  })

  // Handle redirect if already signed in
  useEffect(() => {
    if (!isAuthLoading && user) {
      router.push(getPostAuthPath(user))
    }
  }, [user, isAuthLoading, router])

  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case "fullName":
        if (!value.trim()) return "Full name is required"
        if (value.trim().length < 2) return "Name must be at least 2 characters"
        return undefined
      case "email":
        if (!value.trim()) return "Email is required"
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Please enter a valid email"
        return undefined
      case "password":
        if (!value) return "Password is required"
        if (value.length < 8) return "Password must be at least 8 characters"
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return "Password must contain uppercase, lowercase, and number"
        }
        return undefined
      default:
        return undefined
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key as keyof typeof formData])
      if (error) newErrors[key as keyof FormErrors] = error
    })
    setErrors(newErrors)
    setTouched({ fullName: true, email: true, password: true })
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
        }),
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        setErrors((prev) => ({ ...prev, email: data.error || "Signup failed" }))
        return
      }

      // Store email temporarily for verification step
      setTempEmail(formData.email)
      setVerifying(true)
      setVerificationCode("")
      setErrors({})
    } catch (err: any) {
      console.error("Signup error:", err)
      setErrors((prev) => ({
        ...prev,
        email: err.message || "An error occurred during signup",
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()

    if (verificationCode.length < 6) return

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: tempEmail,
          code: verificationCode,
          password: formData.password,
          fullName: formData.fullName,
        }),
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        setErrors((prev) => ({
          ...prev,
          email: data.error || "Verification failed",
        }))
        return
      }

      // User verified and logged in
      signup({ ...formData, phone: '' })
      router.push("/onboarding")
    } catch (err: any) {
      console.error("Verification error:", err)
      setErrors((prev) => ({
        ...prev,
        email: err.message || "Verification failed",
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const getPasswordStrength = () => {
    const { password } = formData
    if (!password) return 0
    let strength = 0
    if (password.length >= 8) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
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

      {/* Right Side - Signup Form */}
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
              {verifying ? "Verify email" : "Create account"}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              {verifying ? "We sent a verification code to your email" : "Join our creative community"}
            </p>
          </div>

          <div className="border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 lg:p-8">
            {!verifying ? (
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 lg:space-y-5">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Elena Moreau"
                    value={formData.fullName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`h-10 sm:h-12 rounded-none bg-transparent text-black dark:text-white placeholder:text-neutral-400 focus:ring-0 ${
                      errors.fullName && touched.fullName
                        ? "border-red-500 focus:border-red-500"
                        : "border-neutral-300 focus:border-black"
                    }`}
                  />
                  {errors.fullName && touched.fullName && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {errors.fullName}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`h-10 sm:h-12 rounded-none bg-transparent text-black dark:text-white placeholder:text-neutral-400 focus:ring-0 ${
                      errors.email && touched.email
                        ? "border-red-500 focus:border-red-500"
                        : "border-neutral-300 focus:border-black"
                    }`}
                  />
                  {errors.email && touched.email && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 chars, uppercase, number"
                      value={formData.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`h-10 sm:h-12 rounded-none bg-transparent pr-11 text-black dark:text-white placeholder:text-neutral-400 focus:ring-0 ${
                        errors.password && touched.password
                          ? "border-red-500 focus:border-red-500"
                          : "border-neutral-300 focus:border-black"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && touched.password && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {errors.password}
                    </p>
                  )}
                  {formData.password && (
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${
                            i < passwordStrength ? "bg-black dark:bg-white" : "bg-neutral-200 dark:bg-neutral-800"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 sm:h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs sm:text-sm"
                >
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4 sm:space-y-6">
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Check your email for the verification code. It expires in 10 minutes.
                  </p>

                  <div className="space-y-2">
                    <Label className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                      Verification Code
                    </Label>
                    <InputOTP
                      maxLength={6}
                      value={verificationCode}
                      onChange={setVerificationCode}
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

                  {errors.email && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {errors.email}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || verificationCode.length < 6}
                  className="w-full h-11 sm:h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs sm:text-sm"
                >
                  {isLoading ? "Verifying..." : "Verify email"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setVerifying(false)
                    setVerificationCode("")
                    setErrors({})
                  }}
                  className="w-full h-10 sm:h-11 rounded-none border-neutral-300 dark:border-neutral-700 text-black dark:text-white font-normal uppercase tracking-widest text-xs sm:text-sm"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </form>
            )}
          </div>

          {!verifying && (
            <p className="text-xs text-center text-neutral-400 pb-4 sm:pb-0">
              Already have an account?{" "}
              <a href="/auth" className="text-neutral-600 hover:text-black dark:hover:text-white transition-colors">
                Sign in
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
