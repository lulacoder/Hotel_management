// Root app shell for TanStack Router providers and global layout.
import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { LazyMotion, domAnimation } from 'motion/react'
import { Suspense, lazy } from 'react'

import Header from '../components/Header'
import { Button } from '../components/ui/button'
import { Toaster } from '../components/ui/sonner'
import { TooltipProvider } from '../components/ui/tooltip'

import ClerkProvider from '../integrations/clerk/provider'

import ConvexProvider from '../integrations/convex/provider'
import { I18nProvider, useI18n } from '../lib/i18n/provider'
import { ThemeProvider } from '../lib/theme'
import type { AppRouterContext } from '../lib/routerContext'

const RootDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('../lib/rootDevtools').then((module) => ({
        default: module.RootDevtools,
      })),
    )
  : null

export const Route = createRootRouteWithContext<AppRouterContext>()({
  // Fallback UI when no route matches.
  notFoundComponent: RootNotFound,

  // Global app shell wrapped around routed pages.
  component: RootAppShell,
})

export function RootNotFound() {
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

export function RootAppShell() {
  // Root app shell that wraps every matched route component.
  return (
    <I18nProvider>
      <ThemeProvider>
        <ClerkProvider>
          <ConvexProvider>
            <LazyMotion features={domAnimation}>
              <TooltipProvider>
                <Header />
                <Outlet />
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
            </LazyMotion>
          </ConvexProvider>
        </ClerkProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}
