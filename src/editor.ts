/**
 * Tiptap editor wiring for the Carve WYSIWYG app.
 *
 * Carve 0.2 has no Tiptap editor kit yet (markup-carve/carve-grammars#906), so
 * the editor runs on the HTML pivot: it is seeded with the engine's HTML render
 * and every change goes back through the engine's HTML importer. Front matter has
 * no HTML form, so it is held beside the editor and written back unchanged.
 */
import { Editor, Extension, Mark, generateHTML } from '@tiptap/core';
import type { Extensions, JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Underline from '@tiptap/extension-underline';
import { importDocument } from '@markup-carve/carve';
import { CarveCodeHighlight } from './code-highlight';

export interface CarveEditorOptions {
  element: HTMLElement;
  content?: string;
  onUpdate?: (carve: string) => void;
}

/** A Carve document prepared for the editor: its source, front matter and body HTML. */
export interface EditorDocument {
  source: string;
  frontmatter: string;
  html: string;
}

/** `{+ +}` and `{- -}`, which the importer reads back from `<ins>` and `<del>`. */
const CarveInsert = Mark.create({
  name: 'carveInsert',
  parseHTML: () => [{ tag: 'ins' }],
  renderHTML: () => ['ins', 0],
  addKeyboardShortcuts() {
    return { 'Mod-Shift-i': () => this.editor.commands.toggleMark(this.name) };
  },
});
const CarveDelete = Mark.create({
  name: 'carveDelete',
  parseHTML: () => [{ tag: 'del' }],
  renderHTML: () => ['del', 0],
  addKeyboardShortcuts() {
    return { 'Mod-Shift-d': () => this.editor.commands.toggleMark(this.name) };
  },
});

/** The shortcuts the toolbar names (index.html) beyond Tiptap's defaults. */
const CarveShortcuts = Extension.create({
  name: 'carveShortcuts',
  addKeyboardShortcuts() {
    const heading = (level: 1 | 2 | 3 | 4 | 5 | 6) => () => this.editor.commands.toggleHeading({ level });
    return {
      'Mod-1': heading(1), 'Mod-2': heading(2), 'Mod-3': heading(3),
      'Mod-4': heading(4), 'Mod-5': heading(5), 'Mod-6': heading(6),
      'Mod-Shift-e': () => this.editor.commands.toggleCodeBlock(),
      'Mod-Shift-k': () => {
        if (this.editor.isActive('link')) return this.editor.commands.unsetLink();
        const href = typeof window === 'undefined' ? null : window.prompt('Link URL:');
        return href ? this.editor.commands.setLink({ href }) : false;
      },
    };
  },
});

/** A fence's class (`{.diff}`) and title live on `<pre>`; the importer reads them back from there. */
const CarveCodeBlockAttributes = Extension.create({
  name: 'carveCodeBlockAttributes',
  addGlobalAttributes() {
    return [{
      types: ['codeBlock'],
      attributes: {
        class: { default: null, parseHTML: (element: HTMLElement) => element.getAttribute('class'), renderHTML: (attrs: Record<string, unknown>) => attrs.class ? { class: attrs.class } : {} },
        title: { default: null, parseHTML: (element: HTMLElement) => element.getAttribute('title'), renderHTML: (attrs: Record<string, unknown>) => attrs.title ? { title: attrs.title } : {} },
      },
    }];
  },
});

/** The engine writes a task list as `ul.task-list` with `li.task` items (C2-H-032). */
const CarveTaskList = TaskList.extend({
  parseHTML() {
    return [...(this.parent?.() ?? []), { tag: 'ul.task-list', priority: 51 }];
  },
});

/** Task states beyond done and open ride on `data-task-state` (C2-M-032). */
const CarveTaskItem = TaskItem.extend({
  parseHTML() {
    return [...(this.parent?.() ?? []), { tag: 'li.task', priority: 51 }];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-checked') === 'true'
          || element.getAttribute('data-task-state') === 'x'
          || element.querySelector(':scope > input[type="checkbox"]')?.hasAttribute('checked') === true,
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-checked': attrs.checked }),
      },
      carveTaskState: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const state = element.getAttribute('data-task-state');
          return state && state !== 'x' && state !== ' ' ? state : null;
        },
        renderHTML: (attrs: Record<string, unknown>) => attrs.carveTaskState ? { 'data-task-state': attrs.carveTaskState } : {},
      },
    };
  },
});

export const EDITOR_EXTENSIONS: Extensions = [
  StarterKit.configure({ link: false, underline: false }),
  Underline,
  Highlight,
  Subscript,
  Superscript,
  Link.configure({ openOnClick: false }),
  Image,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  CarveTaskList,
  CarveTaskItem.configure({ nested: true }),
  CarveInsert,
  CarveDelete,
  CarveCodeBlockAttributes,
  CarveShortcuts,
  CarveCodeHighlight,
];

