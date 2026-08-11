/**
 * Import direction: Carve source -> ProseMirror JSON through the shared AST
 * bridge. Keeping this seam in one module makes the app exercise the same
 * public API that downstream editors consume.
 */
import { parse, resolve, renderHtml } from '@markup-carve/carve';
import { carveToProseMirror } from '@markup-carve/carve-grammars/tiptap';
import type { JSONContent } from '@tiptap/core';

/** Parse Carve into the lossless document shape consumed by CarveKit. */
export function carveToEditorDocument(source: string): JSONContent {
  return carveToProseMirror(source, { unsupported: 'preserve' });
}

/** Render Carve source for the preview pane. */
export function carveToHtmlRaw(source: string): string {
  return renderHtml(resolve(parse(source)));
}
