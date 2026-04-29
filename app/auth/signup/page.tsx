"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Check, X } from "lucide-react"

interface FormErrors {
  fullName?: string
  email?: string
  phone?: string
  password?: string
}

export default function SignupPage() {
  const router = useRouter()
  const { signup } = useStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useStateState<FormErrors>({})
  const [touched, setTouched] = useStateState<Record<string, boolean>>({})

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  })

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
      case "phone":
        if (!value.trim()) return "Phone number is required"
        if (!/^\+?[\d\s\-\(\)]{10,}$/.test(value.replace(/\s/g, ""))) return "Please enter a valid phone number"
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

  const handleChange = (e: React.ChangeEventEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
    }
  }

  const handleBlur = (e: React.FocusEventEvent<HTMLInputElement>) => {
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
    
    if (!validateForm()) return
    
    setIsLoading(true)
    signup(formData)
    router.push("/auth/role-select")
    setIsLoading(false)
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
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-12 bg-white dark:bg-black min-h-screen lg:min-h-0">
        <div className="w-full max-w-sm sm:max-w-md space-y-6 sm:space-y-8">
          <div className="lg:hidden text-center">
            <h1 className="text-xl sm:text-2xl font-light text-black dark:text-white tracking-[0.2em]">THIMBLE</h1>
          </div>

          <div className="text-center space-y-2 sm:space-y-3">
            <h2 className="text-xl sm:text-2xl font-light text-black dark:text-white">Create account</h2>
            <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400">Join our creative community</p>
          </div>

          <div className="border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
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
                disabled={isLoading}
                className="w-full h-10 sm:h-12 rounded-none bg-black text-white hover:bg-neutral-800 font-normal uppercase tracking-widest text-xs sm:text-sm"
              >
                {isLoading ? "Creating..." : "Continue"}
              </Button>
            </form>
          </div>

          <p className="text-xs text-center text-neutral-400">
            Already have an account?{" "}
            <a href="/auth" className="text-neutral-600 hover:text-black">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  )
}
