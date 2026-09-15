/**
 * Carve WYSIWYG app entry point.
 *
 * Layout:
 *   - left:   the Tiptap visual editor (CarveKit) + a toolbar
 *   - middle: live Carve source (read-only, updates on every edit) and an
 *             import box + "Load Carve" button (Carve -> editor round trip)
 *   - right:  rendered HTML preview (carve-js) of the current Carve source
 */
import '@markup-carve/carve-grammars/tiptap/editor.css';
import '@markup-carve/carve-grammars/diff/carve-diff.css';
import '@markup-carve/carve-css';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';
import './style.css';
import { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import hljs from 'highlight.js/lib/common';
import katex from 'katex';
import carveHighlight from '@markup-carve/carve-grammars/highlightjs/carve.js';
import { applyLanguageDiff } from '@markup-carve/carve-grammars/diff';
import { lintCarve } from '@markup-carve/carve';
// CarveKit registers these extensions at runtime from a plain-JS package.
// Import their declaration augmentations so chained toolbar commands remain
// visible to TypeScript as well.
import type {} from '@tiptap/starter-kit';
import type {} from '@tiptap/extension-link';
import type {} from '@tiptap/extension-underline';
import { createCarveEditor, editorToCarve, jsonToCarve, setCarveDocument, toggleOrderedList } from './editor';
import { carveHeadingTargets, carveToEditorDocument, carveToHtmlRaw, DIAGRAM_LANGUAGES } from './carve-import';
import { AUTHORING_RECIPES, lineDiff, recipeById } from './authoring';

hljs.registerLanguage('carve', carveHighlight);

const SAMPLE = `---
title: Rich visual authoring
lang: en
---

# Carve WYSIWYG

Use *Insert structure* or press Alt+Shift+K to add Carve-native content without
memorizing its source syntax. Select a structure and open *Inspector* to edit
its identifiers, classes, labels, and metadata.

The standard toolbar still handles /italic/, _underline_, ~struck~, inline
\`code\`, [links](https://github.com/markup-carve), quotes, and lists:

This sentence has an editorial note{# Clarify this claim before publishing. #}.
The annotation controls remain visible while you write. %% Inline review note

%% Block comments now read as review cards and can be hidden from the toolbar.

Direct inline editing is also available for {% a delimited review note %},
!\`/kaet/\` literals, \`<kbd>\`{=html} raw content, {~draft~>final~}
substitutions, $\`x^2\` math, @ada mentions, #review tags, and :rocket: symbols.

\`\`\`javascript
const message = 'The language control follows this full-width code.';
\`\`\`

> Rich structure and familiar editing belong in the same surface.

- bullet item
. bare-dot ordered item

::: tip "Everything stays editable"
The source, lint findings, normalization diff, and semantic HTML preview update
alongside the visual document.
:::

## Structured content

\`\`\`mermaid
flowchart LR
  Source[Carve source] --> Editor[Visual editor]
  Editor --> Preview[Rendered preview]
\`\`\`

|=< Feature |=> Status |
| Tables and figures | Editable |
| References and citations | Searchable |
| Containers and metadata | Inspectable |
^ Authoring coverage

:::: tabs
:::: tab [Visual]
Author rich structures with contextual controls.
::::
:::: tab [Source]
Inspect the exact Carve output at any time.
::::
::::

See </#structured-content> for the target-aware cross-reference in action, and
open this footnote[^fidelity]. The AST is expanded below and [the project][carve]
uses a reusable link definition. Evidence can be retargeted from [@carve2026].
Edit the document to see lint and normalization feedback update live.

*[AST]: Abstract Syntax Tree

[@carve2026]: Markup Carve contributors. (2026). Carve.

[carve]: https://github.com/markup-carve "Markup Carve"

[^fidelity]: Unsupported syntax is retained visibly instead of being silently discarded.
`;

const $ = (sel: string): HTMLElement => {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el as HTMLElement;
};

const editorEl = $('#editor');
const sourceEl = $('#carve-source') as HTMLTextAreaElement;
const previewEl = $('#html-preview');
const importEl = $('#carve-import') as HTMLTextAreaElement;

let editor: Editor;
let loadedSource = '';
let selectedRecipeId = '';

function highlightFrontmatter(source: string, format: string): string {
  const language = format === 'yml' ? 'yaml' : format;
  if (!hljs.getLanguage(language)) return source
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return hljs.highlight(source, { language }).value;
}

function enhanceFrontmatterEditors(): void {
  editorEl.querySelectorAll<HTMLTextAreaElement>('.carve-frontmatter-raw textarea').forEach(raw => {
    let shell = raw.closest<HTMLElement>('.carve-frontmatter-raw-editor');
    let code = shell?.querySelector<HTMLElement>('code');
    if (!shell || !code) {
      shell = document.createElement('div');
      shell.className = 'carve-frontmatter-raw-editor';
      const highlighted = document.createElement('pre');
      highlighted.className = 'carve-frontmatter-highlight hljs';
      highlighted.setAttribute('aria-hidden', 'true');
      code = document.createElement('code');
      highlighted.append(code);
      raw.before(shell);
      shell.append(highlighted, raw);
      raw.addEventListener('input', enhanceFrontmatterEditors);
      raw.addEventListener('scroll', () => {
        highlighted.scrollTop = raw.scrollTop;
        highlighted.scrollLeft = raw.scrollLeft;
      });
    }
    const label = raw.closest('.carve-frontmatter-raw')?.firstChild?.textContent ?? 'Raw YAML';
    const format = label.replace(/^Raw\s+/i, '').trim().toLowerCase() || 'yaml';
    code.className = `language-${format}`;
    const html = highlightFrontmatter(raw.value, format);
    if (code.innerHTML !== html) code.innerHTML = html;
  });
}
let previewRevision = 0;
let mermaidLoader: Promise<(typeof import('mermaid'))['default']> | undefined;
let mermaidTimer: number | undefined;
let mermaidQueue = Promise.resolve();

function loadMermaid(): Promise<(typeof import('mermaid'))['default']> {
  mermaidLoader ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' });
    return mermaid;
  });
  return mermaidLoader;
}

