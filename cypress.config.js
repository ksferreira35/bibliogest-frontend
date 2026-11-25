import { defineConfig } from 'cypress'
export default defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:4173',
    supportFile: 'cypress/support/e2e.js',
    setupNodeEvents(on) {
      on('task', {
        a11y(violations) {
          console.log(JSON.stringify(violations, null, 2))
          return null
        },
      })
    },
  },
  viewportWidth: 1440,
  viewportHeight: 1000,
  video: false,
  retries: { runMode: 1, openMode: 0 },
})
