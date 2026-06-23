/**
 * Tiptap editor wiring for the Carve WYSIWYG app.
 *
 * The editor is initialized with carve-grammars' CarveKit (which internally
 * pulls StarterKit, Underline, Link, lists, tables, task lists, code block,
 * highlight, sub/superscript, image, plus the Carve-specific marks/nodes) and
 * exposes the serializer so the live Carve source pane can update on every
 * change.
 */
import { Editor } from '@tiptap/core';
import { CarveKit, serializeToCarve } from 'carve-grammars/tiptap';

export interface CarveEditorOptions {
  element: HTMLElement;
  content?: string;
  onUpdate?: (carve: string) => void;
}

export function createCarveEditor(opts: CarveEditorOptions): Editor {
  const editor = new Editor({
    element: opts.element,
    extensions: [CarveKit],
    content: opts.content ?? '',
    onUpdate: ({ editor }) => {
      opts.onUpdate?.(serializeToCarve(editor.getJSON()));
    },
  });
  return editor;
}

/** Serialize the current editor document to Carve markup. */
export function editorToCarve(editor: Editor): string {
  return serializeToCarve(editor.getJSON());
}

/** Re-serialize an arbitrary ProseMirror/Tiptap JSON doc. */
export function jsonToCarve(json: unknown): string {
  return serializeToCarve(json);
}
