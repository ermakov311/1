import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import AuthGuard from '@/components/AuthGuard/AuthGuard'
import { Main } from 'next/document'
import ThemeInitializer from './theme-initializer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Grant',
  description: 'Educational platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeInitializer />
        <Providers>
          <AuthGuard>
            {children}
          </AuthGuard>
        </Providers>
        <div id="portal-root"></div>
      </body>
    </html>
  )
}