function showMermaidError(node: HTMLElement, error: unknown): void {
  node.classList.add('diagram-error');
  const message = document.createElement('p');
  message.className = 'diagram-error-message';
  message.setAttribute('role', 'alert');
  message.textContent = `Mermaid could not render: ${error instanceof Error ? error.message : String(error)}`;
  node.after(message);
}

function scheduleMermaid(revision: number): void {
  window.clearTimeout(mermaidTimer);
  mermaidTimer = window.setTimeout(() => {
    mermaidQueue = mermaidQueue.catch(() => undefined).then(async () => {
      if (revision !== previewRevision) return;
      const nodes = [...previewEl.querySelectorAll<HTMLElement>('pre.mermaid')];
      if (!nodes.length) return;
      let mermaid: Awaited<ReturnType<typeof loadMermaid>>;
      try {
        mermaid = await loadMermaid();
      } catch (error) {
        if (revision === previewRevision) nodes.filter(node => node.isConnected).forEach(node => showMermaidError(node, error));
        return;
      }
      if (revision !== previewRevision) return;
      for (const node of nodes) {
        if (revision !== previewRevision || !node.isConnected) return;
        try {
          await mermaid.run({ nodes: [node], suppressErrors: false });
        } catch (error) {
          if (revision !== previewRevision || !node.isConnected) return;
          showMermaidError(node, error);
        }
      }
    });
  }, 250);
}

