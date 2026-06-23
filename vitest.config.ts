import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // happy-dom gives a DOM so Tiptap/ProseMirror can build documents from
    // HTML the same way the browser app does. See tests for the caveat about
    // what does and does not work headless.
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
