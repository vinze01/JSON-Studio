import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import Toolbar from '@/components/workspace/Toolbar.vue';
import TreeRow from '@/components/viewers/TreeRow.vue';
import Modal from '@/components/ui/Modal.vue';
import ToastHost from '@/components/ui/ToastHost.vue';
import StatusBar from '@/components/layout/StatusBar.vue';
import SettingsModal from '@/components/workspace/SettingsModal.vue';
import SearchPanel from '@/components/workspace/SearchPanel.vue';
import ErrorBanner from '@/components/workspace/ErrorBanner.vue';
import EditorPane from '@/components/workspace/EditorPane.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';
import { useToastStore } from '@/stores/toast';
import { usePreferencesStore } from '@/stores/preferences';
import { createRootNode, childTreeNodes } from '@/utils/json/tree';
import type { JsonValue } from '@/types';
import { nextTick } from 'vue';

beforeEach(() => {
  setActivePinia(createPinia());
  window.localStorage.clear();
});

describe('Toolbar', () => {
  function mountToolbar(props: Partial<{ isEmpty: boolean; isValid: boolean; searchOpen: boolean }> = {}) {
    return mount(Toolbar, {
      props: {
        viewMode: 'tree',
        isEmpty: false,
        isValid: true,
        searchOpen: false,
        ...props,
      },
    });
  }

  it('emits view changes and actions', async () => {
    const wrapper = mountToolbar();
    const control = wrapper.findComponent(SegmentedControl);
    expect(control).toBeTruthy();

    // Clicking the already-active radio is a no-op...
    await wrapper.findAll('[role="radio"]')[0]!.trigger('click');
    expect(wrapper.emitted('update:viewMode')).toBeUndefined();

    // ...choosing another view emits the change.
    await wrapper.findAll('[role="radio"]')[2]!.trigger('click');
    expect(wrapper.emitted('update:viewMode')?.[0]).toEqual(['raw']);

    const format = wrapper.findAll('button').find((button) => button.text().includes('Format'))!;
    await format.trigger('click');
    expect(wrapper.emitted('format')).toHaveLength(1);
  });

  it('supports radio arrow-key navigation with roving tabindex', async () => {
    const wrapper = mountToolbar();
    const radios = () => wrapper.findAll('[role="radio"]');
    // Only the checked radio is a tab stop.
    expect(radios()[0]!.attributes('tabindex')).toBe('0');
    expect(radios()[1]!.attributes('tabindex')).toBe('-1');

    // ArrowRight moves selection to the next view and emits the change.
    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:viewMode')?.[0]).toEqual(['code']);

    // The parent applies the new value; the roving tabindex follows.
    await wrapper.setProps({ viewMode: 'code' });
    expect(radios()[1]!.attributes('aria-checked')).toBe('true');
    expect(radios()[1]!.attributes('tabindex')).toBe('0');
    expect(radios()[0]!.attributes('tabindex')).toBe('-1');

    // ArrowLeft moves back to the first view.
    await wrapper.find('[role="radiogroup"]').trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.emitted('update:viewMode')?.[1]).toEqual(['tree']);
  });

  it('disables destructive and format actions for empty documents', () => {
    const wrapper = mountToolbar({ isEmpty: true, isValid: false });
    const disabled = wrapper.findAll('button:disabled').map((button) => button.text());
    expect(disabled.join(' ')).toContain('Format');
    expect(disabled.join(' ')).toContain('Validate');
  });

  it('disables export and formatted copy for invalid documents', () => {
    const wrapper = mountToolbar({ isValid: false });
    const titles = wrapper.findAll('button:disabled').map((button) => button.attributes('title'));
    expect(titles).toContain('Export formatted JSON file');
    expect(titles).toContain('Copy minified JSON');
  });

  it('requires a second click to confirm clearing the document', async () => {
    const wrapper = mountToolbar();
    const clear = () => wrapper.find('[data-testid="clear-button"]');

    // First click only arms the button - the document must survive it.
    await clear().trigger('click');
    expect(wrapper.emitted('clear')).toBeUndefined();
    expect(clear().text()).toContain('Confirm clear?');

    // Second click confirms and clears.
    await clear().trigger('click');
    expect(wrapper.emitted('clear')).toHaveLength(1);
    wrapper.unmount();
  });

  it('disarms the clear confirmation on blur', async () => {
    const wrapper = mountToolbar();
    const clearButton = () => wrapper.find('[data-testid="clear-button"]');
    await clearButton().trigger('click');
    expect(clearButton().text()).toContain('Confirm clear?');
    await clearButton().trigger('blur');
    expect(clearButton().text()).not.toContain('Confirm');
    // After disarming, a click arms again instead of clearing.
    await clearButton().trigger('click');
    expect(wrapper.emitted('clear')).toBeUndefined();
    expect(clearButton().text()).toContain('Confirm clear?');
    wrapper.unmount();
  });
});

