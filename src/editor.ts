/**
 * Tiptap editor wiring for the Carve WYSIWYG app.
 *
 * The editor runs on the Carve 0.2 Tiptap kit (carve-grammars `./tiptap`): it is
 * loaded from the engine's tree and every change is written back through the
 * engine's writer, so divs, titles, attributes, fence info and task states keep
 * their structure after an edit.
 */
import { Editor, Extension } from '@tiptap/core';
import type { Extensions, JSONContent } from '@tiptap/core';
import * as carve from '@markup-carve/carve';
import { importDocument } from '@markup-carve/carve';
import { CarveKit, carveToProseMirror, proseMirrorToTree, serializeToCarve } from '@markup-carve/carve-grammars/tiptap';
import { CarveCodeHighlight } from './code-highlight';

export interface CarveEditorOptions {
  element: HTMLElement;
  content?: string;
  onUpdate?: (carve: string) => void;
}

/** A Carve document prepared for the editor: its source and the kit's ProseMirror document. */
export interface EditorDocument {
  source: string;
  content: JSONContent;
}

/** The shortcuts the toolbar names (index.html) beyond Tiptap's defaults. */
const CarveShortcuts = Extension.create({
  name: 'carveShortcuts',
  addKeyboardShortcuts() {
    const heading = (level: 1 | 2 | 3 | 4 | 5 | 6) => () => this.editor.commands.toggleHeading({ level });
    return {
      'Mod-1': heading(1), 'Mod-2': heading(2), 'Mod-3': heading(3),
      'Mod-4': heading(4), 'Mod-5': heading(5), 'Mod-6': heading(6),
      'Mod-Shift-e': () => this.editor.commands.toggleCodeBlock(),
      'Mod-Shift-i': () => this.editor.commands.toggleMark('carveInsert'),
      'Mod-Shift-d': () => this.editor.commands.toggleMark('carveDelete'),
      'Mod-Shift-k': () => {
        if (this.editor.isActive('link')) return this.editor.commands.unsetLink();
        const href = typeof window === 'undefined' ? null : window.prompt('Link URL:');
        return href ? this.editor.commands.setLink({ href }) : false;
      },
    };
  },
});

export const EDITOR_EXTENSIONS: Extensions = [
  CarveKit,
  CarveShortcuts,
  CarveCodeHighlight,
];

/** Carve source for a kit document; a tree the writer cannot spell is written with its loss report dropped. */
function writeDocument(json: JSONContent, source?: string): string {
  try {
    return serializeToCarve(json, { engine: carve, source });
  } catch (error) {
    if (!(error instanceof carve.CarveWriteError)) throw error;
    return carve.writeWithDiagnostics(proseMirrorToTree(json) as never).source;
  }
}

/** Carve source prepared for the editor. */
export function carveToEditorDocument(source: string): EditorDocument {
  return { source, content: carveToProseMirror(source, { engine: carve }) };
}

/** Canonical markup the editor writes for `source`: the engine's writer over the kit's tree. */
export function canonicalCarve(source: string): string {
  return writeDocument(carveToEditorDocument(source).content);
}

/** Carve source for HTML pasted or dropped from elsewhere, through the engine's HTML importer with raw HTML off. */
export function htmlToCarve(html: string): string {
  return importDocument(html, { from: 'html', rawHtml: false }).source;
}

/** The source each editor was loaded from: an unedited document writes it back byte for byte. */
const loaded = new WeakMap<Editor, string>();

export function createCarveEditor(opts: CarveEditorOptions): Editor {
  const editor = new Editor({
    element: opts.element,
    extensions: EDITOR_EXTENSIONS,
    onUpdate: ({ editor }) => {
      opts.onUpdate?.(editorToCarve(editor));
    },
  });
  if (opts.content) setCarveDocument(editor, carveToEditorDocument(opts.content));
  return editor;
}

/** Load a prepared document into the editor. */
export function setCarveDocument(editor: Editor, doc: EditorDocument): void {
  editor.commands.setCarveContent(doc.content, { emitUpdate: false });
  loaded.set(editor, doc.source);
}

/** The front matter of the editor document as Carve source, or '' when it has none. */
export function editorFrontmatter(editor: Editor): string {
  const first = editor.getJSON().content?.[0];
  if (first?.type !== 'carveFrontmatter') return '';
  return writeDocument({ type: 'doc', content: [first] });
}

/** Replace the front matter at the head of the document with the front matter of `source`, or add it. */
export function setEditorFrontmatter(editor: Editor, source: string): void {
  const node = carveToEditorDocument(source).content.content?.find(child => child.type === 'carveFrontmatter');
  const doc = editor.state.doc;
  const first = doc.firstChild;
  const to = first?.type.name === 'carveFrontmatter' ? first.nodeSize : 0;
  if (node) editor.chain().insertContentAt({ from: 0, to }, node).run();
  else if (to > 0) editor.chain().deleteRange({ from: 0, to }).run();
}

/** Insert the blocks of Carve `source` at the selection. */
export function insertCarve(editor: Editor, source: string): boolean {
  const content = carveToEditorDocument(source).content.content ?? [];
  return editor.chain().focus().insertContent(content).run();
}

/** Serialize the current editor document to Carve markup. */
export function editorToCarve(editor: Editor): string {
  return writeDocument(editor.getJSON(), loaded.get(editor));
}

/** A node's kit `carve` attribute with its tree `id` and classes (space-separated) replaced; empty values remove them. */
export function withTreeAttributes(carve: Record<string, unknown> | null, id: string, classes: string): Record<string, unknown> | null {
  const treeAttrs = { ...(carve?.attrs as Record<string, unknown> | undefined) };
  delete treeAttrs.id;
  delete treeAttrs.classes;
  if (id.trim()) treeAttrs.id = id.trim();
  if (classes.trim()) treeAttrs.classes = classes.trim().split(/\s+/);
  const next: Record<string, unknown> = { ...carve };
  delete next.attrs;
  if (Object.keys(treeAttrs).length) next.attrs = treeAttrs;
  return Object.keys(next).length ? next : null;
}

/** Toggle an ordered list. */
export function toggleOrderedList(editor: Editor): boolean {
  return editor.chain().focus().toggleOrderedList().run();
}

/** Serialize an arbitrary ProseMirror/Tiptap JSON doc in the kit's schema. */
export function jsonToCarve(json: JSONContent): string {
  return writeDocument(json);
}
