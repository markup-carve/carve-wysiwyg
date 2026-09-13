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
import '@markup-carve/carve-css';
import './style.css';
import { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { lintCarve } from '@markup-carve/carve';
// CarveKit registers these extensions at runtime from a plain-JS package.
// Import their declaration augmentations so chained toolbar commands remain
// visible to TypeScript as well.
import type {} from '@tiptap/starter-kit';
import type {} from '@tiptap/extension-link';
import type {} from '@tiptap/extension-underline';
import { createCarveEditor, editorToCarve, jsonToCarve, setCarveDocument, toggleOrderedList } from './editor';
import { carveHeadingTargets, carveToEditorDocument, carveToHtmlRaw } from './carve-import';
import { AUTHORING_RECIPES, lineDiff, recipeById } from './authoring';

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

> Rich structure and familiar editing belong in the same surface.

- bullet item
. bare-dot ordered item

::: tip "Everything stays editable"
The source, lint findings, normalization diff, and semantic HTML preview update
alongside the visual document.
:::

## Structured content

|=< Feature |=> Status |
| Tables and figures | Editable |
| References and citations | Searchable |
| Containers and metadata | Inspectable |
^ Authoring coverage

::: tabs
::: tab [Visual]
Author rich structures with contextual controls.
:::
::: tab [Source]
Inspect the exact Carve output at any time.
:::
:::

See </#structured-content> for the target-aware cross-reference in action, and
open this footnote[^fidelity]. The AST is expanded below and [the project][carve]
uses a reusable link definition. Evidence can be retargeted from [@carve2026].
Edit the document to see lint and normalization feedback update live.

[^fidelity]: Unsupported syntax is retained visibly instead of being silently discarded.

*[AST]: Abstract Syntax Tree

[carve]: https://github.com/markup-carve "Markup Carve"

[@carve2026]: {} Markup Carve contributors. (2026). Carve.
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

function refreshOutputs(carve: string): void {
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
  editor.chain().focus().updateAttributes(inspectedType, attrs).run();
  inspectSelection();
});
$('#toggle-inspector').addEventListener('click', () => {
  inspector.hidden = !inspector.hidden;
  $('#toggle-inspector').setAttribute('aria-expanded', String(!inspector.hidden));
  if (!inspector.hidden) inspectSelection();
});
$('#close-inspector').addEventListener('click', () => {
  inspector.hidden = true;
  $('#toggle-inspector').setAttribute('aria-expanded', 'false');
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

document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action!;
    toolbarActions[action]?.();
  });
});

$('#load-carve').addEventListener('click', () => {
  loadCarve(importEl.value);
});

// Initial content ----------------------------------------------------------
importEl.value = SAMPLE;
loadCarve(SAMPLE);
