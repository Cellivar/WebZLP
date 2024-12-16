/// <reference types="vitest" />
import path from 'path';
import packageJson from './package.json';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import eslint from 'vite-plugin-eslint';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: packageJson.name,
    },
    minify: false,
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
  plugins: [
    dts({
      exclude: [
        '**/node_modules',
        '**/*.test.ts'
      ]
    }),
    eslint({
      failOnError: false
    })
  ],
  test: {
    environment: 'happy-dom',
    includeSource: ['src/**/*.{js,ts}'],
    coverage: {
      enabled: true,
      reporter: ['text', 'json-summary', 'json'],
      reportOnFailure: true,
    }
  }
});
