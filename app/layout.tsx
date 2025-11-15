import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { cookies } from 'next/headers'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Edunica',
  description: 'Created with Edunica',
  generator: 'Edunica',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Read theme cookie on the server to render the correct html class and avoid hydration mismatch.
  let initialTheme: string | null = null
  try {
    const cookieStore = await cookies()
    const themeCookie = cookieStore.get('theme')
    if (themeCookie) initialTheme = themeCookie.value
  } catch (e) {
    initialTheme = null
  }

  const htmlClass = initialTheme === 'dark' ? 'dark' : initialTheme === 'light' ? 'light' : ''
  const htmlStyle = initialTheme ? { colorScheme: initialTheme as 'dark' | 'light' } : undefined

  // Inline script: if the user has a theme in localStorage, apply it BEFORE React hydrates.
  // Also sync the cookie so future SSR requests will match.
  const inlineThemeScript = `
    (function() {
      try {
        var stored = localStorage.getItem('theme');
        if (stored) {
          // ensure we don't leak other classes
          document.documentElement.classList.remove('light','dark');
          document.documentElement.classList.add(stored);
          document.documentElement.style.colorScheme = stored === 'dark' ? 'dark' : 'light';
          // sync cookie for next SSR (optional but helps consistency)
          document.cookie = 'theme=' + stored + '; path=/; max-age=' + (60*60*24*365);
        }
      } catch (e) {}
    })();
  `

  return (
    <html lang="en" className={htmlClass} style={htmlStyle}>
      <head>
        {/* Ejecutar antes de la hidratación para evitar mismatches */}
        <script dangerouslySetInnerHTML={{ __html: inlineThemeScript }} />
      </head>
      <body className={`font-sans antialiased`}>
        {/* Pass the server-detected initial theme into the ThemeProvider so the
            client initializes with the same theme and avoids hydration mismatches. */}
        <ThemeProvider attribute="class" defaultTheme={initialTheme ?? 'system'}>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}