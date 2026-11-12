import type { LintWarning } from '@markup-carve/carve';

/** A `Hint` finding is advisory: the document is well formed. */
export const isLintHint = (finding: LintWarning): boolean => finding.severity === 'Hint';

export function lintFindingLabel(finding: LintWarning): string {
  const severity = isLintHint(finding) ? 'Hint · ' : '';
  return `Line ${finding.line ?? '?'} · ${severity}${finding.rule}: ${finding.message}`;
}