function refreshOutputs(carve: string): void {
  enhanceFrontmatterEditors();
  const revision = ++previewRevision;
  sourceEl.value = carve;
  $('#diff-output').textContent = lineDiff(loadedSource, carve);
  const findings = lintCarve(carve);
  const lintEl = $('#lint-results');
  lintEl.replaceChildren();
  if (!findings.length) {
    const item = document.createElement('li');
    item.className = 'lint-ok';
    item.textContent = 'No lint findings.';
    lintEl.append(item);
  } else {
    findings.forEach(finding => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Line ${finding.line ?? '?'} · ${finding.rule}: ${finding.message}`;
      button.addEventListener('click', () => {
        sourceEl.focus();
        sourceEl.setSelectionRange(finding.start ?? 0, finding.end ?? finding.start ?? 0);
      });
      item.append(button);
      lintEl.append(item);
    });
  }
  try {
    previewEl.innerHTML = carveToHtmlRaw(carve);
    previewEl.querySelectorAll<HTMLElement>('.math[role="math"]').forEach(math => {
      const wrapped = math.textContent ?? '';
      const match = wrapped.match(/^\\\(([\s\S]*)\\\)$/) ?? wrapped.match(/^\\\[([\s\S]*)\\\]$/);
      const tex = match?.[1] ?? wrapped;
      katex.render(tex, math, {
        displayMode: math.classList.contains('display'),
        throwOnError: false,
        strict: 'warn',
      });
    });
    previewEl.querySelectorAll<HTMLElement>('pre[data-language]').forEach(pre => {
      if (DIAGRAM_LANGUAGES.has(pre.dataset.language ?? '')) return;
      const code = pre.querySelector<HTMLElement>('code[class*="language-"]');
      const requestedLanguage = pre.dataset.language ?? '';
      if (code && pre.classList.contains('diff')) {
        // A {.diff} language fence: keep the language highlighting and present
        // the leading +/-/space markers, via the shared carve-grammars helper.
        const highlightLine = hljs.getLanguage(requestedLanguage)
          ? (body: string) => hljs.highlight(body, { language: requestedLanguage }).value
          : undefined;
        applyLanguageDiff(code, highlightLine);
      } else if (code && hljs.getLanguage(requestedLanguage)) {
        hljs.highlightElement(code);
      }
      const toolbar = document.createElement('span');
      toolbar.className = 'preview-code-toolbar';
      const language = document.createElement('span');
      language.className = 'preview-code-language';
      language.textContent = pre.dataset.language ?? '';
      const copy = document.createElement('button');
      copy.className = 'preview-code-copy';
      copy.type = 'button';
      copy.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3m-8-8h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h3Z"/></svg>';
      copy.setAttribute('aria-label', `Copy ${language.textContent || 'code'} to clipboard`);
      const status = document.createElement('span');
      status.className = 'visually-hidden';
      status.setAttribute('role', 'status');
      let resetTimer: number | undefined;
      copy.addEventListener('click', async () => {
        const source = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
        window.clearTimeout(resetTimer);
        try {
          await navigator.clipboard.writeText(source);
          copy.classList.add('is-copied');
          copy.classList.remove('has-error');
          status.textContent = 'Copied to clipboard';
        } catch {
          copy.classList.add('has-error');
          status.textContent = 'Copy failed';
        }
        resetTimer = window.setTimeout(() => {
          copy.classList.remove('is-copied', 'has-error');
          status.textContent = '';
        }, 1400);
      });
      toolbar.append(language, copy, status);
      const wrapper = document.createElement('div');
      wrapper.className = 'preview-code-block';
      pre.replaceWith(wrapper);
      wrapper.append(pre, toolbar);
    });
    scheduleMermaid(revision);
  } catch (err) {
    previewEl.textContent = `Preview error: ${(err as Error).message}`;
  }
}

/** Load Carve source into the editor (import direction). */
function loadCarve(source: string): void {
  // setCarveDocument, not setContent: the bridge's source envelope rides on
  // the document's own attributes, which setContent does not carry (editor.ts).
  // emitUpdate defaults to false; we refresh the outputs explicitly below.
  setCarveDocument(editor, carveToEditorDocument(source));
  loadedSource = source;
  refreshOutputs(editorToCarve(editor));
}

editor = createCarveEditor({
  element: editorEl,
  onUpdate: refreshOutputs,
});
new MutationObserver(enhanceFrontmatterEditors).observe(editorEl, { childList: true, subtree: true });
enhanceFrontmatterEditors();

const commentToggle = $('#toggle-comments') as HTMLButtonElement;
let commentsVisible = true;

function commentCount(): number {
  let count = 0;
  editor.state.doc.descendants(node => {
    if (node.type.name === 'carveComment' || node.type.name === 'carveCommentInline') count += 1;
    count += node.marks.filter(mark => mark.type.name === 'carveCriticComment').length;
  });
  return count;
}

function updateCommentToggle(): void {
  const count = commentCount();
  commentToggle.textContent = `${commentsVisible ? '◉' : '○'} Comments${count ? ` (${count})` : ''}`;
  commentToggle.setAttribute('aria-pressed', String(commentsVisible));
  commentToggle.title = `${commentsVisible ? 'Hide' : 'Show'} ${count || ''} editorial comment${count === 1 ? '' : 's'}`.replace(/\s+/g, ' ');
}

commentToggle.addEventListener('click', () => {
  commentsVisible = !commentsVisible;
  editorEl.classList.toggle('comments-hidden', !commentsVisible);
  updateCommentToggle();
});
editor.on('update', updateCommentToggle);
updateCommentToggle();

function insertDocument(doc: JSONContent): void {
  const content = doc.content ?? [];
  editor.chain().focus().insertContent(content).run();
}

/** Canonical markup represented by the editable nodes, without a source envelope. */
function editableSource(source: string): string {
  const doc = carveToEditorDocument(source);
  return jsonToCarve({ type: 'doc', content: doc.content ?? [] });
}

// Rich structure palette --------------------------------------------------
const dialog = $('#insert-dialog') as HTMLDialogElement;
const recipeList = $('#recipe-list');
const recipeEditor = $('#recipe-editor');
const recipeFields = $('#recipe-fields');
const recipeSearch = $('#recipe-search') as HTMLInputElement;
const recipePreview = $('#recipe-preview') as HTMLTextAreaElement;

function recipeValues(): Record<string, string> {
  return Object.fromEntries(
    [...recipeFields.querySelectorAll<HTMLInputElement>('input, textarea')]
      .map(input => [input.name, input.value]),
  );
}

function updateRecipePreview(): void {
  const recipe = recipeById(selectedRecipeId);
  if (recipe) recipePreview.value = editableSource(recipe.source(recipeValues()));
}

function chooseRecipe(id: string): void {
  const recipe = recipeById(id);
  if (!recipe) return;
  selectedRecipeId = id;
  recipeList.hidden = true;
  $('#recipe-search-label').hidden = true;
  recipeEditor.hidden = false;
  $('#recipe-name').textContent = recipe.label;
  $('#recipe-description').textContent = recipe.description;
  recipeFields.replaceChildren();
  recipe.fields.forEach(field => {
    const label = document.createElement('label');
    label.textContent = field.label;
    const input = field.name === 'body' || field.name === 'entry'
      ? document.createElement('textarea') : document.createElement('input');
    input.name = field.name;
    input.value = field.value;
    input.required = field.required ?? false;
    input.addEventListener('input', updateRecipePreview);
    label.append(input);
    recipeFields.append(label);
  });
  const targetPicker = $('#target-picker');
  targetPicker.hidden = id !== 'crossref';
  if (id === 'crossref') {
    const select = $('#target-select') as HTMLSelectElement;
    select.replaceChildren();
    carveHeadingTargets(editorToCarve(editor)).forEach(target => {
      const option = document.createElement('option');
      option.value = target.id;
      option.textContent = `${target.id} (${target.type})`;
      select.append(option);
    });
    select.onchange = () => {
      const target = recipeFields.querySelector<HTMLInputElement>('[name="target"]');
      if (target && select.value) target.value = select.value;
      updateRecipePreview();
    };
  }
  updateRecipePreview();
  recipeFields.querySelector<HTMLElement>('input, textarea')?.focus();
}

function showRecipeList(): void {
  selectedRecipeId = '';
  recipeList.hidden = false;
  $('#recipe-search-label').hidden = false;
  recipeEditor.hidden = true;
  recipeList.replaceChildren();
  const query = recipeSearch.value.toLowerCase();
  let group = '';
  AUTHORING_RECIPES.filter(recipe =>
    `${recipe.label} ${recipe.group} ${recipe.description}`.toLowerCase().includes(query),
  ).forEach(recipe => {
    if (recipe.group !== group) {
      group = recipe.group;
      const heading = document.createElement('h3');
      heading.textContent = group;
      recipeList.append(heading);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<strong>${recipe.label}</strong><span>${recipe.description}</span>`;
    button.addEventListener('click', () => chooseRecipe(recipe.id));
    recipeList.append(button);
  });
}

