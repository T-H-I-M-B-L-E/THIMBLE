"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useClerk, useSignUp, useUser } from "@clerk/nextjs"
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
  username?: string
  email?: string
  phone?: string
  password?: string
}

export default function SignupPage() {
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)
  const clerk = useClerk()
  const signUpState = useSignUp() as any
  const isSignUpLoaded = signUpState.isLoaded || (isMounted && !!signUpState.signUp)
  const signUp = signUpState.signUp
  const setActive = (clerk as any).setActive
  const { user, isLoaded: isUserLoaded } = useUser()
  const { signup } = useStore()
  const { theme, toggleTheme } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [verifying, setVerifying] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)
  const isDark = theme === "dark"

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
  })

  // Handle redirect if already signed in (skip for local network)
  useEffect(() => {
    if (!isUserLoaded) return
    if (user) {
      router.push(getPostAuthPath(user))
    }
  }, [user, isUserLoaded, router])

  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case "fullName":
        if (!value.trim()) return "Full name is required"
        if (value.trim().length < 2) return "Name must be at least 2 characters"
        return undefined
      case "username":
        if (!value.trim()) return "Username is required"
        if (value.trim().length < 3) return "Username must be at least 3 characters"
        if (!/^[a-zA-Z0-9_]+$/.test(value)) return "Only letters, numbers, and underscores allowed"
        return undefined
      case "email":
        if (!value.trim()) return "Email is required"
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Please enter a valid email"
        return undefined
      case "phone":
        if (!value.trim()) return "Phone number is required"
        if (!/^\+?[\d\s\-\(\)]{10,}$/.test(value.replace(/\s/g, ""))) return "Please enter a valid phone number"
        return undefined
      case "password":
        if (!value) return "Password is required"
        if (value.length < 8) return "Password must be at least 8 characters"
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/-])/.test(value)) {
          return "Password must contain uppercase, lowercase, number, and special character"
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
    setTouched({ fullName: true, email: true, phone: true, password: true })
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      console.log("Form validation failed")
      return
    }

    // Check if signUp is available
    if (!isSignUpLoaded || !signUp) {
      console.error("Clerk initialization state:", {
        isSignUpLoaded,
        signUpExists: !!signUp,
        setActiveExists: !!setActive,
      })
      setErrors((prev) => ({
        ...prev,
        email: !isSignUpLoaded 
          ? "Authentication service is still loading. Please wait a moment." 
          : "Authentication system is unavailable. Please refresh the page.",
      }))
      return
    }

    setIsLoading(true)

    try {
      // Clerk v7 (signal-based): `create()` updates the signup object.
      await signUp.create({
        emailAddress: formData.email,
        username: formData.username,
        password: formData.password,
        firstName: formData.fullName.split(' ')[0],
        lastName: formData.fullName.split(' ').slice(1).join(' ') || '',
        unsafeMetadata: {
          phone: formData.phone,
          fullName: formData.fullName,
        },
      })

      console.log("Clerk signUp after create:", {
        status: signUp.status,
        createdSessionId: signUp.createdSessionId,
        unverifiedFields: (signUp as any)?.unverifiedFields,
        missingFields: (signUp as any)?.missingFields,
        verifications: !!signUp?.verifications,
      })

      if (signUp.status === "complete") {
        if (setActive && signUp.createdSessionId) {
          await setActive({ session: signUp.createdSessionId })
        }
        signup(formData)
        router.push("/onboarding")
      } else if (signUp.status === "missing_requirements") {
        // If there are unverified fields (like email), start verification
        const unverified = (signUp as any).unverifiedFields || []
        const missing = (signUp as any).missingFields || []
        
        console.log("Signup missing requirements:", { unverified, missing })

        if (unverified.includes("email_address")) {
          try {
            console.log("Preparing email verification...")
            if ((signUp as any).prepareVerification) {
              await (signUp as any).prepareVerification({ strategy: "email_code" })
            } else if ((signUp as any).prepareEmailAddressVerification) {
              await (signUp as any).prepareEmailAddressVerification({ strategy: "email_code" })
            }
            setVerifying(true)
          } catch (verifErr: any) {
            console.error("Verification prep error:", verifErr)
            setErrors((prev) => ({
              ...prev,
              email: verifErr.message || "Failed to start email verification.",
            }))
          }
        } else if (missing.length > 0) {
          // If email is not unverified but other fields are missing
          setErrors((prev) => ({
            ...prev,
            email: `Signup paused. Missing: ${missing.join(", ")}. Please check your form or Clerk settings.`,
          }))
        } else {
          setVerifying(true) // Fallback to verification screen if status is missing_requirements
        }
      } else {
        setErrors((prev) => ({
          ...prev,
          email: "Sign up resulted in status: " + signUp.status,
        }))
      }
    } catch (err: any) {
      console.error("Signup error:", err)
      const errCode = err.errors?.[0]?.code
      if (errCode === "form_identifier_exists") {
        setErrors((prev) => ({ 
          ...prev, 
          email: "This email is already registered. Please sign in instead." 
        }))
        setTimeout(() => router.push("/auth"), 3000)
      } else {
        const errorMessage = err.errors?.[0]?.message || err.message || "Sign up failed."
        setErrors((prev) => ({ ...prev, email: errorMessage }))
      }
    }
    setIsLoading(false)
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (verificationCode.length < 6) return

    console.log("Submitting verification code:", verificationCode)
    
    if (!signUp) {
      console.error("SignUp object not available")
      setErrors((prev) => ({ ...prev, email: "Authentication state lost. Please try again." }))
      return
    }

    setIsLoading(true)
    try {
      let result
      // Try multiple possible locations for the verification method (Clerk v7 vs v6 compatibility)
      const attemptMethod = (signUp as any)?.attemptVerification || (signUpState as any)?.attemptVerification || (signUp as any)?.attemptEmailAddressVerification || (signUpState as any)?.attemptEmailAddressVerification

      if (attemptMethod) {
        // Determine if we need to pass strategy (v7) or just code (v6)
        if ((signUp as any).attemptVerification || (signUpState as any).attemptVerification) {
          result = await (attemptMethod.bind(signUp || signUpState))({
            strategy: "email_code",
            code: verificationCode,
          })
        } else {
          result = await (attemptMethod.bind(signUp || signUpState))({
            code: verificationCode,
          })
        }
      } else {
        console.error("Clerk Methods missing. Available keys on signUp:", Object.keys(signUp || {}))
        console.error("Available keys on signUpState:", Object.keys(signUpState || {}))
        throw new Error("Verification system not initialized. Please refresh.")
      }

      console.log("Verification successful, result:", {
        status: result.status,
        unverified: result.unverifiedFields,
        missing: result.missingFields,
        sessionId: result.createdSessionId,
      })

      if (result.status === "complete") {
        if (setActive && result.createdSessionId) {
          await setActive({ session: result.createdSessionId })
        }
        signup(formData)
        router.push("/onboarding")
      } else {
        // If still missing requirements (like username or phone), report them
        const missing = [...(result.unverifiedFields || []), ...(result.missingFields || [])]
        console.log("Signup still incomplete, missing:", missing)
        
        // AUTO-FIX: If username is missing, try to update it automatically
        if (missing.includes("username") && formData.username) {
          try {
            console.log("Attempting to auto-set missing username...")
            await signUp.update({ username: formData.username })
          } catch (e) {
            console.error("Auto-set username failed:", e)
          }
        }

        setErrors((prev) => ({
          ...prev,
          email: `Incomplete. Still needs: ${missing.join(", ") || result.status}`,
        }))
      }
    } catch (err: any) {
      console.error("Verification error:", err)
      
      // Handle the case where it's already verified
      const isAlreadyVerified = 
        err.message?.includes("already been verified") || 
        err.errors?.[0]?.code === "already_verified" ||
        err.errors?.[0]?.message?.includes("already been verified")

      if (isAlreadyVerified) {
        console.log("Already verified, checking current status...")
        // If already verified, check the current status of the signUp object
        if (signUp.status === "complete" && setActive && signUp.createdSessionId) {
          await setActive({ session: signUp.createdSessionId })
          signup(formData)
          router.push("/onboarding")
          return
        }
      }

      const errorMessage = err.errors?.[0]?.message || err.message || "Verification failed"
      setErrors((prev) => ({ ...prev, email: errorMessage }))
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

      {/* Right Side - Signup Form */}
      <div className="flex-1 flex items-start lg:items-center justify-center px-4 sm:px-6 lg:px-8 xl:px-12 py-6 sm:py-8 lg:py-0 bg-white dark:bg-black min-h-screen lg:min-h-0">
        <div className="w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in">
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
            <h2 className="text-lg sm:text-xl lg:text-2xl font-light text-black dark:text-white">Create account</h2>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">Join our creative community</p>
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

                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    Username
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="elenamoreau"
                    value={formData.username}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`h-10 sm:h-12 rounded-none bg-transparent text-black dark:text-white placeholder:text-neutral-400 focus:ring-0 ${
                      errors.username && touched.username
                        ? "border-red-500 focus:border-red-500"
                        : "border-neutral-300 focus:border-black"
                    }`}
                  />
                  {errors.username && touched.username && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {errors.username}
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
                    <div className="space-y-2">
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <X className="h-3 w-3" />
                        {errors.email}
                      </p>
                      {errors.email === "This email is already registered. Please sign in instead." && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => router.push("/auth")}
                          className="w-full h-8 text-xs rounded-none border-black dark:border-white text-black dark:text-white"
                        >
                          Go to Login
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={formData.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`h-10 sm:h-12 rounded-none bg-transparent text-black dark:text-white placeholder:text-neutral-400 focus:ring-0 ${
                      errors.phone && touched.phone
                        ? "border-red-500 focus:border-red-500"
                        : "border-neutral-300 focus:border-black"
                    }`}
                  />
                  {errors.phone && touched.phone && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {errors.phone}
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
                      placeholder="Create password"
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

                  {/* Password Strength */}
                  {formData.password && (
                    <div className="space-y-1">
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
                                : "bg-neutral-200"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-neutral-500">
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

                  {errors.password && touched.password && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {errors.password}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !isSignUpLoaded}
                  className="w-full h-11 sm:h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs sm:text-sm mt-2 sm:mt-0"
                >
                  {isLoading ? "Creating..." : !isSignUpLoaded ? "Loading..." : "Continue"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-6">
                <div className="space-y-2 text-center">
                  <Label className="text-xs font-normal uppercase tracking-widest text-neutral-500">
                    Enter Verification Code
                  </Label>
                  <p className="text-xs text-neutral-400">
                    We sent a code to {formData.email}
                  </p>
                </div>

                <div className="flex justify-center py-4">
                  <InputOTP
                    maxLength={6}
                    value={verificationCode}
                    onChange={(val) => setVerificationCode(val)}
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

                {errors.email && (
                  <p className="text-xs text-red-500 text-center flex items-center justify-center gap-1">
                    <X className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}

                <div className="space-y-3">
                  <Button
                    type="submit"
                    disabled={isLoading || verificationCode.length < 6}
                    className="w-full h-11 sm:h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs sm:text-sm"
                  >
                    {isLoading ? "Verifying..." : "Verify Code"}
                  </Button>
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={async () => {
                        setIsLoading(true)
                        try {
                          if ((signUp as any).verifications?.sendEmailCode) {
                            await (signUp as any).verifications.sendEmailCode({ strategy: "email_code" })
                          } else if ((signUp as any).prepareVerification) {
                            await (signUp as any).prepareVerification({ strategy: "email_code" })
                          } else if ((signUp as any).prepareEmailAddressVerification) {
                            await (signUp as any).prepareEmailAddressVerification({ strategy: "email_code" })
                          }
                          setResendCooldown(60)
                        } catch (err: any) {
                          alert(err.message || "Failed to resend code")
                        }
                        setIsLoading(false)
                      }}
                      disabled={isLoading || resendCooldown > 0}
                      className="text-xs text-neutral-500 hover:text-black font-normal uppercase tracking-widest"
                    >
                      {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : "Resend Code"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setVerifying(false)}
                      disabled={isLoading}
                      className="w-full h-11 sm:h-12 rounded-none border-neutral-300 hover:bg-neutral-50 font-normal uppercase tracking-widest text-xs"
                    >
                      <ArrowLeft className="h-3 w-3 mr-2" />
                      Back to Signup
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>


          <p className="text-xs text-center text-neutral-400 pb-4 sm:pb-0">
            Already have an account?{" "}
            <Link href="/auth" className="text-neutral-600 hover:text-black dark:hover:text-white transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
