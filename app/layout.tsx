import type { Metadata } from 'next'
import { Geist, Geist_Mono, Rozha_One } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { SidebarProvider } from '@/lib/sidebar-context'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _rozhaOne = Rozha_One({ subsets: ["latin"], weight: "400", variable: "--font-primary" });

export const metadata: Metadata = {
  title: 'Psychology Practice Manager',
  description: 'Comprehensive management system for psychology and neurofeedback practices',
  generator: 'v0.app',
  icons: {
    icon: '/LOGO.png',
    apple: '/LOGO.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${_rozhaOne.variable} font-secondary antialiased`}>
        <AuthProvider>
          <SidebarProvider>
            {children}
          </SidebarProvider>
        </AuthProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
