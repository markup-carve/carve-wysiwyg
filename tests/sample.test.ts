import { describe, expect, it } from 'vitest';
import { parse } from '@markup-carve/carve';
import { SAMPLE } from '../src/sample';

type Node = { type: string; rows?: { cells: unknown[] }[]; children?: Node[] };

function tables(node: Node): Node[] {
  const own = node.type === 'table' ? [node] : [];
  return own.concat((node.children ?? []).flatMap(tables));
}

describe('starter document', () => {
  it('fills every table row to the width of its header row', () => {
    const found = tables(parse(SAMPLE) as unknown as Node);
    expect(found.length).toBeGreaterThan(0);
    for (const table of found) {
      const widths = table.rows!.map(row => row.cells.length);
      expect(new Set(widths).size).toBe(1);
    }
  });
});
