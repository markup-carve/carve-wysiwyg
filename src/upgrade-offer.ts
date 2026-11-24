import type { UpgradeResult } from '@markup-carve/carve/upgrade';

/** What the upgrade button shows for a source the 0.1 to 0.2 upgrade rewrites or reports on. */
export interface UpgradeOffer {
  output: string;
  /** One label per distinct upgrade row, in source order. */
  rows: string[];
  /** The output differs from the source and the upgrade verified it (`pass` or `explained`), so it may replace the source. */
  writable: boolean;
}

/** The offer for `result`, or `null` when the upgrade neither rewrites nor reports anything. */
export function upgradeOffer(result: UpgradeResult): UpgradeOffer | null {
  // Report rows can come with an unchanged source; `summary` rows are the self-check's own bookkeeping.
  const rows = [...new Set(result.records.filter(record => record.class !== 'summary').map(record =>
    `${record.line > 0 ? `Line ${record.line} · ` : ''}${record.entry}: ${record.message}`))];
  if (!result.changed && !rows.length) return null;
  return { output: result.output, rows, writable: result.changed && (result.check === 'pass' || result.check === 'explained') };
}
