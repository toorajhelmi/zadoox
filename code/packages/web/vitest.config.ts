/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

function resolveVitestCoverageV8(): string | null {
  try {
    // pnpm stores packages under node_modules/.pnpm/<pkg>@<ver>.../node_modules/<pkg>
    const pnpmDir = path.resolve(__dirname, '../../node_modules/.pnpm');
    const entries = fs.readdirSync(pnpmDir);
    const hit = entries.find((e) => e.startsWith('@vitest+coverage-v8@'));
    if (!hit) return null;
    const p = path.resolve(pnpmDir, hit, 'node_modules/@vitest/coverage-v8/dist/index.js');
    if (fs.existsSync(p)) return p;
    return null;
  } catch {
    return null;
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Focus coverage on editor-related code so we can enforce a meaningful threshold
      // for the upcoming EditorLayout refactor.
      include: [
        'components/editor/**',
        'hooks/use-undo-redo.ts',
        'hooks/use-change-tracking.ts',
        'hooks/use-ir-document.ts',
        'hooks/use-document-state.ts',
      ],
      exclude: [
        'node_modules/',
        '.next/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // Coverage provider is in the pnpm store but not a direct dep of @zadoox/web.
      // Alias it so `vitest --coverage` works without requiring a new install.
      ...(resolveVitestCoverageV8()
        ? { '@vitest/coverage-v8': resolveVitestCoverageV8() as string }
        : {}),
    },
  },
});

