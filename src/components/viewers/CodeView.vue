<script setup lang="ts">
import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state';
import { EditorView, Decoration, keymap } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { basicSetup } from 'codemirror';
import type { JsonDiagnostic } from '@/types';

interface Props {
  text: string;
  error: JsonDiagnostic | null;
  wrap: boolean;
  dark: boolean;
}

const props = defineProps<Props>();

const host = ref<HTMLElement | null>(null);
let view: EditorView | null = null;

const wrapCompartment = new Compartment();
const themeCompartment = new Compartment();

const setErrorLineEffect = StateEffect.define<number | null>();

const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations;
    for (const effect of transaction.effects) {
      if (effect.is(setErrorLineEffect)) {
        next = Decoration.none;
        const line = effect.value;
        if (line !== null && line >= 0) {
          next = Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(line)]);
        }
      }
    }
    return transaction.docChanged ? next.map(transaction.changes) : next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function currentErrorLine(): number | null {
  if (props.error === null || !view) return null;
  const safeOffset = Math.min(props.error.offset, view.state.doc.length);
  return view.state.doc.lineAt(safeOffset).from;
}

onMounted(() => {
  if (!host.value) return;
  view = new EditorView({
    state: EditorState.create({
      doc: props.text,
      extensions: [
        basicSetup,
        keymap.of(defaultKeymap),
        json(),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        errorLineField,
        wrapCompartment.of(props.wrap ? EditorView.lineWrapping : []),
        themeCompartment.of(props.dark ? oneDark : []),
      ],
    }),
    parent: host.value,
  });
  view.dispatch({ effects: setErrorLineEffect.of(currentErrorLine()) });
});

watch(
  () => props.text,
  (text) => {
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      effects: setErrorLineEffect.of(currentErrorLine()),
    });
  },
);

watch(
  () => props.wrap,
  (wrap) => {
    view?.dispatch({ effects: wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []) });
  },
);

watch(
  () => props.dark,
  (dark) => {
    view?.dispatch({ effects: themeCompartment.reconfigure(dark ? oneDark : []) });
  },
);

watch(
  () => props.error,
  () => {
    view?.dispatch({ effects: setErrorLineEffect.of(currentErrorLine()) });
  },
);

onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div
    ref="host"
    data-testid="code-view-host"
    class="h-full min-h-0 overflow-hidden font-mono text-xs [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto [&_.cm-gutters]:border-r [&_.cm-gutters]:border-border [&_.cm-gutters]:bg-transparent"
  />
</template>

<style>
.cm-error-line {
  background: color-mix(in srgb, var(--app-danger) 18%, transparent);
}
.cm-editor {
  height: 100%;
  font-size: 12px;
}
.cm-editor.cm-focused {
  outline: none !important;
}
</style>
