/**
 * Minimal ambient types for the `@markup-carve/carve-grammars/tiptap` package, which ships
 * as plain ESM with no bundled .d.ts. We only declare what the app uses.
 */
declare module '@markup-carve/carve-grammars/tiptap' {
  import type { Extension, JSONContent } from '@tiptap/core';

  /** The Tiptap extension bundle for Carve markup. */
  export const CarveKit: Extension;

  export interface CarveLoaderOptions {
    unsupported?: 'throw' | 'preserve';
  }

  /** Parse Carve source directly into a ProseMirror/Tiptap JSON document. */
  export function carveToProseMirror(
    source: string,
    options?: CarveLoaderOptions,
  ): JSONContent;

  /** Serialize a Tiptap/ProseMirror JSON document to Carve markup. */
  export function serializeToCarve(doc: unknown): string;

  /** Escape a plain text run so it round-trips as literal Carve text. */
  export function escapeCarve(text: string): string;
}
