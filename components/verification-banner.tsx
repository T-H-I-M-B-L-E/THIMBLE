"use client"

import { useStore } from "@/lib/store"
import { AlertCircle, ShieldCheck, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function VerificationBanner() {
  const { user } = useStore()

  if (!user || user.verificationStatus === 'verified') return null

  const isPending = user.verificationStatus === 'pending'

  return (
    <div className={`mb-8 p-4 border flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up ${
      isPending 
        ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" 
        : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
    }`}>
      <div className="flex items-center gap-3 text-center sm:text-left">
        {isPending ? (
          <ShieldCheck className="h-5 w-5 text-blue-600" />
        ) : (
          <AlertCircle className="h-5 w-5 text-amber-600" />
        )}
        <div>
          <h3 className={`font-medium text-sm ${isPending ? "text-blue-900 dark:text-blue-100" : "text-amber-900 dark:text-amber-100"}`}>
            {isPending ? "Verification Pending" : "Verify Your Account"}
          </h3>
          <p className={`text-xs mt-0.5 ${isPending ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-300"}`}>
            {isPending 
              ? "We're reviewing your documents. This usually takes 24-48 hours." 
              : "Complete your verification to apply to gigs and access premium features."
            }
          </p>
        </div>
      </div>
      {!isPending && (
        <Link href={`/dashboard/${user.role}/profile`}>
          <Button size="sm" className="rounded-none bg-black text-white hover:bg-neutral-800 transition-soft">
            Start Verification
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  )
}
