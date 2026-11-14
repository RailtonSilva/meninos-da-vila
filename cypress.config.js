import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // Os testes rodam contra o site em MODO DEMONSTRAÇÃO (sem backend, dados fictícios).
    // Suba o site antes com:  npm run demo   (http://localhost:5500)
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:5500',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1366,
    viewportHeight: 900,
    defaultCommandTimeout: 8000,
    video: false,
    screenshotOnRunFailure: true,
  },
});
