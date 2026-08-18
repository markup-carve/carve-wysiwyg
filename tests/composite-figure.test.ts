/**
 * Composite figures (Carve PART 9 section 4c, markup-carve/carve#1122) in the editor.
 *
 * WHERE THE MAPPING LIVES, because this repository is still not it. The
 * Carve <-> ProseMirror bridge - the CarveKit schema, `carveToProseMirror` and
 * `serializeToCarve` - is `@markup-carve/carve-grammars`, and the engine that
 * parses the source on the way in is the one carve-grammars nests for its own
 * loader. What changed is that carve-grammars now ships both halves: an engine
 * that parses a bare `::: figure` into a `figure_group`, and a
 * `carveFigureGroup` schema entry that models it
 * (markup-carve/carve-grammars#225).
 *
 * This file used to pin the DEGRADED state - a group arriving as one opaque
 * source atom - and said in as many words that it would go red the day
 * carve-grammars gave the group a schema entry, which is the signal to wire the
 * editor up to it. That day is this commit, and what follows is the wiring:
 * the rich shape the editor holds, the round trip through the app's own import
 * and serialize path, and an EDIT, which is the case the opaque atom could
 * never survive.
 *
 * Closes markup-carve/carve-wysiwyg#15.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Editor } from '@tiptap/core';
import { CarveKit, astToProseMirror } from '@markup-carve/carve-grammars/tiptap';
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

interface Node {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
}

const types = (node: Node | undefined): string[] => (node?.content ?? []).map((c) => c.type);

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
 * IT DISCRIMINATES NOW, which it did not before. The engine the editor ran
 * predated section 4c, so both spellings parsed to the same generic container
 * and the pair proved only that neither was mangled; the comment here said so.
 * The installed engine tells them apart, and the first case below asserts the
 * two READINGS differ rather than only asserting each one - so if the pin ever
 * moves back to an engine without section 4c, this fails instead of quietly
 * agreeing with itself.
 */
const TITLED = GROUP.replace('::: figure', '::: figure "A titled figure div"');

describe('composite figures through the editor', () => {
  it('a bare opener is a group and a titled one is not - and the two differ', () => {
    const group = carveToEditorDocument(GROUP) as Node;
    const titled = carveToEditorDocument(TITLED) as Node;

    expect(group.content![0]!.type).toBe('carveFigureGroup');
    expect(titled.content![0]!.type).toBe('carveDiv');
    expect(group.content![0]!.type).not.toBe(titled.content![0]!.type);
    // The titled reading keeps its metadata, which is what makes it a lossless
    // degradation rather than a different document.
    expect(titled.content![0]!.attrs?.title).toBe('A titled figure div');
  });

  it('the panels are the figure children, in source order, under the group caption', () => {
    const group = (carveToEditorDocument(GROUP) as Node).content![0]!;
    expect(types(group)).toEqual(['carveFigure', 'carveFigure', 'carveCaption']);
    expect(group.attrs?.id).toBe('fig-x');
    expect(group.content!.filter((c) => c.type === 'carveFigure').map((p) => p.attrs?.id))
      .toEqual(['fig-a', 'fig-b']);
    const caption = group.content![group.content!.length - 1]!;
    expect(JSON.stringify(caption)).toContain('Group caption');
  });

  it('a bare figure container survives the round trip', () => {
    // The serializer writes no trailing newline, which is true of every
    // document it writes and not of this construct.
    expect(roundTrip(GROUP)).toBe(GROUP.replace(/\n$/, ''));
  });

  it('so does the titled spelling, which is a different production', () => {
    // Not byte-equal to the input, and deliberately asserted as the output
    // rather than as the fixture. The titled opener degrades to a plain div, so
    // the trailing `^ Group caption` is an ordinary paragraph and not a caption
    // - `renderHtml` gives the identical document with or without a blank line
    // in front of it. carve-grammars 7ef51b6 now writes that blank line, and
    // drops the trailing newline, which brings this spelling in line with the
    // bare one above ("the serializer writes no trailing newline, which is true
    // of every document it writes"). The round trip is a fixed point from the
    // first pass, so nothing accumulates.
    const written = TITLED.replace(':::\n^ Group caption\n', ':::\n\n^ Group caption');
    expect(roundTrip(TITLED)).toBe(written);
    expect(roundTrip(written)).toBe(written);
  });

  it('the group survives an edit, which is what the opaque atom could not do', () => {
    // The case the whole ticket is about. As one `carveUnsupported` atom the
    // group's source lived in the document envelope, which is keyed to a
    // fingerprint of the untouched document - so the FIRST edit anywhere
    // discarded it. Loading and serializing an untouched document returns the
    // envelope verbatim and would pass either way, which is why this edits.
    setCarveDocument(editor, carveToEditorDocument(GROUP));
    editor.commands.insertContentAt(1, 'EDITED');
    const out = editorToCarve(editor);
    expect(out).toContain('EDITED');
    expect(out).toContain('::: figure');
    expect(out).toContain('![one](a.png)');
    expect(out).toContain('![two](b.png)');
    expect(out).toContain('^ Group caption');
    expect(out).toContain('{#fig-x}');
  });

  it('the captured engine AST maps to the same node as the live parse', () => {
    // fixture.capturedFrom names the carve-js commit this AST came from. It was
    // supplied because the installed engine could not produce it; it now can,
    // so the fixture's job changes from standing in for the engine to checking
    // that a document arriving as an AST - `--from-json`, another engine, a
    // stored document - maps exactly as source does.
    const fromAst = astToProseMirror(fixture.ast, {
      unsupported: 'preserve',
      source: fixture.source,
    }) as Node;
    const fromSource = carveToEditorDocument(fixture.source) as Node;

    expect(fromAst.content!.map((n) => n.type)).toEqual(['carveFigureGroup']);
    expect(JSON.stringify(fromAst.content)).toBe(JSON.stringify(fromSource.content));
  });
});