describe('TreeRow', () => {
  const baseProps = {
    expanded: false,
    matched: false,
    active: false,
    indentStep: 14,
  };

  it('renders string values with quotes and type colors', () => {
    const node = createRootNode({ key: 'value' } as JsonValue);
    const [child] = childTreeNodes(node, new Map());
    const wrapper = mount(TreeRow, { props: { ...baseProps, node: child! } });
    expect(wrapper.text()).toContain('key:');
    expect(wrapper.text()).toContain('"value"');
  });

  it('emits toggle for containers and copy events', async () => {
    const node = createRootNode({ a: 1 } as JsonValue);
    const wrapper = mount(TreeRow, { props: { ...baseProps, node } });
    await wrapper.find('[aria-expanded]').trigger('click');
    expect(wrapper.emitted('toggle')).toHaveLength(1);

    await wrapper.find('[aria-label^="Copy JSON Pointer path"]').trigger('click');
    expect(wrapper.emitted('copy-path')).toHaveLength(1);
    await wrapper.find('[aria-label$="subtree"]').trigger('click');
    expect(wrapper.emitted('copy-value')).toHaveLength(1);
    await wrapper.find('[aria-label*="Copy inner JSON"]').trigger('click');
    expect(wrapper.emitted('copy-inner')).toHaveLength(1);
  });

  it('only offers inner copy for containers', () => {
    const containerNode = createRootNode({ a: 1 } as JsonValue);
    const hasInner = mount(TreeRow, { props: { ...baseProps, node: containerNode } });
    expect(hasInner.find('[aria-label*="Copy inner JSON"]').exists()).toBe(true);

    const leafNode = createRootNode({ a: 'leaf' } as JsonValue);
    const [leaf] = childTreeNodes(leafNode, new Map());
    const withInner = mount(TreeRow, { props: { ...baseProps, node: leaf! } });
    expect(withInner.find('[aria-label*="Copy inner JSON"]').exists()).toBe(false);
  });

  it('renders HTTP(S) string values as clickable external links', () => {
    const node = createRootNode({ url: 'https://example.com/data.json' } as JsonValue);
    const [child] = childTreeNodes(node, new Map());
    const wrapper = mount(TreeRow, { props: { ...baseProps, node: child! } });
    const link = wrapper.find('[data-testid="tree-url-link"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('https://example.com/data.json');
    expect(link.attributes('rel')).toContain('noopener');
    expect(link.attributes('target')).toBe('_blank');
  });

  it('does not linkify non-URL strings or numbers', () => {
    const node = createRootNode({ text: 'not a url', count: 42 } as JsonValue);
    const [textRow, countRow] = childTreeNodes(node, new Map());
    expect(mount(TreeRow, { props: { ...baseProps, node: textRow! } }).find('[data-testid="tree-url-link"]').exists()).toBe(false);
    expect(mount(TreeRow, { props: { ...baseProps, node: countRow! } }).find('[data-testid="tree-url-link"]').exists()).toBe(false);
  });

  it('shows summary text for collapsed containers', () => {
    const node = createRootNode({ a: 1, b: 2 } as JsonValue);
    const wrapper = mount(TreeRow, { props: { ...baseProps, node } });
    expect(wrapper.text()).toContain('2 keys');
  });
});

describe('Modal', () => {
  it('renders lazily and closes on Escape/backdrop', async () => {
    const wrapper = mount(Modal, { props: { open: true, title: 'Test dialog' }, attachTo: document.body });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await document
      .querySelector('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(wrapper.emitted('close')).toHaveLength(1);

    document.querySelector('.fixed.inset-0')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(wrapper.emitted('close')).toHaveLength(2);
    wrapper.unmount();
  });

  it('grabs focus when mounted already open (Esc must be reachable)', async () => {
    // SettingsModal mounts Modal with open: true - the dialog must focus
    // itself on mount, otherwise keyboard focus stays on the trigger behind
    // the overlay and Escape never dismisses the dialog.
    const wrapper = mount(Modal, { props: { open: true, title: 'Settings' }, attachTo: document.body });
    await nextTick();
    await nextTick();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement).toBe(document.querySelector('[role="dialog"]'));
    wrapper.unmount();
    await nextTick();
  });

  it('renders nothing when closed', () => {
    const wrapper = mount(Modal, { props: { open: false, title: 'Test' }, attachTo: document.body });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    wrapper.unmount();
  });

  it('traps keyboard focus within the dialog (Tab/Shift+Tab wrap)', async () => {
    const wrapper = mount(Modal, {
      props: { open: true, title: 'Trap' },
      attachTo: document.body,
      slots: {
        default:
          '<button type="button" id="trap-first">First</button><button type="button" id="trap-last">Last</button>',
      },
    });
    const last = document.getElementById('trap-last')!;
    // DOM order inside the dialog: header close button, then slot content.
    const close = document.querySelector('[aria-label="Close dialog"]')!;

    // Tab from the last focusable element wraps to the first (close button).
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(close);

    // Shift+Tab from the first focusable element wraps back to the last.
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
    wrapper.unmount();
  });
});

describe('ToastHost', () => {
  it('renders live toasts and supports dismissal', async () => {
    const toast = useToastStore();
    toast.success('First action done');
    toast.error('Copy failed');
    const wrapper = mount(ToastHost, { attachTo: document.body });
    expect(wrapper.text()).toContain('First action done');
    expect(wrapper.text()).toContain('Copy failed');

    const dismiss = wrapper.findAll('button[aria-label="Dismiss notification"]')[0]!;
    await dismiss.trigger('click');
    expect(wrapper.text()).not.toContain('First action done');
    expect(wrapper.text()).toContain('Copy failed');
    wrapper.unmount();
  });
});

describe('StatusBar', () => {
  it('summarizes validity, size and structure', () => {
    const wrapper = mount(StatusBar, {
      props: {
        status: 'valid',
        rootTypeLabel: 'object',
        items: 12,
        depth: 4,
        sizeBytes: 2048,
        viewMode: 'tree',
      },
    });
    const text = wrapper.text();
    expect(text).toContain('Valid');
    expect(text).toContain('Type: object');
    expect(text).toContain('12 keys');
    expect(text).toContain('Depth: 4');
    expect(text).toContain('2.0 KB');
  });
});

describe('SettingsModal', () => {
  it('updates preferences and persists them', async () => {
    const prefs = usePreferencesStore();
    await prefs.load();
    const wrapper = mount(SettingsModal, { attachTo: document.body });

    const themeSelect = document.querySelector('#setting-theme') as HTMLSelectElement;
    themeSelect.value = 'dark';
    themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();
    expect(prefs.theme).toBe('dark');

    const indentSelect = document.querySelector('#setting-indent') as HTMLSelectElement;
    indentSelect.value = '4';
    indentSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();
    expect(prefs.indent).toBe(4);

    const wrapToggle = document.querySelector('#setting-wrap') as HTMLInputElement;
    wrapToggle.click();
    await flushPromises();
    expect(prefs.wrap).toBe(false);

    const reset = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Reset'),
    ) as HTMLButtonElement | undefined;
    expect(reset).toBeTruthy();
    reset!.click();
    await flushPromises();
    expect(prefs.theme).toBe('system');
    expect(prefs.indent).toBe(2);
    wrapper.unmount();
  });
});