function openInsert(): void {
  recipeSearch.value = '';
  showRecipeList();
  dialog.showModal();
  recipeSearch.focus();
}

function openMetadata(): void {
  const summary = editorEl.querySelector<HTMLButtonElement>('.carve-frontmatter-summary');
  if (!summary) {
    openInsert();
    chooseRecipe('metadata');
    return;
  }
  if (summary.getAttribute('aria-expanded') !== 'true') summary.click();
  summary.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function openCodeBlock(): void {
  openInsert();
  chooseRecipe('code-block');
}

$('#open-code-block').addEventListener('click', openCodeBlock);
$('#open-metadata').addEventListener('click', openMetadata);
$('#open-insert').addEventListener('click', openInsert);
$('#recipe-back').addEventListener('click', showRecipeList);
recipeSearch.addEventListener('input', showRecipeList);
function insertSelectedRecipe(): void {
  const recipe = recipeById(selectedRecipeId);
  if (!recipe) return;
  const invalid = recipeFields.querySelector<HTMLInputElement>(':invalid');
  if (invalid) { invalid.reportValidity(); return; }
  const source = editableSource(recipe.source(recipeValues()));
  const doc = carveToEditorDocument(source);
  if (recipe.id === 'metadata') {
    const metadata = doc.content?.[0];
    const first = editor.state.doc.firstChild;
    if (metadata && first?.type.name === 'carveFrontmatter') {
      editor.commands.command(({ tr }) => {
        tr.replaceWith(0, first.nodeSize, editor.schema.nodeFromJSON(metadata));
        return true;
      });
    } else {
      editor.commands.insertContentAt(0, doc.content ?? []);
    }
  } else {
    insertDocument(doc);
  }
  dialog.close();
}
dialog.querySelector('form')!.addEventListener('submit', event => {
  event.preventDefault();
  const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
  if (submitter?.value === 'cancel') dialog.close('cancel');
  else if (selectedRecipeId) insertSelectedRecipe();
});
document.addEventListener('keydown', event => {
  if (event.altKey && event.shiftKey && event.code === 'KeyK') {
    event.preventDefault();
    if (!dialog.open) openInsert();
  }
});

// Selection-aware node attribute inspector -------------------------------
const inspector = $('#node-inspector');
const inspectorFields = $('#inspector-fields');
let inspectedType = '';

function inspectSelection(): void {
  const { $from } = editor.state.selection;
  let node = $from.parent;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const candidate = $from.node(depth);
    if (Object.values(candidate.attrs).some(value => value != null)) { node = candidate; break; }
  }
  inspectedType = node.type.name;
  inspectorFields.replaceChildren();
  $('#inspector-help').textContent = `Editing ${inspectedType}. Empty values remove optional attributes.`;
  const entries = Object.entries(node.attrs).filter(([name, value]) =>
    !['carveSource', 'carveFingerprint', 'carveSourceLayout'].includes(name)
      && !['carveAttrOrder', 'carveKeyValues', 'items'].includes(name)
      && (value == null || ['string', 'number', 'boolean'].includes(typeof value)),
  );
  if (!entries.length) {
    $('#inspector-help').textContent = `${inspectedType} has no editable attributes.`;
    return;
  }
  entries.forEach(([name, value]) => {
    const label = document.createElement('label');
    label.textContent = name;
    if (name === 'textAlign') {
      const select = document.createElement('select');
      select.name = name;
      [['', 'Inherit/default'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right']]
        .forEach(([optionValue, text]) => {
          const option = document.createElement('option');
          option.value = optionValue;
          option.textContent = text;
          option.selected = optionValue === (value ?? '');
          select.append(option);
        });
      label.append(select);
      inspectorFields.append(label);
      return;
    }
    const input = document.createElement('input');
    input.name = name;
    input.value = value == null ? '' : String(value);
    input.dataset.kind = value == null
      ? (['short', 'integral', 'carveTyped'].includes(name) ? 'boolean' : 'string')
      : typeof value;
    label.append(input);
    inspectorFields.append(label);
  });
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'primary';
  save.textContent = 'Apply attributes';
  inspectorFields.append(save);
}

inspectorFields.addEventListener('submit', event => {
  event.preventDefault();
  const attrs: Record<string, unknown> = {};
  inspectorFields.querySelectorAll<HTMLInputElement>('input').forEach(input => {
    attrs[input.name] = input.value === '' ? null
      : input.dataset.kind === 'boolean' ? input.value === 'true'
      : input.dataset.kind === 'number' ? Number(input.value) : input.value;
  });
  inspectorFields.querySelectorAll<HTMLSelectElement>('select').forEach(select => {
    attrs[select.name] = select.value || null;
  });
  editor.chain().focus().updateAttributes(inspectedType, attrs).run();
  inspectSelection();
});
$('#toggle-inspector').addEventListener('click', () => {
  inspector.hidden = !inspector.hidden;
  $('#toggle-inspector').setAttribute('aria-expanded', String(!inspector.hidden));
  if (!inspector.hidden) {
    inspectSelection();
    $('#close-inspector').focus();
  }
});
function closeInspector(): void {
  inspector.hidden = true;
  $('#toggle-inspector').setAttribute('aria-expanded', 'false');
  $('#toggle-inspector').focus();
}
$('#close-inspector').addEventListener('click', closeInspector);
inspector.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeInspector();
  }
});
editor.on('selectionUpdate', () => { if (!inspector.hidden) inspectSelection(); });

