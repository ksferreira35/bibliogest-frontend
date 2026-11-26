import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig(({ mode, command }) => {
  if (mode === 'e2e' && command !== 'serve')
    throw new Error('O modo e2e não pode gerar um build de produção')
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias:
        mode === 'e2e'
          ? [
              {
                find: /^keycloak-js$/,
                replacement: new URL(
                  './cypress/support/keycloak.js',
                  import.meta.url,
                ).pathname,
              },
            ]
          : [],
    },
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy:
        mode === 'e2e'
          ? {}
          : {
              '/acervo': {
                target: 'https://bibliogest.ksferreira.org',
                changeOrigin: true,
              },
              '/usuarios': {
                target: 'http://127.0.0.1:8082',
                changeOrigin: true,
              },
              '/reservas': {
                target: 'https://bibliogest.ksferreira.org',
                changeOrigin: true,
              },
            },
    },
  }
})
