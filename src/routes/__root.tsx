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
import { ThemeProvider, themeBootstrapScript } from '../lib/theme'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
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

  notFoundComponent: RootNotFound,

  shellComponent: RootDocument,
})

function RootNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold text-slate-100">Page not found</h1>
      <p className="mt-3 text-slate-400">
        The page you’re looking for doesn’t exist or may have been moved.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-xl bg-amber-500 px-5 py-2.5 font-semibold text-slate-900 transition-colors hover:bg-amber-400"
      >
        Go to home
      </Link>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <ClerkProvider>
            <ConvexProvider>
              <Header />
              {children}
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
        <Scripts />
      </body>
    </html>
  )
}