// Toolbar wiring -----------------------------------------------------------
const toolbarActions: Record<string, () => void> = {
  bold: () => editor.chain().focus().toggleBold().run(),
  italic: () => editor.chain().focus().toggleItalic().run(),
  underline: () => editor.chain().focus().toggleUnderline().run(),
  strike: () => editor.chain().focus().toggleStrike().run(),
  code: () => editor.chain().focus().toggleCode().run(),
  h1: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  h2: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  bulletList: () => editor.chain().focus().toggleBulletList().run(),
  orderedList: () => toggleOrderedList(editor),
  blockquote: () => editor.chain().focus().toggleBlockquote().run(),
  link: () => {
    const url = window.prompt('Link URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
  },
};

const toolbarActive: Record<string, () => boolean> = {
  bold: () => editor.isActive('bold'),
  italic: () => editor.isActive('italic'),
  underline: () => editor.isActive('underline'),
  strike: () => editor.isActive('strike'),
  code: () => editor.isActive('code'),
  h1: () => editor.isActive('heading', { level: 1 }),
  h2: () => editor.isActive('heading', { level: 2 }),
  bulletList: () => editor.isActive('bulletList'),
  orderedList: () => editor.isActive('orderedList'),
  blockquote: () => editor.isActive('blockquote'),
  link: () => editor.isActive('link'),
};

function updateToolbarState(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
    button.setAttribute('aria-pressed', String(toolbarActive[button.dataset.action!]?.() ?? false));
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action!;
    toolbarActions[action]?.();
  });
});
editor.on('selectionUpdate', updateToolbarState);
editor.on('transaction', updateToolbarState);
updateToolbarState();

$('#load-carve').addEventListener('click', () => {
  loadCarve(importEl.value);
});

// Initial content ----------------------------------------------------------
importEl.value = SAMPLE;
loadCarve(SAMPLE);
