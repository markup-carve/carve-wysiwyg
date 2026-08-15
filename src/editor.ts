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
import type { JSONContent } from '@tiptap/core';
import { CarveKit, serializeToCarve } from '@markup-carve/carve-grammars/tiptap';

export interface CarveEditorOptions {
  element: HTMLElement;
  content?: string;
  onUpdate?: (carve: string) => void;
}

/** The document-level attribute names CarveKit's source envelope uses. */
const ENVELOPE_ATTRS = ['carveSource', 'carveFingerprint', 'carveSourceLayout'] as const;

type Envelope = Record<string, unknown>;

/**
 * The source envelope of the document currently loaded into each editor.
 *
 * WHY THIS IS HELD HERE RATHER THAN ON THE DOCUMENT. `carveToProseMirror`
 * returns a doc carrying `carveSource` / `carveFingerprint` /
 * `carveSourceLayout` whenever the rich model would be lossy to write back, and
 * `serializeToCarve` writes that source verbatim for as long as the fingerprint
 * still matches the document - which is how a construct with no exact editor
 * model survives load/save instead of being normalized away.
 *
 * Tiptap's `setContent` does not carry them. It dispatches
 * `tr.replaceWith(0, doc.content.size, document)`, which replaces the doc's
 * CONTENT and leaves the doc NODE - and therefore its attributes - as it was,
 * so the envelope never reaches `editor.getJSON()`. Measured, not assumed: the
 * import produces the three attrs and the editor hands back all three as
 * `null`.
 *
 * The visible symptom was a block-attribute line above a fenced div. CarveKit's
 * `carveDiv` models the class but not the `{#id}`, so the rich document is
 * lossy, the bridge produced an envelope, the envelope was dropped, and
 *
 *   {#fig-x}
 *   ::: figure
 *   ![one](a.png)
 *   ^ (a) One
 *   :::
 *
 * came back out without its `{#fig-x}` on the first save.
 *
 * A WeakMap rather than a field on the editor so nothing is retained after an
 * editor is destroyed. Re-attaching is safe without any staleness check of its
 * own: the fingerprint is that check, and the serializer falls through to
 * ordinary serialization the moment the document is edited.
 */
const envelopes = new WeakMap<Editor, Envelope>();

/** The envelope attrs of a bridge document, or null when it carries none. */
function envelopeOf(doc: JSONContent): Envelope | null {
  const attrs = (doc as { attrs?: Envelope }).attrs;
  if (!attrs) return null;
  const kept: Envelope = {};
  for (const name of ENVELOPE_ATTRS) {
    if (attrs[name] != null) kept[name] = attrs[name];
  }
  return Object.keys(kept).length ? kept : null;
}

/**
 * Drop attributes the editor materialized from schema defaults.
 *
 * The envelope is guarded by a FINGERPRINT of the document it was taken from,
 * and the fingerprint is over the bridge's JSON - which carries only the attrs
 * that were actually set. Tiptap hands back every attribute the schema
 * declares, so `{"class":"figure"}` returns as
 * `{"id":null,"keyValues":null,"label":null,"class":"figure","title":null}` and
 * the two never compare equal. Re-attaching the envelope without this is
 * therefore inert: the fingerprint check fails every time and the verbatim
 * source is never used.
 *
 * Dropping nulls is not a reinterpretation of the document. The serializer
 * reads every one of these with optional chaining, so an absent attribute and a
 * null one already mean the same thing to it - what changes is only whether the
 * fingerprint can recognize its own document.
 */
function pruneDefaults(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pruneDefaults);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (inner === null) continue;
    out[key] = pruneDefaults(inner);
  }
  const attrs = out['attrs'];
  if (attrs && typeof attrs === 'object' && !Object.keys(attrs).length) delete out['attrs'];
  return out;
}

/** `editor.getJSON()` with the loaded document's envelope put back on it. */
function withEnvelope(editor: Editor, json: JSONContent): JSONContent {
  const envelope = envelopes.get(editor);
  if (!envelope) return json;
  const pruned = pruneDefaults(json) as JSONContent;
  return { ...pruned, attrs: { ...(pruned.attrs ?? {}), ...envelope } };
}

export function createCarveEditor(opts: CarveEditorOptions): Editor {
  const editor: Editor = new Editor({
    element: opts.element,
    extensions: [CarveKit],
    content: opts.content ?? '',
    onUpdate: ({ editor }) => {
      opts.onUpdate?.(editorToCarve(editor));
    },
  });
  return editor;
}

/**
 * Load a bridge document into the editor, keeping its source envelope.
 *
 * Every load goes through here rather than through `setContent` directly, so
 * the previous document's envelope cannot outlive it.
 */
export function setCarveDocument(editor: Editor, doc: JSONContent): void {
  const envelope = envelopeOf(doc);
  if (envelope) envelopes.set(editor, envelope);
  else envelopes.delete(editor);
  editor.commands.setContent(doc);
}

/** Serialize the current editor document to Carve markup. */
export function editorToCarve(editor: Editor): string {
  return serializeToCarve(withEnvelope(editor, editor.getJSON()));
}

/** Re-serialize an arbitrary ProseMirror/Tiptap JSON doc. */
export function jsonToCarve(json: unknown): string {
  return serializeToCarve(json);
}
