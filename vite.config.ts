import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

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
    nitro(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
