import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    modulePreload: {
      resolveDependencies: (_filename, deps, context) => {
        if (context.hostType !== 'html') {
          return deps
        }

        // Analytics charts are loaded by lazy dashboard components, so keep the
        // heavy Recharts vendor chunk out of the first document preload list.
        return deps.filter((dep) => !dep.includes('vendor-charts'))
      },
    },
    rolldownOptions: {
      output: {
        // Prefer Rolldown code-splitting groups over deprecated manualChunks.
        codeSplitting: {
          groups: [
            {
              name: 'vendor-clerk',
              test: /node_modules[\\/]@clerk[\\/]/,
              priority: 30,
            },
            {
              name: 'vendor-charts',
              test: /node_modules[\\/](recharts|d3[^\\/]*)([\\/]|$)/,
              priority: 20,
            },
            {
              name: 'vendor-convex',
              test: /node_modules[\\/](convex|convex-helpers|@convex-dev)([\\/]|$)/,
              minShareCount: 2,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  plugins: [
    devtools({
      eventBusConfig: {
        // Prevent startup crashes when the devtools internal event-bus port is already occupied.
        enabled: false,
      },
    }),
    tailwindcss(),
    tanstackRouter({
      autoCodeSplitting: true,
    }),
    viteReact(),
  ],
})

export default config
