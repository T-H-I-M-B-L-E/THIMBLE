"use client"

import { ClerkProvider } from "@clerk/nextjs"

export function ClerkProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      signInUrl="/auth"
      signUpUrl="/auth/signup"
      afterSignInUrl="/feed"
      afterSignUpUrl="/feed"
    >
      {children}
    </ClerkProvider>
  )
}
