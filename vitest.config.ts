import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'dist/**', 'node_modules/**', '**/*.config.*'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.*',
        'src/**/__tests__/**',
        'src/test-setup.ts',
        'src/vite-env.d.ts',
      ],
      // Floor set just under the current coverage. CI runs this via `pnpm
      // coverage`, so a real regression fails the build instead of slipping in.
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 60,
        lines: 60,
      },
    },
  },
});
