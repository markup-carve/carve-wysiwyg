/**
 * The two panels the app shows for a document - the rendered preview and the
 * lint list - both come from the engine this repo pins, and the pin is a
 * carve-js COMMIT. Its `version` field is bumped on carve-js `main` long before
 * the matching tag, so an installed build can read `0.1.10` while behaving like
 * the release before it: the pin this repo carried until now reported `0.1.10`
 * and still resolved a case-only cross-reference (markup-carve/carve-js#2495).
 *
 * These assert the behavior rather than the version string.
 */
import { describe, it, expect } from 'vitest';
import { lintCarve } from '@markup-carve/carve';
import { carveToHtmlRaw } from '../src/carve-import';

const CASE_ONLY = '# Setup Guide\n\nSee </#setup-guide>.\n';
const EXACT = '# Setup Guide\n\nSee </#Setup-Guide>.\n';

describe('the pinned engine compares every name lookup with exact case', () => {
  it('flags a cross-reference that differs from the heading id only in case', () => {
    expect(lintCarve(CASE_ONLY).map(finding => finding.rule)).toContain('broken-crossref');
    expect(lintCarve(EXACT)).toEqual([]);
  });

  it('renders that cross-reference as literal text in the preview', () => {
    expect(carveToHtmlRaw(CASE_ONLY)).toContain('&lt;/#setup-guide&gt;');
    expect(carveToHtmlRaw(CASE_ONLY)).not.toContain('href="#Setup-Guide"');
    expect(carveToHtmlRaw(EXACT)).toContain('href="#Setup-Guide"');
  });

  it('flags a reference image with no matching definition', () => {
    expect(lintCarve('![alt][Label]\n').map(finding => finding.rule)).toContain(
      'unresolved-reference-link',
    );
    expect(lintCarve('![alt][]\n').map(finding => finding.rule)).toContain(
      'unresolved-reference-link',
    );
  });
});
