/** True when a space-separated class list holds `diff` as a whole token. */
export function hasDiffClass(classes: string | null | undefined): boolean {
  return String(classes ?? '').split(/\s+/).includes('diff');
}

/** A captioned fence renders as `<figure class="diff"><pre>`: the figure owns the attribute line. */
export function isDiffPre(pre: Element): boolean {
  if (pre.classList.contains('diff')) return true;
  const parent = pre.parentElement;
  return parent?.tagName === 'FIGURE' && parent.classList.contains('diff');
}
