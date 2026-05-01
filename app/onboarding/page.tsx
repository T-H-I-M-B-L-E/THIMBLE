"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useStore, type UserRole } from "@/lib/store"
import { useTheme } from "@/lib/theme-context"
import { 
  User, Palette, Factory, Camera, Building2, Sun, Moon, 
  ArrowRight, ArrowLeft, Check, Instagram, Globe, Sparkles 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { cn } from "@/lib/utils"

const roles: { id: UserRole; label: string; description: string; icon: React.ElementType }[] = [
  { id: "model", label: "Model", description: "Showcase your portfolio and find gigs", icon: User },
  { id: "designer", label: "Designer", description: "Share designs and find manufacturers", icon: Palette },
  { id: "manufacturer", label: "Manufacturer", description: "Offer production services", icon: Factory },
  { id: "photographer", label: "Photographer", description: "Share your work and find shoots", icon: Camera },
  { id: "brand", label: "Brand", description: "Post campaigns and discover talent", icon: Building2 },
]

type OnboardingStep = "welcome" | "role" | "photo" | "bio" | "social" | "success"

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const { setRole } = useStore()
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome")
  const [direction, setDirection] = useState(1) // 1 for forward, -1 for back
  
  // Form State
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [bio, setBio] = useState("")
  const [username, setUsername] = useState("")
  const [website, setWebsite] = useState("")
  const [instagram, setInstagram] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  const isDark = theme === "dark"

  useEffect(() => {
    setMounted(true)
    if (user?.username) setUsername(user.username)
  }, [user])

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      router.push("/auth")
      return
    }
  }, [isLoaded, user, router])

  const nextStep = (step: OnboardingStep) => {
    setDirection(1)
    setCurrentStep(step)
  }

  const prevStep = (step: OnboardingStep) => {
    setDirection(-1)
    setCurrentStep(step)
  }

  const handleComplete = async () => {
    if (!user || !selectedRole) return
    setIsUpdating(true)

    try {
      await user.update({
        username: username || undefined,
        unsafeMetadata: {
          ...user.unsafeMetadata,
          role: selectedRole,
          bio,
          avatarUrl: profilePreview,
          website,
          instagram,
          onboardingCompleted: true,
        },
      })
      setRole(selectedRole)
      nextStep("success")
    } catch (error) {
      console.error("Failed to complete onboarding:", error)
      // Fallback
      setRole(selectedRole)
      nextStep("success")
    } finally {
      setIsUpdating(false)
    }
  }

  if (!mounted || !isLoaded) return null

  const steps: OnboardingStep[] = ["welcome", "role", "photo", "bio", "social", "success"]
  const currentStepIndex = steps.indexOf(currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neutral-100 dark:bg-neutral-900/50 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neutral-100 dark:bg-neutral-900/50 rounded-full blur-[120px] -z-10 animate-pulse delay-700" />

      {/* Progress Bar */}
      {currentStep !== "success" && (
        <div className="fixed top-0 left-0 w-full h-1 bg-neutral-100 dark:bg-neutral-900 z-50">
          <div 
            className="h-full bg-black dark:bg-white transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Theme Toggle */}
      <div className="fixed top-6 right-6 z-50">
        <button onClick={toggleTheme} className="p-3 text-neutral-500 hover:text-black dark:hover:text-white transition-colors bg-white/50 dark:bg-black/50 backdrop-blur-md rounded-full border border-neutral-200 dark:border-neutral-800">
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      <div className="w-full max-w-xl">
        {/* WELCOME STEP */}
        {currentStep === "welcome" && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-black dark:bg-white flex items-center justify-center rounded-2xl rotate-12">
                  <Sparkles className="h-8 w-8 text-white dark:text-black" />
                </div>
              </div>
              <h1 className="text-4xl md:text-5xl font-light tracking-[0.2em] text-black dark:text-white">
                THIMBLE
              </h1>
              <div className="w-12 h-px bg-neutral-300 dark:bg-neutral-700 mx-auto" />
              <p className="text-xl font-light text-neutral-500 max-w-md mx-auto leading-relaxed">
                Welcome to the global fashion network. Let&apos;s curate your professional presence.
              </p>
            </div>
            <Button 
              onClick={() => nextStep("role")}
              className="w-full h-16 rounded-none bg-black text-white hover:bg-neutral-800 text-sm uppercase tracking-[0.3em] group"
            >
              Begin Journey
              <ArrowRight className="ml-3 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        )}

        {/* ROLE SELECTION */}
        {currentStep === "role" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="space-y-2 text-center">
              <span className="text-[10px] uppercase tracking-[0.4em] text-neutral-400">Step 02/06</span>
              <h2 className="text-2xl font-light text-black dark:text-white">Your Creative Path</h2>
              <p className="text-sm text-neutral-500">How will you contribute to the industry?</p>
            </div>
            <div className="grid gap-3">
              {roles.map((role) => {
                const Icon = role.icon
                const isSelected = selectedRole === role.id
                return (
                  <button
                    key={role.id}
                    onClick={() => {
                      setSelectedRole(role.id)
                      setTimeout(() => nextStep("photo"), 400)
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 p-5 border transition-all text-left group relative overflow-hidden",
                      isSelected 
                        ? "border-black dark:border-white bg-neutral-50 dark:bg-neutral-900" 
                        : "border-neutral-100 dark:border-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 flex items-center justify-center transition-colors",
                      isSelected ? "bg-black text-white dark:bg-white dark:text-black" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                    )}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-black dark:text-white">{role.label}</p>
                      <p className="text-xs text-neutral-400">{role.description}</p>
                    </div>
                    {isSelected && (
                      <div className="ml-auto animate-in zoom-in duration-300">
                        <Check className="h-5 w-5 text-black dark:text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <button onClick={() => prevStep("welcome")} className="flex items-center gap-2 text-xs text-neutral-400 hover:text-black dark:hover:text-white transition-colors mx-auto">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          </div>
        )}

        {/* PHOTO UPLOAD */}
        {currentStep === "photo" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="space-y-2 text-center">
              <span className="text-[10px] uppercase tracking-[0.4em] text-neutral-400">Step 03/06</span>
              <h2 className="text-2xl font-light text-black dark:text-white uppercase tracking-widest">Visual Identity</h2>
              <p className="text-sm text-neutral-500">Your profile photo is your digital handshake.</p>
            </div>

            <div className="flex flex-col items-center gap-10">
              <div className="relative">
                <div className="w-48 h-48 rounded-full border-2 border-dashed border-neutral-200 dark:border-neutral-800 flex items-center justify-center overflow-hidden bg-neutral-50 dark:bg-neutral-900 transition-all p-2">
                  {uploadProgress > 0 && uploadProgress < 100 ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-400 border-t-black dark:border-t-white" />
                      <span className="text-xs font-mono tracking-tighter">{uploadProgress}%</span>
                    </div>
                  ) : profilePreview ? (
                    <img src={profilePreview} alt="Preview" className="w-full h-full rounded-full object-cover animate-in fade-in zoom-in duration-500" />
                  ) : (
                    <User className="h-20 w-20 text-neutral-200" />
                  )}
                </div>
                <label className="absolute bottom-2 right-2 p-4 bg-black dark:bg-white rounded-full cursor-pointer hover:scale-105 transition-all shadow-xl">
                  <Camera className="h-5 w-5 text-white dark:text-black" />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        try {
                          const url = await uploadToCloudinary(file, (p) => setUploadProgress(p))
                          setProfilePreview(url)
                        } catch (err) {
                          console.error(err)
                          setUploadProgress(0)
                        }
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3 pt-6">
              <Button 
                onClick={() => nextStep("bio")}
                disabled={uploadProgress > 0 && uploadProgress < 100}
                className="w-full h-16 rounded-none bg-black text-white hover:bg-neutral-800 uppercase tracking-[0.2em] text-xs transition-soft"
              >
                {profilePreview ? "Continue" : "Skip for now"}
              </Button>
              <button onClick={() => prevStep("role")} className="w-full text-xs text-neutral-400 hover:text-black transition-colors uppercase tracking-widest">
                Change Role
              </button>
            </div>
          </div>
        )}

        {/* BIO STEP */}
        {currentStep === "bio" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="space-y-2 text-center">
              <span className="text-[10px] uppercase tracking-[0.4em] text-neutral-400">Step 04/06</span>
              <h2 className="text-2xl font-light text-black dark:text-white">Profile Details</h2>
              <p className="text-sm text-neutral-500">Tell us a bit about yourself.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Username</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">@</span>
                  <Input 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-14 pl-10 rounded-none border-neutral-200 dark:border-neutral-800 focus:border-black dark:focus:border-white transition-colors"
                    placeholder="creative_visionary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Bio / About</Label>
                <Textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="min-h-[120px] rounded-none border-neutral-200 dark:border-neutral-800 focus:border-black dark:focus:border-white transition-colors resize-none"
                  placeholder="Fashion designer focused on sustainable luxury and avant-garde silhouettes..."
                />
                <p className="text-[10px] text-neutral-400 text-right">{bio.length}/200</p>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button 
                variant="outline"
                onClick={() => prevStep("photo")}
                className="flex-1 h-16 rounded-none border-neutral-200 uppercase tracking-widest text-xs"
              >
                Back
              </Button>
              <Button 
                onClick={() => nextStep("social")}
                disabled={!username}
                className="flex-[2] h-16 rounded-none bg-black text-white hover:bg-neutral-800 uppercase tracking-widest text-xs"
              >
                Next Step
              </Button>
            </div>
          </div>
        )}

        {/* SOCIAL LINKS */}
        {currentStep === "social" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="space-y-2 text-center">
              <span className="text-[10px] uppercase tracking-[0.4em] text-neutral-400">Step 05/06</span>
              <h2 className="text-2xl font-light text-black dark:text-white uppercase tracking-widest">Connections</h2>
              <p className="text-sm text-neutral-500">Where can people see more of your work?</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 flex items-center gap-2">
                  <Instagram className="h-3 w-3" /> Instagram Handle
                </Label>
                <Input 
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="h-14 rounded-none border-neutral-200 dark:border-neutral-800"
                  placeholder="@your_handle"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 flex items-center gap-2">
                  <Globe className="h-3 w-3" /> Portfolio Website
                </Label>
                <Input 
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="h-14 rounded-none border-neutral-200 dark:border-neutral-800"
                  placeholder="https://yourwork.com"
                />
              </div>
            </div>

            <Button 
              onClick={handleComplete}
              disabled={isUpdating}
              className="w-full h-16 rounded-none bg-black text-white hover:bg-neutral-800 uppercase tracking-[0.3em] text-xs transition-soft"
            >
              {isUpdating ? "Finalizing Profile..." : "Complete Setup"}
            </Button>
          </div>
        )}

        {/* SUCCESS STATE */}
        {currentStep === "success" && (
          <div className="space-y-12 text-center animate-in zoom-in fade-in duration-1000">
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-black dark:bg-white flex items-center justify-center rounded-full">
                  <Check className="h-12 w-12 text-white dark:text-black" />
                </div>
              </div>
              <h2 className="text-3xl font-light tracking-[0.2em] uppercase">Welcome, {user?.firstName}</h2>
              <p className="text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Your creative identity is now live. Welcome to the future of fashion.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-6 border border-neutral-100 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center gap-4 text-left">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white dark:border-black shadow-lg">
                  <img src={profilePreview || user?.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-medium text-black dark:text-white uppercase tracking-wider">{user?.fullName}</p>
                  <p className="text-xs text-neutral-400 capitalize">{selectedRole}</p>
                </div>
              </div>

              <Button 
                onClick={() => router.push(`/dashboard/${selectedRole}`)}
                className="w-full h-16 rounded-none bg-black text-white hover:bg-neutral-800 uppercase tracking-[0.3em] text-xs"
              >
                Enter Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
