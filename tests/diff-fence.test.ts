import { describe, it, expect } from 'vitest';
import { carveToHtmlRaw } from '../src/carve-import';
import { isDiffPre } from '../src/diff-fence';

function firstPre(carve: string): Element {
  const host = document.createElement('div');
  host.innerHTML = carveToHtmlRaw(carve);
  const pre = host.querySelector('pre');
  if (!pre) throw new Error('no <pre> rendered');
  return pre;
}

const FENCE = '```php\n-a\n+b\n```';

describe('isDiffPre', () => {
  it('accepts an uncaptioned {.diff} fence', () => {
    expect(isDiffPre(firstPre(`{.diff}\n${FENCE}`))).toBe(true);
  });

  it('accepts a captioned {.diff} fence, whose class sits on the figure', () => {
    const pre = firstPre(`{#lst-a .diff}\n${FENCE}\n^ Listing #: x`);
    expect(pre.classList.contains('diff')).toBe(false);
    expect(pre.parentElement?.matches('figure.diff')).toBe(true);
    expect(isDiffPre(pre)).toBe(true);
  });

  it('rejects classes that only contain diff', () => {
    expect(isDiffPre(firstPre(`{#lst-a .diffs}\n${FENCE}\n^ Listing #: x`))).toBe(false);
    expect(isDiffPre(firstPre(`{.side-diff}\n${FENCE}`))).toBe(false);
    expect(isDiffPre(firstPre(FENCE))).toBe(false);
  });
});
