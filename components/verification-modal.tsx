"use client"

import { useState, useRef } from "react"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Upload, CheckCircle, Clock, Camera, FileText, Globe } from "lucide-react"

interface VerificationModalProps {
  isOpen: boolean
  onClose: () => void
}

export function VerificationModal({ isOpen, onClose }: VerificationModalProps) {
  const { user, submitVerification, approveVerification } = useStore()
  const [step, setStep] = useStateState<"upload" | "pending" | "verified">(
    user?.verificationStatus === "verified" ? "verified" : 
    user?.verificationStatus === "pending" ? "pending" : "upload"
  )
  const [documents, setDocuments] = useState({
    idDocument: "",
    selfie: "",
    website: "",
  })
  const [previews, setPreviews] = useState({
    idDocument: "",
    selfie: "",
  })
  const [uploading, setUploading] = useState({
    idDocument: false,
    selfie: false,
  })

  const idInputRef = useRefRef<HTMLInputElement>(null)
  const selfieInputRef = useRefRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileSelect = async (type: "idDocument" | "selfie", file: File) => {
    setUploading((prev) => ({ ...prev, [type]: true }))
    
    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviews((prev) => ({ ...prev, [type]: reader.result as string }))
      setDocuments((prev) => ({ ...prev, [type]: file.name }))
      setUploading((prev) => ({ ...prev, [type]: false }))
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = () => {
    if (!documents.idDocument || !documents.selfie) return
    submitVerification(documents)
    setStep("pending")
  }

  const handleSimulateApproval = () => {
    approveVerification()
    setStep("verified")
  }

  const removeFile = (type: "idDocument" | "selfie") => {
    setPreviews((prev) => ({ ...prev, [type]: "" }))
    setDocuments((prev) => ({ ...prev, [type]: "" }))
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
                <Label className="text-xs uppercase tracking-wider text-neutral-500 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  ID Document *
                </Label>
                
                {!previews.idDocument ? (
                  <button
                    onClick={() => idInputRef.current?.click()}
                    disabled={uploading.idDocument}
                    className="w-full border-2 border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors disabled:opacity-50"
                  >
                    {uploading.idDocument ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-400 border-t-black" />
                        <p className="text-sm text-neutral-500">Uploading...</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto mb-2 text-neutral-400" />
                        <p className="text-sm text-neutral-500">Click to upload ID</p>
                        <p className="text-xs text-neutral-400">Driver&apos;s License, Passport, or National ID</p>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="relative">
                    <img
                      src={previews.idDocument}
                      alt="ID Document"
                      className="w-full h-48 object-cover border border-neutral-200 dark:border-neutral-800"
                    />
                    <button
                      onClick={() => removeFile("idDocument")}
                      className="absolute top-2 right-2 p-1 bg-black/50 text-white hover:bg-black/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      ID uploaded successfully
                    </p>
                  </div>
                )}
                <input
                  ref={idInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect("idDocument", e.target.files[0])}
                />
              </div>

              {/* Selfie */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-neutral-500 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Selfie Verification *
                </Label>
                
                {!previews.selfie ? (
                  <button
                    onClick={() => selfieInputRef.current?.click()}
                    disabled={uploading.selfie}
                    className="w-full border-2 border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors disabled:opacity-50"
                  >
                    {uploading.selfie ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-400 border-t-black" />
                        <p className="text-sm text-neutral-500">Uploading...</p>
                      </div>
                    ) : (
                      <>
                        <Camera className="h-8 w-8 mx-auto mb-2 text-neutral-400" />
                        <p className="text-sm text-neutral-500">Take or upload a selfie</p>
                        <p className="text-xs text-neutral-400">Clear photo of your face required</p>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="relative">
                    <img
                      src={previews.selfie}
                      alt="Selfie"
                      className="w-full h-48 object-cover border border-neutral-200 dark:border-neutral-800"
                    />
                    <button
                      onClick={() => removeFile("selfie")}
                      className="absolute top-2 right-2 p-1 bg-black/50 text-white hover:bg-black/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Selfie uploaded successfully
                    </p>
                  </div>
                )}
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect("selfie", e.target.files[0])}
                />
              </div>

              {/* Website/Social (Optional) */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-neutral-500 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website or Social Link (Optional)
                </Label>
                <Input
                  placeholder="https://yourwebsite.com"
                  value={documents.website}
                  onChange={(e) => setDocuments((prev) => ({ ...prev, website: e.target.value }))}
                  className="rounded-none border-neutral-300"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!documents.idDocument || !documents.selfie}
                className="w-full rounded-none bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
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
              <h3 className="text-lg font-medium">You&apos;re Verified!</h3>
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
