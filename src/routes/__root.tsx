// Root document shell for TanStack Router (providers, metadata, and global layout).
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import Header from '../components/Header'

import ClerkProvider from '../integrations/clerk/provider'

import ConvexProvider from '../integrations/convex/provider'
import { I18nProvider, localeBootstrapScript, useI18n } from '../lib/i18n'
import { ThemeProvider, themeBootstrapScript } from '../lib/theme'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
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
      <Link
        to="/"
        className="mt-6 rounded-xl bg-blue-500 px-5 py-2.5 font-semibold text-slate-900 transition-colors hover:bg-blue-400"
      >
        {t('root.goHome')}
      </Link>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  // Root HTML shell that wraps every matched route component.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent theme/i18n flicker before hydration. */}
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
                <Header />
                {children}
                {/* Devtools are mounted once at the root for route inspection. */}
                <TanStackDevtools
                  config={{
                    position: 'bottom-right',
                  }}
                  plugins={[
                    {
                      name: 'Tanstack Router',
                      render: <TanStackRouterDevtoolsPanel />,
                    },
                  ]}
                />
              </ConvexProvider>
            </ClerkProvider>
          </ThemeProvider>
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  )
}
