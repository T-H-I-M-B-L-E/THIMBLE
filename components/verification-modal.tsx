"use client"

import { useState } from "react"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Upload, CheckCircle, Clock } from "lucide-react"

interface VerificationModalProps {
  isOpen: boolean
  onClose: () => void
}

export function VerificationModal({ isOpen, onClose }: VerificationModalProps) {
  const { user, submitVerification, approveVerification } = useStore()
  const [step, setStep] = useState<"upload" | "pending" | "verified">(
    user?.verificationStatus === "verified" ? "verified" : 
    user?.verificationStatus === "pending" ? "pending" : "upload"
  )
  const [documents, setDocuments] = useState({
    idDocument: "",
    selfie: "",
    website: "",
  })

  if (!isOpen) return null

  const handleSubmit = () => {
    submitVerification(documents)
    setStep("pending")
  }

  const handleSimulateApproval = () => {
    approveVerification()
    setStep("verified")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-medium text-black dark:text-white">
            {step === "upload" && "Get Verified"}
            {step === "pending" && "Verification Pending"}
            {step === "verified" && "Verified"}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {step === "upload" && (
            <>
              <p className="text-sm text-neutral-500">
                Verification helps build trust. Submit your documents to unlock all features.
              </p>

              {/* ID Document */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-neutral-500">ID Document</Label>
                <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-neutral-400" />
                  <p className="text-sm text-neutral-500">Upload ID (Driver's License, Passport)</p>
                  <Input
                    type="file"
                    accept="image/*"
                    className="mt-2"
                    onChange={(e) => setDocuments({ ...documents, idDocument: e.target.value })}
                  />
                </div>
              </div>

              {/* Selfie */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-neutral-500">Selfie Verification</Label>
                <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-neutral-400" />
                  <p className="text-sm text-neutral-500">Take a selfie holding your ID</p>
                  <Input
                    type="file"
                    accept="image/*"
                    className="mt-2"
                    onChange={(e) => setDocuments({ ...documents, selfie: e.target.value })}
                  />
                </div>
              </div>

              {/* Website/Social (Optional) */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-neutral-500">
                  Website or Social Link (Optional)
                </Label>
                <Input
                  placeholder="https://"
                  value={documents.website}
                  onChange={(e) => setDocuments({ ...documents, website: e.target.value })}
                  className="rounded-none border-neutral-300"
                />
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full rounded-none bg-black text-white hover:bg-neutral-800"
              >
                Submit for Review
              </Button>
            </>
          )}

          {step === "pending" && (
            <div className="text-center py-8 space-y-4">
              <Clock className="h-16 w-16 mx-auto text-amber-500" />
              <h3 className="text-lg font-medium">Under Review</h3>
              <p className="text-sm text-neutral-500">
                Your documents are being reviewed. This usually takes 1-2 business days.
              </p>
              {/* Demo button */}
              <Button
                onClick={handleSimulateApproval}
                variant="outline"
                className="rounded-none"
              >
                [Demo] Approve Verification
              </Button>
            </div>
          )}

          {step === "verified" && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
              <h3 className="text-lg font-medium">You're Verified!</h3>
              <p className="text-sm text-neutral-500">
                You now have full access to all platform features.
              </p>
              <Button onClick={onClose} className="rounded-none bg-black text-white">
                Continue
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
