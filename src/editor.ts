/**
 * Tiptap editor wiring for the Carve WYSIWYG app.
 *
 * The editor is initialized with carve-grammars' CarveKit (which internally
 * pulls StarterKit, Underline, Link, lists, tables, task lists, code block,
 * highlight, sub/superscript, image, plus the Carve-specific marks/nodes) and
 * exposes the serializer so the live Carve source pane can update on every
 * change.
 */
import { Editor, getSchema } from '@tiptap/core';
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
const loaded = new WeakMap<Editor, { doc: JSONContent; envelope: Envelope }>();

/**
 * The CarveKit schema, read once, so the attribute values Tiptap materializes
 * from a node's declared defaults can be told from values the bridge set.
 */
const schema = getSchema([CarveKit]);

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

/** Every attribute the schema declares for a node or mark, with its default. */
function schemaDefaults(type: unknown): Record<string, unknown> | null {
  if (typeof type !== 'string') return null;
  const spec = schema.nodes[type] ?? schema.marks[type];
  if (!spec) return null;
  const out: Record<string, unknown> = {};
  for (const [name, attr] of Object.entries(spec.spec.attrs ?? {})) {
    out[name] = (attr as { default?: unknown }).default;
  }
  return out;
}

/**
 * A document reduced to what the AUTHOR wrote, with everything the schema would
 * put back stripped out.
 *
 * The point is to recognize an unedited document after a mount. Tiptap hands
 * back every attribute a node's schema declares, so `{"class":"figure"}` comes
 * back as `{"id":null,"keyValues":null,"label":null,"class":"figure",
 * "title":null}` and the mounted document never compares equal to the one that
 * was loaded.
 *
 * DROPPING NULLS IS NOT ENOUGH, and that is what this used to do. A default
 * does not have to be null: `carveCaption` declares `short` with a default of
 * `false`, so a caption came back carrying `{"short":false}` - not null, not
 * pruned, never equal. The moment carve-grammars added that attribute, every
 * document holding a caption stopped being recognized, the source envelope was
 * discarded, and a block-attribute line above a construct the rich model does
 * not carry was written back out without it. Nothing failed: the round trip
 * simply became lossy, which is the failure mode the envelope exists to
 * prevent.
 *
 * SYMMETRY IS THE OTHER HALF. This runs over BOTH documents, never over the
 * mounted one alone. The bridge does set some attributes to a value that is
 * also the schema default - `carveComment` writes `block: false` for a `%%`
 * line - so pruning only the mounted side would break exactly the documents
 * pruning is meant to keep.
 */
function authored(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(authored);
  if (!value || typeof value !== 'object') return value;
  const node = value as Record<string, unknown>;
  const defaults = schemaDefaults(node['type']);
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(node)) {
    if (inner === null) continue;
    if (key !== 'attrs' || !inner || typeof inner !== 'object') {
      out[key] = authored(inner);
      continue;
    }
    const attrs: Record<string, unknown> = {};
    for (const [name, attrValue] of Object.entries(inner as Record<string, unknown>)) {
      if (attrValue === null) continue;
      if (defaults && name in defaults && stable(attrValue) === stable(defaults[name])) continue;
      attrs[name] = authored(attrValue);
    }
    if (Object.keys(attrs).length) out['attrs'] = attrs;
  }
  return out;
}

/** Key-order-independent string form, so two equal documents compare equal. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  return '{' + Object.keys(value as object).sort()
    .map((k) => JSON.stringify(k) + ':' + stable((value as Record<string, unknown>)[k]))
    .join(',') + '}';
}

/**
 * What to serialize: the document as loaded when the editor still holds it, and
 * the editor's own JSON once it has been edited.
 *
 * Handing the serializer the ORIGINAL document rather than a reconstruction of
 * it is what makes the envelope usable. Its fingerprint was taken over that
 * exact JSON, and the envelope is only honored while the fingerprint matches -
 * so anything less than the original is a guess at what the fingerprint will
 * accept. After an edit there is nothing to preserve: the editor's document IS
 * the document, and ordinary serialization is correct.
 */
function withEnvelope(editor: Editor, json: JSONContent): JSONContent {
  const entry = loaded.get(editor);
  if (!entry) return json;
  const unedited = stable(authored(json.content ?? []))
    === stable(authored(entry.doc.content ?? []));
  return unedited ? entry.doc : json;
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
  if (envelope) loaded.set(editor, { doc, envelope });
  else loaded.delete(editor);
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
