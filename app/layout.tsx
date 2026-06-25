import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/lib/theme-context";
import { NotifyProvider } from "@/components/notify-provider";
import { UserSync } from "@/components/user-sync";
import { WelcomeOverlay } from "@/components/welcome-overlay";
import { GrainientBackground } from "@/components/grainient-background";
import { SiteBanner } from "@/components/SiteBanner";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TVIMBLE - Fashion Creative Platform",
  description:
    "Where fashion designers, models, and creatives showcase their work and collaborate",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TVIMBLE",
  },
  icons: {
    icon: [
      {
        url: "/icons/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        url: "/icons/favicon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/icons/favicon.ico",
      },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0a0a0a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const isAdmin = host.startsWith("admin.");

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;0,700;1,300&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=Bebas+Neue&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {!isAdmin && <GrainientBackground />}
        <ThemeProvider>
          <NotifyProvider>
            {!isAdmin && <SiteBanner />}
            {!isAdmin && <UserSync />}
            {!isAdmin && <WelcomeOverlay />}
            {!isAdmin && <PWAInstallPrompt variant="inapp" />}
            {!isAdmin ? (
              <div id="main-content">{children}</div>
            ) : (
              <>{children}</>
            )}
          </NotifyProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
