import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";

import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { RealtimeProvider } from "@/components/social/realtime-provider";
import { SWRProvider } from "@/components/providers/swr-provider";
import { NavigationFeedbackProvider } from "@/components/navigation/navigation-feedback";

import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Cafe360",
    template: "%s | Cafe360",
  },
  description: "Shared cafe maps and memories for your friend group.",
  applicationName: "Cafe360",
  appleWebApp: {
    capable: true,
    title: "Cafe360",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon-precomposed.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#FCFBF9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bricolage.variable} ${dmSans.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <SWRProvider>
            <ServiceWorkerRegistration />
            <InstallPrompt />
            <NavigationFeedbackProvider><RealtimeProvider>{children}</RealtimeProvider></NavigationFeedbackProvider>
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
