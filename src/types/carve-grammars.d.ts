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

  /**
   * Convert a Carve AST document to a ProseMirror/Tiptap JSON document.
   *
   * The seam the loader itself uses. Declared here because it is the only way
   * to exercise a node type the INSTALLED engine cannot parse yet - see
   * tests/composite-figure.test.ts.
   */
  export function astToProseMirror(
    ast: unknown,
    options?: CarveLoaderOptions & { source?: string },
  ): JSONContent;

  /** Serialize a Tiptap/ProseMirror JSON document to Carve markup. */
  export function serializeToCarve(doc: unknown): string;

  /** Escape a plain text run so it round-trips as literal Carve text. */
  export function escapeCarve(text: string): string;
}
