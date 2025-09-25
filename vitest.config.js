/* eslint-disable import-x/no-extraneous-dependencies */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/core/tests/setup.ts'],
    // This is needed to allow the global setup to access the ProcessManager class
    globals: true,
  },
});
