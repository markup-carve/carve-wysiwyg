import { describe, expect, it } from 'vitest';
import { upgrade } from '@markup-carve/carve/upgrade';
import { upgradeOffer } from '../src/upgrade-offer';
import { SAMPLE } from '../src/sample';

describe('upgrade offer on Load Carve', () => {
  it('lists each upgrade row once and offers the upgraded source', () => {
    const offer = upgradeOffer(upgrade('Text\n# Heading\n\nSome _underline_ and _more_.\n'));
    expect(offer).toEqual({
      output: 'Text\n\n# Heading\n\nSome {_underline_} and {_more_}.\n',
      rows: [
        'Line 2 · U-001: blank line put above a block that 0.2 reads as a lazy line directly under text',
        'Line 4 · U-065: bare underline put in braces',
      ],
      writable: true,
    });
  });

  it('lists report rows of an unchanged source without offering a rewrite', () => {
    expect(upgradeOffer(upgrade('- a\n\n  b\n'))).toEqual({
      output: '- a\n\n  b\n',
      rows: ['Line 1 · U-021: a loose list with one item is tight in 0.2, its first paragraph loses the paragraph element'],
      writable: false,
    });
  });

  it('offers nothing for a source the upgrade neither rewrites nor reports on', () => {
    expect(upgradeOffer(upgrade('# Heading\n\nPlain text.\n'))).toBeNull();
  });

  // Why the upgrade is a button and not a check on every load: it reads its input as 0.1,
  // so a 0.2 `=` heading such as the starter document's comes back escaped.
  it('rewrites 0.2 headings, so it only runs on request', () => {
    const offer = upgradeOffer(upgrade(SAMPLE));
    expect(offer?.rows).toContain('Line 6 · U-101: = at the start of a block escaped, it would open a heading in 0.2');
    expect(offer?.output).toContain('\\= Carve WYSIWYG');
  });
});
