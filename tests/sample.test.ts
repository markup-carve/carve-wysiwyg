import { describe, expect, it } from 'vitest';
import { parse } from '@markup-carve/carve';
import { SAMPLE } from '../src/sample';

type Node = { type: string; children?: Node[]; colspan?: number };

function tables(node: Node): Node[] {
  const own = node.type === 'table' ? [node] : [];
  return own.concat((node.children ?? []).flatMap(tables));
}

// A 0.2 table holds its rows in head, body and foot groups, and a spanned cell counts its columns (C2-A-086).
function rows(table: Node): Node[] {
  return (table.children ?? []).flatMap(group => (group.children ?? []).filter(row => row.type === 'table_row'));
}

describe('starter document', () => {
  it('fills every table row to the width of its header row', () => {
    const found = tables(parse(SAMPLE) as unknown as Node);
    expect(found.length).toBeGreaterThan(0);
    for (const table of found) {
      const widths = rows(table).map(row => (row.children ?? []).reduce((sum, cell) => sum + (cell.colspan ?? 1), 0));
      expect(new Set(widths).size).toBe(1);
    }
  });
});
