import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Geist, Geist_Mono } from "next/font/google";
import ConvexClientProvider from "@/components/convex-provider";
import "./globals.css";

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Operation Zero Hour",
  description: "Team-based murder mystery competition. Five rounds. One killer.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${instrument.variable} ${geist.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-bg text-ink font-ui grain vignette">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
