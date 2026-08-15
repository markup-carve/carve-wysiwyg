/**
 * Composite figures (Carve PART 9 section 4c, markup-carve/carve#1215) in the editor.
 *
 * WHERE THE MAPPING LIVES, because this repository is not it. The
 * Carve <-> ProseMirror bridge - the CarveKit schema, `carveToProseMirror` and
 * `serializeToCarve` - is `@markup-carve/carve-grammars`, and the engine that
 * parses the source on the way in is the one carve-grammars nests for its own
 * loader, not the `@markup-carve/carve` this app installs for the preview
 * pane. So a `figure_group` node type reaches the editor only when
 * carve-grammars ships both an engine that parses it and a schema entry that
 * models it. Nothing in `src/` can do either.
 *
 * What this file does instead is measure that boundary rather than assert it,
 * in the two states it can be in:
 *
 *   1. THE ENGINE THE EDITOR ACTUALLY RUNS TODAY predates section 4c, so a bare
 *      `::: figure` is a generic container and survives the round trip. That is
 *      the state, and it is worth a test because "it happens to work" and "it is
 *      modelled" look identical from the outside.
 *   2. WHAT ARRIVES WHEN THE ENGINE MOVES, exercised through a `figure_group`
 *      AST captured from an engine that has the node. It reaches the editor as
 *      one opaque source atom - lossless, and not editable as a figure.
 *
 * The second test is the handshake: it goes red the day carve-grammars gives
 * the group a real schema entry, which is the signal to wire the editor up to
 * it. See markup-carve/carve-wysiwyg#15.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Editor } from '@tiptap/core';
import { CarveKit, serializeToCarve, astToProseMirror } from '@markup-carve/carve-grammars/tiptap';
import { carveToEditorDocument } from '../src/carve-import';
import { editorToCarve, setCarveDocument } from '../src/editor';
import fixture from './fixtures/figure-group.ast.json';

let editor: Editor;

beforeAll(() => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  editor = new Editor({ element: el, extensions: [CarveKit] });
});

afterAll(() => {
  editor?.destroy();
});

/** The app's own import + serialize path, exactly as main.ts drives it. */
function roundTrip(source: string): string {
  setCarveDocument(editor, carveToEditorDocument(source));
  return editorToCarve(editor);
}

const GROUP = [
  '{#fig-x}',
  '::: figure',
  '{#fig-a}',
  '![one](a.png)',
  '^ (a) One',
  '',
  '{#fig-b}',
  '![two](b.png)',
  '^ (b) Two',
  ':::',
  '^ Group caption',
  '',
].join('\n');

/**
 * The CONTROL spelling. Under section 4c an opener carrying a quoted title is
 * NOT the composite production - it stays a generic container.
 *
 * IT DOES NOT DISCRIMINATE ANYTHING YET, and saying so is the point. The engine
 * the editor runs predates section 4c, so both spellings parse to the same
 * generic container and this pair proves only that neither is mangled. Reading
 * a passing pair as evidence that the two are told apart is the exact mistake
 * this construct invites, so the discrimination is asserted where it can be -
 * against the captured AST below - and not here.
 */
const TITLED = GROUP.replace('::: figure', '::: figure "A titled figure div"');

describe('composite figures through the editor', () => {
  it('a bare figure container survives the round trip under the engine in use', () => {
    expect(roundTrip(GROUP)).toBe(GROUP);
  });

  it('so does the titled spelling, which is a different production', () => {
    expect(roundTrip(TITLED)).toBe(TITLED);
  });

  it('the engine in use does not produce the node yet', () => {
    // The premise the two tests above rest on, checked rather than assumed: if
    // this ever fails, they stopped describing a pre-section-4c engine and the
    // group test above may be passing for a different reason than it says.
    const doc = carveToEditorDocument(GROUP) as { content?: Array<{ type?: string }> };
    expect(doc.content?.[0]?.type).toBe('carveDiv');
  });

  it('a figure_group reaches the editor as one opaque atom, not as a figure', () => {
    // The AST an engine WITH section 4c hands the bridge, captured from
    // fixture.capturedFrom - the installed engine cannot produce it, so it is
    // supplied rather than parsed.
    //
    // WHEN THIS FAILS, carve-grammars has given the group a schema entry.
    // That is the moment to model it here: drop this expectation, assert the
    // rich shape, and give the preview pane styles for
    // carve-figure-group / carve-figure-panels / carve-figure-panel.
    const doc = astToProseMirror(fixture.ast, {
      unsupported: 'preserve',
      source: fixture.source,
    }) as { content: Array<{ type: string; attrs?: { carveSource?: string } }> };

    expect(doc.content.map((n) => n.type)).toEqual(['carveUnsupported']);

    // Lossless as SOURCE, which is the guarantee `preserve` actually makes -
    // the group is not silently dropped and not flattened into its panels.
    const kept = doc.content[0]!.attrs!.carveSource!;
    expect(kept).toContain('::: figure');
    expect(kept).toContain('![one](a.png)');
    expect(kept).toContain('^ Group caption');
    expect(serializeToCarve(doc)).toBe(kept);

    // And the loss that IS there, named rather than left to be discovered: a
    // block's position excludes the block-attribute line above it (every block
    // type, not just this one), so the slice starts at the opening fence and
    // the group's own `{#fig-x}` is not in it.
    expect(kept.startsWith('::: figure')).toBe(true);
    expect(kept).not.toContain('{#fig-x}');
  });
});
