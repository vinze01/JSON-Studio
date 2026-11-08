import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import TreeView from '@/components/viewers/TreeView.vue';
import type { JsonValue } from '@/types';

beforeEach(() => {
  setActivePinia(createPinia());
  window.localStorage.clear();
});

function makeTree(data: JsonValue, activePointer: string | null = null) {
  return mount(TreeView, {
    props: { data, matchPointers: new Set<string>(), activePointer },
  });
}

describe('TreeView', () => {
  it('shows a placeholder for missing data', () => {
    const wrapper = makeTree(null);
    expect(wrapper.text()).toContain('Enter valid JSON');
  });

  it('renders the root expanded by default and collapses/re-expands on click', async () => {
    const wrapper = makeTree({ alpha: 1, beta: 'two' } as JsonValue);
    const rows = () => wrapper.findAll('[role="treeitem"]');
    expect(rows()).toHaveLength(3);
    expect(wrapper.text()).toContain('alpha');
    expect(wrapper.text()).toContain('"two"');

    await rows()[0]!.trigger('click');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.text()).toContain('2 keys');

    await rows()[0]!.trigger('click');
    expect(rows()).toHaveLength(3);
  });

  it('virtualizes long documents instead of rendering every row', () => {
    const items = Array.from({ length: 1500 }, (_, i) => i);
    const wrapper = makeTree(items);
    const rendered = wrapper.findAll('[role="treeitem"]').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(1500);
  });

  it('exposes expandAll and collapseAll with a guard for huge documents', async () => {
    const items = Array.from({ length: 60 }, (_, i) => i);
    const wrapper = makeTree(items);
    await (wrapper.vm as { expandAll: () => void }).expandAll();
    await (wrapper.vm as { revealPointer: (p: string) => void }).revealPointer('/59');
    await (wrapper.vm as { collapseAll: () => void }).collapseAll();
    expect(wrapper.findAll('[role="treeitem"]')).toHaveLength(1);
  });

  it('reveals deep search matches by expanding ancestors', async () => {
    const wrapper = makeTree({ a: { b: { c: { target: 1 } } } } as JsonValue);
    await (wrapper.vm as unknown as { revealPointer: (p: string) => void }).revealPointer('/a/b/c/target');
    expect(wrapper.text()).toContain('target');
    expect(wrapper.text()).toContain('1');
  });

  it('highlights matched rows', () => {
    const wrapper = mount(TreeView, {
      props: {
        data: { hit: 1 } as JsonValue,
        matchPointers: new Set(['/hit']),
        activePointer: '/hit',
      },
    });
    expect(wrapper.find('[aria-selected="true"]').exists()).toBe(true);
  });

  it('keeps expansion across a re-parse of the same structure (Format/Minify/Validate)', async () => {
    const wrapper = makeTree({ address: { city: 'SF' } } as JsonValue);
    // Root expanded: [root, address]. Click "address" to expand it: +city.
    expect(wrapper.findAll('[role="treeitem"]')).toHaveLength(2);
    await wrapper.findAll('[role="treeitem"]')[1]!.trigger('click');
    expect(wrapper.findAll('[role="treeitem"]')).toHaveLength(3);
    // Simulate Format: the same structure arrives as a fresh object graph.
    await wrapper.setProps({ data: { address: { city: 'SF' } } as JsonValue });
    // Expansion is preserved - "city" is still visible without a re-click.
    expect(wrapper.findAll('[role="treeitem"]')).toHaveLength(3);
    expect(wrapper.text()).toContain('city');
  });

  it('collapses back to the root when a different document arrives', async () => {
    const wrapper = makeTree({ a: { b: 1 }, c: { d: 2 } } as JsonValue);
    const expandAll = () => (wrapper.vm as unknown as { expandAll: () => void }).expandAll();
    await expandAll();
    // root + a + b + c + d
    expect(wrapper.findAll('[role="treeitem"]')).toHaveLength(5);
    await wrapper.setProps({ data: { totally: 'different' } as JsonValue });
    // root + totally
    expect(wrapper.findAll('[role="treeitem"]')).toHaveLength(2);
    expect(wrapper.text()).not.toContain('b');
  });
});