/**
 * Editor HTML in the shape the engine's importer reads: Tiptap's task items and
 * table chrome become the elements a Carve render writes, so the importer keeps
 * them as tasks and a head row instead of keeping Tiptap's attributes as keys.
 */
export function normalizeEditorHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content;
  root.querySelectorAll('ul[data-type="taskList"]').forEach(list => list.removeAttribute('data-type'));
  root.querySelectorAll('li[data-type="taskItem"]').forEach(item => {
    const box = document.createElement('input');
    box.type = 'checkbox';
    if (item.getAttribute('data-checked') === 'true') box.setAttribute('checked', '');
    item.querySelector(':scope > label')?.remove();
    const body = item.querySelector(':scope > div');
    if (body) body.replaceWith(...body.childNodes);
    item.prepend(box);
    item.removeAttribute('data-type');
    item.removeAttribute('data-checked');
  });
  // An empty item (what Enter leaves) would write a bare marker; Tiptap's trailing paragraph writes nothing.
  root.querySelectorAll('li').forEach(item => {
    if (!item.textContent?.trim() && !item.querySelector('img, input:not([type="checkbox"])')) item.remove();
  });
  root.querySelectorAll(':scope > p').forEach(paragraph => {
    if (!paragraph.textContent?.trim() && !paragraph.querySelector('img')) paragraph.remove();
  });
  // Tiptap wraps every item in a paragraph; a render writes a tight item's text bare (C2-M-033).
  root.querySelectorAll('li').forEach(item => {
    const blocks = [...item.children].filter(child => child.tagName !== 'INPUT');
    const [first, ...rest] = blocks;
    if (first?.tagName === 'P' && !first.attributes.length && rest.every(child => child.tagName === 'UL' || child.tagName === 'OL')) first.replaceWith(...first.childNodes);
  });
  root.querySelectorAll('table').forEach(table => {
    table.removeAttribute('style');
    table.querySelectorAll(':scope > colgroup').forEach(group => group.remove());
    const body = table.querySelector(':scope > tbody');
    const first = body?.querySelector(':scope > tr');
    if (body && first && !table.querySelector(':scope > thead') && first.children.length
      && [...first.children].every(cell => cell.tagName === 'TH')) {
      const head = document.createElement('thead');
      head.append(first);
      table.insertBefore(head, body);
    }
  });
  root.querySelectorAll('th > p:only-child, td > p:only-child').forEach(paragraph => paragraph.replaceWith(...paragraph.childNodes));
  return template.innerHTML;
}

/** Carve source for editor HTML, through the engine's HTML importer with raw HTML off. */
export function htmlToCarve(html: string): string {
  return importDocument(normalizeEditorHtml(html), { from: 'html', rawHtml: false }).source;
}

/**
 * The document loaded into each editor. An unedited document writes back its
 * source byte for byte; the HTML importer only runs once the author edits it.
 */
const loaded = new WeakMap<Editor, { doc: EditorDocument; snapshot: string }>();

export function createCarveEditor(opts: CarveEditorOptions): Editor {
  return new Editor({
    element: opts.element,
    extensions: EDITOR_EXTENSIONS,
    content: opts.content ?? '',
    onUpdate: ({ editor }) => {
      opts.onUpdate?.(editorToCarve(editor));
    },
  });
}

/** Load a prepared document into the editor. */
export function setCarveDocument(editor: Editor, doc: EditorDocument): void {
  editor.commands.setContent(doc.html || '<p></p>', { emitUpdate: false });
  loaded.set(editor, { doc, snapshot: JSON.stringify(editor.getJSON()) });
}

/** The front matter of the loaded document, or '' when it has none. */
export function editorFrontmatter(editor: Editor): string {
  return loaded.get(editor)?.doc.frontmatter ?? '';
}

/** Replace the front matter written ahead of the editor body. */
export function setEditorFrontmatter(editor: Editor, frontmatter: string): void {
  const entry = loaded.get(editor);
  const doc = entry?.doc ?? { source: '', frontmatter: '', html: '' };
  loaded.set(editor, { doc: { ...doc, frontmatter, source: '' }, snapshot: entry?.snapshot ?? '' });
}

/** Serialize the current editor document to Carve markup. */
export function editorToCarve(editor: Editor): string {
  const entry = loaded.get(editor);
  if (entry?.doc.source && JSON.stringify(editor.getJSON()) === entry.snapshot) return entry.doc.source;
  const body = htmlToCarve(editor.getHTML());
  const frontmatter = entry?.doc.frontmatter ?? '';
  return frontmatter ? `${frontmatter}${body}` : body;
}

/** Toggle an ordered list. */
export function toggleOrderedList(editor: Editor): boolean {
  return editor.chain().focus().toggleOrderedList().run();
}

/** Serialize an arbitrary ProseMirror/Tiptap JSON doc. */
export function jsonToCarve(json: JSONContent): string {
  return htmlToCarve(generateHTML(json, EDITOR_EXTENSIONS));
}
