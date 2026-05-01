import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/lib/theme-context'
import { ClerkProviderWrapper } from '@/components/clerk-provider-wrapper'
import { ClerkUserSync } from '@/components/clerk-user-sync'
import { WelcomeOverlay } from '@/components/welcome-overlay'
import './globals.css'

export const metadata: Metadata = {
  title: 'THIMBLE - Fashion Creative Platform',
  description: 'Where fashion designers, models, and creatives showcase their work and collaborate',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased">
        <ClerkProviderWrapper>
          <ThemeProvider>
            <ClerkUserSync />
            <WelcomeOverlay />
            {children}
          </ThemeProvider>
        </ClerkProviderWrapper>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