describe('IntegrityPanel (ErrorBanner)', () => {
  const baseScan = {
    ok: true,
    error: null,
    scanSkipped: false,
    info: { duplicateKeys: [], duplicateElements: [], precisionNotes: 0, maxDepth: 1 },
  };

  it('shows the integrity report with duplicate-key and precision findings', () => {
    const wrapper = mount(ErrorBanner, {
      props: {
        error: null,
        scan: {
          ok: true,
          error: null,
          scanSkipped: false,
          info: {
            duplicateKeys: [{ pointer: '/a~1b', occurrences: 2 }],
            duplicateElements: [],
            precisionNotes: 3,
            maxDepth: 4,
          },
        },
      },
    });
    const text = wrapper.text();
    expect(text).toContain('Integrity report');
    expect(text).toContain('1 duplicate key');
    expect(text).toContain('3 precision-risk numbers');
    expect(text).toContain('"a/b"');
  });

  it('stays quiet when the document has no integrity risks', () => {
    const wrapper = mount(ErrorBanner, { props: { error: null, scan: baseScan } });
    expect(wrapper.text()).toContain('No structural risks found');
  });

  it('reports duplicate array elements with occurrence counts', () => {
    const wrapper = mount(ErrorBanner, {
      props: {
        error: null,
        scan: {
          ok: true,
          error: null,
          scanSkipped: false,
          info: {
            duplicateKeys: [],
            duplicateElements: [{ pointer: '/0', occurrences: 3 }],
            precisionNotes: 0,
            maxDepth: 2,
          },
        },
      },
    });
    const text = wrapper.text();
    expect(text).toContain('1 duplicate entry');
    expect(text).toContain('Duplicate array elements');
    expect(text).toContain('Element at 0 repeats 3 times with identical content');
  });

  it('describes syntax errors with 1-based line/column', () => {
    const wrapper = mount(ErrorBanner, {
      props: {
        error: { message: 'Unexpected token', offset: 25, line: 1, column: 4 },
        scan: null,
      },
    });
    const text = wrapper.text();
    expect(text).toContain('Invalid JSON');
    expect(text).toContain('Line 2, column 5');
    expect(text).toContain('Unexpected token');
  });
});

