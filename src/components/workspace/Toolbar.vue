<script setup lang="ts">
import {
  BadgeCheck,
  Braces,
  Brackets,
  ClipboardCopy,
  Code,
  Download,
  FileInput,
  FileText,
  Minimize2,
  Search,
  Sparkles,
  Trash2,
  UnfoldVertical,
  FoldVertical,
  Wand2,
  ListTree,
} from 'lucide-vue-next';
import AppButton from '@/components/ui/AppButton.vue';
import IconButton from '@/components/ui/IconButton.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';
import type { ToolbarOption, ViewMode } from '@/types';

interface Props {
  viewMode: ViewMode;
  isEmpty: boolean;
  isValid: boolean;
  searchOpen: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  'update:viewMode': [mode: ViewMode];
  format: [];
  minify: [];
  repair: [];
  validate: [];
  'copy-raw': [];
  'copy-formatted': [];
  'copy-minified': [];
  'copy-ts': [];
  import: [];
  'export-formatted': [];
  'export-minified': [];
  clear: [];
  toggleSearch: [];
  'expand-all': [];
  'collapse-all': [];
}>();

const viewOptions: ToolbarOption[] = [
  { value: 'tree', label: 'Tree', icon: ListTree },
  { value: 'code', label: 'Code', icon: Code },
  { value: 'raw', label: 'Raw', icon: FileText },
];

function onSegmentChange(option: unknown) {
  emit('update:viewMode', option as ViewMode);
}
</script>

<template>
  <div
    class="flex min-h-[44px] shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-surface px-3 py-1.5"
    role="toolbar"
    aria-label="JSON actions"
  >
    <SegmentedControl
      :options="viewOptions"
      label="Viewer mode"
      :model-value="viewMode"
      @update:model-value="onSegmentChange"
    />

    <IconButton
      title="Expand all tree nodes"
      aria-label="Expand all tree nodes"
      :disabled="viewMode !== 'tree' || isEmpty"
      data-testid="expand-all"
      @click="emit('expand-all')"
    >
      <UnfoldVertical class="size-3.5" aria-hidden="true" />
    </IconButton>
    <IconButton
      title="Collapse all tree nodes"
      aria-label="Collapse all tree nodes"
      :disabled="viewMode !== 'tree' || isEmpty"
      data-testid="collapse-all"
      @click="emit('collapse-all')"
    >
      <FoldVertical class="size-3.5" aria-hidden="true" />
    </IconButton>

    <span class="mx-1 h-5 w-px bg-border" aria-hidden="true" />

    <AppButton title="Format the JSON in the editor" :disabled="isEmpty" @click="emit('format')">
      <Wand2 class="size-3.5" aria-hidden="true" />Format
    </AppButton>
    <AppButton
      v-if="!isValid && !isEmpty"
      variant="primary"
      title="Intelligently repair malformed JSON (single quotes, trailing commas, Python literals, unquoted keys)"
      @click="emit('repair')"
    >
      <Sparkles class="size-3.5" aria-hidden="true" />Fix JSON
    </AppButton>
    <AppButton title="Minify the JSON in the editor" :disabled="isEmpty" @click="emit('minify')">
      <Minimize2 class="size-3.5" aria-hidden="true" />Minify
    </AppButton>
    <AppButton title="Validate the current JSON" :disabled="isEmpty" @click="emit('validate')">
      <BadgeCheck class="size-3.5" aria-hidden="true" />Validate
    </AppButton>

    <span class="mx-1 h-5 w-px bg-border" aria-hidden="true" />

    <IconButton title="Copy the JSON exactly as-is" :disabled="isEmpty" @click="emit('copy-raw')">
      <ClipboardCopy class="size-4" aria-hidden="true" />
    </IconButton>
    <IconButton title="Copy formatted JSON" :disabled="!isValid" @click="emit('copy-formatted')">
      <Braces class="size-4" aria-hidden="true" />
    </IconButton>
    <IconButton title="Copy minified JSON" :disabled="!isValid" @click="emit('copy-minified')">
      <Brackets class="size-4" aria-hidden="true" />
    </IconButton>
    <AppButton
      title="Generate and copy TypeScript interfaces from this JSON"
      :disabled="!isValid"
      class="text-[11px]"
      @click="emit('copy-ts')"
    >
      <Code class="size-3.5 text-accent" aria-hidden="true" />TS Types
    </AppButton>

    <span class="mx-1 h-5 w-px bg-border" aria-hidden="true" />

    <AppButton title="Import a JSON file" @click="emit('import')">
      <FileInput class="size-3.5" aria-hidden="true" />
      <span class="hidden md:inline">Import</span>
    </AppButton>
    <IconButton title="Export formatted JSON file" :disabled="!isValid" @click="emit('export-formatted')">
      <Download class="size-4" aria-hidden="true" />
    </IconButton>
    <IconButton title="Export minified JSON file" :disabled="!isValid" @click="emit('export-minified')">
      <Minimize2 class="-scale-x-100 size-4 rotate-90" aria-hidden="true" />
    </IconButton>

    <div class="ml-auto flex items-center gap-1.5">
      <AppButton
        title="Search keys and values"
        :aria-pressed="searchOpen"
        :disabled="isEmpty"
        @click="emit('toggleSearch')"
      >
        <Search class="size-3.5" aria-hidden="true" />
        <span class="hidden md:inline">Search</span>
      </AppButton>
      <AppButton variant="danger-quiet" title="Clear the document" :disabled="isEmpty" @click="emit('clear')">
        <Trash2 class="size-3.5" aria-hidden="true" />
        <span class="hidden md:inline">Clear</span>
      </AppButton>
    </div>
  </div>
</template>
