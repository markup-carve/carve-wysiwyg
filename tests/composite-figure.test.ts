/**
 * Composite figures (Carve PART 9 section 4c, markup-carve/carve#1122) in the editor.
 *
 * The Carve <-> ProseMirror mapping is the carve-grammars 0.2 Tiptap kit: a
 * bare `::: figure` is a `figure_group` in the tree and a `carveFigureGroup`
 * in the editor, its caption a `carveCaption` beside it in a
 * `carveCaptioned` wrapper. These tests pin the shape the editor holds, the
 * round trip through the app's own import and serialize path, and an edit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Editor } from '@tiptap/core';
import { migrateTree, parse } from '@markup-carve/carve';
import { treeToProseMirror } from '@markup-carve/carve-grammars/tiptap';
import { carveToEditorDocument } from '../src/carve-import';
import { EDITOR_EXTENSIONS, editorToCarve, setCarveDocument } from '../src/editor';
import fixture from './fixtures/figure-group.ast.json';

let editor: Editor;

beforeAll(() => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  editor = new Editor({ element: el, extensions: EDITOR_EXTENSIONS });
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
  attrs?: Record<string, unknown> & { carve?: { attrs?: { id?: string; classes?: string[] } } | null };
  content?: Node[];
}

const types = (node: Node | undefined): string[] => (node?.content ?? []).map((c) => c.type);
const top = (source: string): Node => carveToEditorDocument(source).content.content![0] as Node;

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

/** The control spelling: an opener with a quoted title is a div with the class `figure`, not the composite production. */
const TITLED = GROUP.replace('::: figure', '::: figure "A titled figure div"');

describe('composite figures through the editor', () => {
  it('a bare opener is a group and a titled one is not - and the two differ', () => {
    const [group] = top(GROUP).content!;
    const titled = top(TITLED);
    expect(top(GROUP).type).toBe('carveCaptioned');
    expect(group!.type).toBe('carveFigureGroup');
    expect(titled.type).toBe('carveDiv');
    expect(titled.attrs?.carve?.attrs?.classes).toEqual(['figure']);
    expect(JSON.stringify(titled.content![0])).toContain('A titled figure div');
  });

  it('the panels are the figure children, in source order, under the group caption', () => {
    const [group, caption] = top(GROUP).content!;
    expect(types(group)).toEqual(['carveCaptioned', 'carveCaptioned']);
    expect(group!.attrs?.carve?.attrs?.id).toBe('fig-x');
    expect(group!.content!.map((panel) => panel.content![0]!.attrs?.carve?.attrs?.id)).toEqual(['fig-a', 'fig-b']);
    expect(caption!.type).toBe('carveCaption');
    expect(JSON.stringify(caption)).toContain('Group caption');
  });

  it('a bare figure container survives the round trip', () => {
    expect(roundTrip(GROUP)).toBe(GROUP);
  });

  it('so does the titled spelling, which is a different production', () => {
    expect(roundTrip(TITLED)).toBe(TITLED);
  });

  it('the group survives an edit elsewhere in the document', () => {
    setCarveDocument(editor, carveToEditorDocument(`${GROUP}\nEnd\n`));
    editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph', content: [{ type: 'text', text: 'EDITED' }] });
    const out = editorToCarve(editor);
    expect(out).toBe(`${GROUP}\nEnd\n\nEDITED\n`);
  });

  it('the captured 0.1 engine AST, migrated, maps to the same node as the live parse', () => {
    const fromAst = treeToProseMirror(migrateTree(fixture.ast as never).document as never) as Node;
    const fromSource = treeToProseMirror(parse(fixture.source)) as Node;
    expect(types(fromAst)).toEqual(['carveCaptioned']);
    expect(JSON.stringify(fromAst.content)).toBe(JSON.stringify(fromSource.content));
  });
});
