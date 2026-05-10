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
    rolldownOptions: {
      output: {
        // Keep auth UI/runtime separated from the app entry chunk.
        manualChunks(id) {
          if (id.includes('node_modules/@clerk/')) {
            return 'vendor-clerk'
          }

          return undefined
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
    tanstackRouter(),
    viteReact(),
  ],
})

export default config
