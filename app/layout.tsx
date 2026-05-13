import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/lib/theme-context'
import { UserSync } from '@/components/user-sync'
import { WelcomeOverlay } from '@/components/welcome-overlay'
import { headers } from 'next/headers'
import { Bodoni_Moda } from 'next/font/google'
import './globals.css'

const bodoniModa = Bodoni_Moda({
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
  variable: '--font-bodoni',
})

export const metadata: Metadata = {
  title: 'Thimble | The Fashion Creative Platform',
  description: 'Where fashion meets its own world. Designers, Models, Manufacturers, Photographers and Fashion Brands — all in one trusted platform built to make collaboration easy.',
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isAdmin = host.startsWith('admin.')

  return (
    <html lang="en" className={`bg-background ${bodoniModa.variable}`}>
      <body className="antialiased">
        <ThemeProvider>
          {!isAdmin && <UserSync />}
          {!isAdmin && <WelcomeOverlay />}
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
