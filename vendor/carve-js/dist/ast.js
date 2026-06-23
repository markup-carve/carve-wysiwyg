/*
 * Carve AST node definitions.
 *
 * The spec lives in markup-carve/carve. Node names here match the
 * constructs the case-study + EBNF grammar describe. Implementations
 * of M1 (block parser) and M2 (inline parser) populate these node
 * types; M3 (HTML renderer) reads them.
 *
 * All nodes carry an optional `attrs` field — `{#id .class key=value}`
 * blocks attach to whatever node they immediately follow.
 */
export {};
//# sourceMappingURL=ast.js.map