describe('SearchPanel', () => {
  it('emits debounced queries and match navigation', async () => {
    vi.useFakeTimers();
    const wrapper = mount(SearchPanel, {
      props: {
        resultCount: 3,
        truncated: false,
        activeIndex: 0,
        caseSensitive: false,
        matchKeys: true,
        matchValues: true,
      },
    });
    await wrapper.find('input[type="search"]').setValue('user');
    vi.advanceTimersByTime(300);
    await nextTick();
    expect(wrapper.emitted('update:query')?.[0]).toEqual(['user']);

    await wrapper.find('[aria-label="Next match"]').trigger('click');
    await wrapper.find('[aria-label="Previous match"]').trigger('click');
    expect(wrapper.emitted('next')).toHaveLength(1);
    expect(wrapper.emitted('previous')).toHaveLength(1);
    vi.useRealTimers();
  });
});

describe('EditorPane', () => {
  const colonError = {
    message: "Expected ':' after the property name.",
    offset: 11,
    line: 1,
    column: 12,
  };

  it('mirrors the offending slice when an error diagnostic is present', () => {
    const wrapper = mount(EditorPane, {
      props: { text: '{"language" "Galician"}', error: colonError },
    });
    const highlight = wrapper.find('[data-testid="error-highlight"]');
    expect(highlight.exists()).toBe(true);
    // The marked slice is the key plus the missing-colon gap (offsets 1..12).
    expect(highlight.find('.error-hl').text().trim()).toBe('"language"');
    expect(wrapper.find('[data-testid="json-input"]').exists()).toBe(true);
  });

  it('renders no highlight for valid or empty error states', () => {
    const valid = mount(EditorPane, { props: { text: '{"a": 1}', error: null } });
    expect(valid.find('[data-testid="error-highlight"]').exists()).toBe(false);

    const huge = mount(EditorPane, {
      props: { text: 'x'.repeat(1_600_000), error: { ...colonError, offset: 0 } },
    });
    expect(huge.find('[data-testid="error-highlight"]').exists()).toBe(false);
  });

  it('keeps the editor text layer above the highlight mirror', () => {
    // Paint-order regression: the mirror is absolutely positioned, so the
    // textarea must also be positioned (`relative`) or it paints beneath the
    // mirror's box and the document text becomes invisible once an error
    // highlight is mounted.
    const wrapper = mount(EditorPane, {
      props: { text: '{"name": "A", "language" "Galician"}', error: colonError },
    });
    const textareaClasses = wrapper.find('[data-testid="json-input"]').classes();
    expect(textareaClasses).toContain('relative');
    // The mirror itself must carry no opaque surface fill.
    expect(wrapper.find('[data-testid="error-highlight"]').classes()).not.toContain('bg-surface');
  });

  it('commits edits on input', async () => {
    vi.useFakeTimers();
    const wrapper = mount(EditorPane, { props: { text: '' } });
    await wrapper.find('[data-testid="json-input"]').setValue('{"a": 1}');
    expect(wrapper.emitted('update:text')?.[0]).toEqual(['{"a": 1}']);
    vi.advanceTimersByTime(400);
    expect(wrapper.emitted('commit')).toHaveLength(1);
    vi.useRealTimers();
  });

  it('revealError selects the offending slice in the textarea', async () => {
    vi.useFakeTimers();
    const wrapper = mount(EditorPane, {
      props: { text: '{"language" "Galician"}', error: colonError },
      attachTo: document.body,
    });
    await wrapper.vm.revealError();
    const input = document.querySelector('[data-testid="json-input"]') as HTMLTextAreaElement;
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(12);
    expect(document.activeElement).toBe(input);
    vi.useRealTimers();
    wrapper.unmount();
  });
});
