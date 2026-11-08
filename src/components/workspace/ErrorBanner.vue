<script setup lang="ts">
import { AlertTriangle, Info, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-vue-next';
import type { ScanResult, JsonDiagnostic, DuplicateKeyFinding } from '@/types';
import { decodePointer } from '@/utils/json/pointer';

interface Props {
  error: JsonDiagnostic | null;
  scan: ScanResult | null;
}

defineProps<Props>();
const emit = defineEmits<{ repair: [] }>();

function integritySummary(scan: ScanResult): string {
  const problems: string[] = [];
  const duplicateCount = scan.info.duplicateKeys.length;
  const precisionCount = scan.info.precisionNotes;
  if (duplicateCount > 0) {
    problems.push(`${duplicateCount} duplicate key${duplicateCount === 1 ? '' : 's'}`);
  }
  if (precisionCount > 0) {
    problems.push(`${precisionCount} precision-risk number${precisionCount === 1 ? '' : 's'}`);
  }
  if (problems.length === 0) {
    return 'No structural risks found in this document';
  }
  return problems.join(', ');
}

function findingText(finding: DuplicateKeyFinding): string {
  const segments = decodePointer(finding.pointer);
  const label = segments.length === 0 ? 'root object' : segments.map((segment) => segment).join('/');
  return `Property "${label}" appears more than once - the last occurrence wins.`;
}
</script>

<template>
  <div v-if="error" class="mx-3 mb-2 rounded-lg border border-[color-mix(in_srgb,var(--app-danger)_35%,transparent)] bg-danger-soft px-3 py-2 text-xs">
    <div class="flex items-start gap-2">
      <TriangleAlert class="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      <div class="min-w-0">
        <p class="font-semibold text-danger">Invalid JSON</p>
        <p class="mt-0.5 break-words text-fg">{{ error.message }}</p>
        <div class="mt-2 flex items-center gap-2">
          <p class="text-[11px] text-fg-muted">
            Line {{ error.line + 1 }}, column {{ error.column + 1 }}
            <span class="text-fg-faint">(offset {{ error.offset }})</span>
          </p>
          <button
            type="button"
            class="ml-auto inline-flex items-center gap-1 rounded bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger hover:bg-danger/25 transition-colors cursor-pointer"
            title="Try to automatically repair common syntax mistakes"
            @click="emit('repair')"
          >
            <Sparkles class="size-3" aria-hidden="true" />
            Auto-Repair JSON
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Integrity report: surface risks ordinary formatters silently swallow -->
  <section
    v-else-if="scan"
    class="mx-3 mb-2 space-y-1.5 text-xs"
    role="region"
    aria-label="Document integrity report"
    data-testid="integrity-report"
  >
    <p class="flex items-center gap-1.5 px-1 text-[11px] font-medium text-fg-muted">
      <ShieldCheck class="size-3.5 shrink-0 text-success" aria-hidden="true" />
      Integrity report
      <span class="font-normal text-fg-faint">
        {{
          integritySummary(scan)
        }}
      </span>
    </p>

    <div
      v-if="scan.info.duplicateKeys.length > 0"
      class="flex items-start gap-2 rounded-md border border-border bg-surface-inset px-3 py-2 text-fg-muted"
    >
      <Info class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <div class="min-w-0">
        <p class="font-medium text-fg">Duplicate property names</p>
        <p class="mb-0.5 text-fg-faint">Other tools re-serialize and silently keep the last value; JSON Studio shows you where this happens.</p>
        <ul class="mt-0.5 list-disc pl-4">
          <li v-for="finding in scan.info.duplicateKeys.slice(0, 5)" :key="finding.pointer" class="break-all font-mono">
            {{ findingText(finding) }}
          </li>
        </ul>
        <p v-if="scan.info.duplicateKeys.length > 5" class="mt-0.5">
          and {{ scan.info.duplicateKeys.length - 5 }} more…
        </p>
      </div>
    </div>

    <div
      v-if="scan.info.precisionNotes > 0"
      class="flex items-start gap-2 rounded-md border border-border bg-surface-inset px-3 py-2 text-fg-muted"
    >
      <AlertTriangle class="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
      <p class="min-w-0 break-words">
        Data integrity: {{ scan.info.precisionNotes }} number{{ scan.info.precisionNotes === 1 ? '' : 's' }} exceed{{ scan.info.precisionNotes === 1 ? 's' : '' }} 15 significant digits.
        JavaScript parses all numbers as IEEE-754 doubles, so very large integer IDs may not survive a format/minify round trip - verify generated IDs against their source.
      </p>
    </div>

    <p v-if="scan.scanSkipped" class="flex items-start gap-2 rounded-md border border-border bg-surface-inset px-3 py-2 text-fg-muted">
      <Info class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      Document is very large - only the quick JSON.parse check ran.
    </p>
  </section>
</template>
