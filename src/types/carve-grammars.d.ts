declare module '@markup-carve/carve-grammars/highlightjs/carve.js' {
  import type { LanguageFn } from 'highlight.js';
  const carve: LanguageFn;
  export default carve;
}

declare module '@markup-carve/carve-grammars/highlightjs/delimited.js' {
  import type { LanguageFn } from 'highlight.js';
  export const csv: LanguageFn;
  export const tsv: LanguageFn;
}
