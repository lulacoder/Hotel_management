// Root document shell for TanStack Router (providers, metadata, and global layout).
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

import Header from '../components/Header'
import { Button } from '../components/ui/button'
import { Toaster } from '../components/ui/sonner'
import { TooltipProvider } from '../components/ui/tooltip'

import ClerkProvider from '../integrations/clerk/provider'

import ConvexProvider from '../integrations/convex/provider'
import { I18nProvider, localeBootstrapScript, useI18n } from '../lib/i18n'
import { ThemeProvider, themeBootstrapScript } from '../lib/theme'

import appCss from '../styles.css?url'
import type { AppRouterContext } from '../lib/routerContext'

const RootDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('../lib/rootDevtools').then((module) => ({
        default: module.RootDevtools,
      })),
    )
  : null

export const Route = createRootRouteWithContext<AppRouterContext>()({
  // Define document-level metadata and assets once for the whole app.
  // Static document metadata shared by every route.
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Hotel Management System',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap',
      },
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/logo32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        href: '/logo192.png',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/logo192.png',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
  }),

  // Fallback UI when no route matches.
  notFoundComponent: RootNotFound,

  // Global app shell wrapped around routed pages.
  shellComponent: RootDocument,
})

function RootNotFound() {
  // Lightweight fallback page for unknown paths.
  const { t } = useI18n()

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold text-slate-100">
        {t('root.notFoundTitle')}
      </h1>
      <p className="mt-3 text-slate-400">{t('root.notFoundDescription')}</p>
      <Button
        asChild
        className="mt-6 rounded-xl bg-violet-500 px-5 py-2.5 text-white hover:bg-violet-400"
      >
        <Link to="/">{t('root.goHome')}</Link>
      </Button>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  // Root HTML shell that wraps every matched route component.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent theme/i18n flicker before hyPdration. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeBootstrapScript }} />
        <HeadContent />
      </head>
      <body>
        {/* Global providers power auth, data, i18n, and theme across all routes. */}
        <I18nProvider>
          <ThemeProvider>
            <ClerkProvider>
              <ConvexProvider>
                <TooltipProvider>
                  <Header />
                  {children}
                  <Toaster
                    position="bottom-right"
                    toastOptions={{
                      style: {
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        color: 'var(--popover-foreground)',
                      },
                    }}
                  />
                  {RootDevtools ? (
                    <Suspense fallback={null}>
                      <RootDevtools />
                    </Suspense>
                  ) : null}
                </TooltipProvider>
              </ConvexProvider>
            </ClerkProvider>
          </ThemeProvider>
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  )
}
