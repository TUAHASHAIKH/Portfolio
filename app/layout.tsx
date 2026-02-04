import React from "react"
import type { Metadata } from 'next'
import { Space_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const spaceMono = Space_Mono({ 
  weight: ['400', '700'],
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: 'Tuaha - Software Engineer & Full-Stack Developer',
  description: 'Portfolio of Tuaha Shaikh, a software engineer and full-stack developer',
  icons: {
    icon: '/images/projects/logo.png',
    apple: '/images/projects/logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceMono.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
