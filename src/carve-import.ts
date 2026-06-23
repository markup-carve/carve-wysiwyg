/**
 * Import direction: Carve source -> HTML the Tiptap CarveKit can parse.
 *
 * carve-js is the reference *parser/renderer*; carve-grammars' CarveKit is
 * tuned to the carve-php renderer's HTML shapes. The two renderers agree on
 * most inline constructs (`<strong>`, `<em>`, `<u>`, `<s>`, `<ins>`, `<del>`,
 * `<mark>`, `<a>`, `<code>`, lists, blockquote, headings, tables, images), but
 * differ on a few block constructs. We render with carve-js, then rewrite the
 * HTML so CarveKit's parseHTML rules recognize:
 *
 *   - admonition divs:  carve-js emits `<aside class="admonition warning">`,
 *     CarveDiv expects `<div class="carve-div warning">` (or any simple-class
 *     div). We rewrite aside.admonition -> div.carve-div with the kept class.
 *   - footnote references: carve-js emits
 *     `<a id="fnref1" ...><sup>N</sup></a>`; CarveFootnote expects
 *     `<sup class="carve-footnote" data-footnote-label="...">`. We rewrite the
 *     ref so the label (the human label, recovered from the definition) is set.
 *   - footnote definitions: carve-js emits a
 *     `<section role="doc-endnotes"><ol><li id="fnN">...` block;
 *     CarveFootnoteDefinition expects `li[data-footnote-label]`. We tag each
 *     `li` with its label and strip the backlink anchor.
 *
 * Everything else passes through unchanged.
 */
import { parse, resolve, renderHtml } from '@markup-carve/carve';

/** Render Carve source to raw carve-js HTML (no normalization). */
export function carveToHtmlRaw(source: string): string {
  return renderHtml(resolve(parse(source)));
}

/**
 * Render Carve source to HTML normalized for the Tiptap CarveKit parser.
 *
 * `doc` is an optional DOM Document (defaults to the global `document`); tests
 * pass happy-dom's document explicitly.
 */
export function carveToEditorHtml(source: string, doc: Document = document): string {
  const raw = carveToHtmlRaw(source);
  const container = doc.createElement('div');
  container.innerHTML = raw;

  rewriteAdmonitions(container, doc);
  const labels = rewriteFootnoteRefs(container);
  rewriteFootnoteDefinitions(container, labels);

  return container.innerHTML;
}

/** aside.admonition -> div.carve-div with the kept admonition class. */
function rewriteAdmonitions(root: Element, doc: Document): void {
  const asides = Array.from(root.querySelectorAll('aside.admonition'));
  for (const aside of asides) {
    const div = doc.createElement('div');
    // carve-js classes are e.g. "admonition warning"; keep the non-"admonition"
    // tokens as the carve class so CarveDiv round-trips `:::warning`.
    const kept = Array.from(aside.classList).filter((c) => c !== 'admonition');
    div.className = ['carve-div', ...kept].join(' ');
    if (kept.length) {
      div.setAttribute('data-carve-class', kept.join(' '));
    }
    div.innerHTML = aside.innerHTML;
    aside.replaceWith(div);
  }
}

/**
 * Rewrite footnote reference anchors into the shape CarveFootnote parses.
 * Returns a map from internal fn id (e.g. "fn1") to the human label, recovered
 * from the definition list ids/refs so the serializer emits the right `[^x]`.
 */
function rewriteFootnoteRefs(root: Element): Map<string, string> {
  const idToLabel = new Map<string, string>();
  // carve-js ref: <a id="fnref1" href="#fn1" role="doc-noteref"><sup>1</sup></a>
  const refs = Array.from(root.querySelectorAll('a[role="doc-noteref"]'));
  for (const ref of refs) {
    const href = ref.getAttribute('href') || '';
    const fnId = href.replace(/^#/, ''); // "fn1"
    // The visible label is the displayed text (a number for auto-numbered
    // notes). Carve labels can be arbitrary; carve-js renders them as the
    // sequence number, which is the only label available in the output HTML.
    const label = (ref.textContent || '').trim() || fnId.replace(/^fn/, '');
    idToLabel.set(fnId, label);

    // Emit exactly the shape CarveFootnote's own renderHTML produces: a
    // `sup.carve-footnote` atom with `contenteditable="false"` and visible
    // `[^label]` text. A bare `<sup>` is also claimed by the Superscript mark,
    // so the vendored CarveFootnote parse rule is given a higher priority (see
    // vendor patch) and an empty inline atom is pruned by the DOM parser, hence
    // the visible text + contenteditable marker.
    const sup = ref.ownerDocument!.createElement('sup');
    sup.className = 'carve-footnote';
    sup.setAttribute('data-footnote-label', label);
    sup.setAttribute('contenteditable', 'false');
    sup.textContent = `[^${label}]`;
    ref.replaceWith(sup);
  }
  return idToLabel;
}

/**
 * Rewrite the carve-js endnotes section into standalone definition `li`s.
 *
 * carve-js wraps the notes in `<section role="doc-endnotes"><hr><ol><li>...`.
 * Left intact, the `<ol>` parses as an ordinary (empty) ordered list and the
 * `<hr>` as a horizontal rule. We hoist each `li[data-footnote-label]` out as a
 * top-level sibling (CarveFootnoteDefinition matches it directly) and drop the
 * now-empty section, the `<hr>`, and the backlink anchors.
 */
function rewriteFootnoteDefinitions(root: Element, idToLabel: Map<string, string>): void {
  const sections = Array.from(root.querySelectorAll('section[role="doc-endnotes"]'));
  for (const section of sections) {
    const items = Array.from(section.querySelectorAll('ol > li'));
    for (const li of items) {
      const id = li.getAttribute('id') || ''; // "fn1"
      const label = idToLabel.get(id) || id.replace(/^fn/, '') || 'note';
      li.setAttribute('data-footnote-label', label);
      li.removeAttribute('id');
      // Remove backlink anchors (↩) so they do not become editor text.
      li.querySelectorAll('a[role="doc-backlink"]').forEach((a) => a.remove());
      // Hoist the li to top level, just before the section, so it is not
      // wrapped in an <ol> that would parse as an ordered list.
      section.parentNode?.insertBefore(li, section);
    }
    section.remove();
  }
}
