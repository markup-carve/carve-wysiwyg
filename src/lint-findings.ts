import type { Diagnostic } from '@markup-carve/carve';

/** A `hint` finding is advisory: the document is well formed. */
export const isLintHint = (finding: Diagnostic): boolean => finding.severity === 'hint';

/** The finding's range in UTF-16 units of `source`; 0.2 ranges count UTF-8 bytes (C2-A-173). */
export function lintFindingRange(finding: Diagnostic, source: string): { start: number; end: number } {
  const toIndex = (byteOffset: number): number => {
    let bytes = 0;
    let index = 0;
    while (index < source.length && bytes < byteOffset) {
      const code = source.codePointAt(index) as number;
      bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
      index += code > 0xffff ? 2 : 1;
    }
    return index;
  };
  const start = toIndex(finding.range?.startOffset ?? 0);
  return { start, end: Math.max(start, toIndex(finding.range?.endOffset ?? 0)) };
}

export function lintFindingLabel(finding: Diagnostic, source: string): string {
  const severity = isLintHint(finding) ? 'Hint · ' : '';
  const line = finding.range ? source.slice(0, lintFindingRange(finding, source).start).split('\n').length : '?';
  return `Line ${line} · ${severity}${finding.code}: ${finding.message}`;
}
