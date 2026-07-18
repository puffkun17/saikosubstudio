import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { SystemTray } from "@/components/Global/SystemTray";
import { AppChrome } from "@/components/Global/AppChrome";

export const metadata: Metadata = {
  title: "SaikoSubStudio",
  description: "Tool for aligning, merging and styling bilingual subtitles with cinema preview simulator.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [
      { rel: 'icon', url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { rel: 'icon', url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="app-canvas font-sans h-dvh overflow-hidden">
        <AppChrome>
          <SystemTray />
          <div className="app-main-pad">
            {children}
          </div>
        </AppChrome>
      </body>
    </html>
  );
}
