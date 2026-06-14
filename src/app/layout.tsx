import type { Metadata, Viewport } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import { A11yProvider } from "@/components/layout/a11y-provider";
import { DemoSyncProvider } from "@/components/layout/demo-sync-provider";
import { HydrationGate } from "@/components/layout/hydration-gate";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Doorway — Section 8 Housing Match",
  description:
    "Swipe-based housing matching for voucher holders and landlords.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Doorway",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#faf9f7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${playfair.variable} h-full`}>
      <body className="min-h-full antialiased">
        <ThemeProvider>
          <DemoSyncProvider>
            <HydrationGate>
              <A11yProvider>{children}</A11yProvider>
            </HydrationGate>
          </DemoSyncProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
