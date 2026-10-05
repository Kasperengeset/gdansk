import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Gdańsk uten kart",
  description: "Rebusløpet: ingen kart, ingen Google – bare lokalbefolkningen, papir og magefølelsen.",
};

export const viewport: Viewport = {
  themeColor: "#b3261e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nb" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <div className="h-1.5 bg-brand" />
        {children}
      </body>
    </html>
  );
}
