import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import PopupApp from '@/entrypoints/popup/App.vue';

interface ChromeStub {
  runtime: {
    id: string;
    getURL: (path: string) => string;
    sendMessage: ReturnType<typeof vi.fn>;
  };
  tabs: {
    query: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  storage: {
    local: { get: (key: string) => Promise<Record<string, unknown>>; set: (value: object) => Promise<void> };
  };
}

const chromeStub: ChromeStub = {
  runtime: {
    id: 'test-extension-id',
    getURL: (path: string) => `chrome-extension://test-extension-id${path}`,
    sendMessage: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => undefined),
    },
  },
};

const originalChrome = (globalThis as unknown as { chrome?: unknown }).chrome;

function installChrome(): ChromeStub {
  chromeStub.runtime.sendMessage.mockReset();
  chromeStub.tabs.query.mockReset();
  chromeStub.tabs.create.mockReset();
  (globalThis as unknown as { chrome?: ChromeStub }).chrome = chromeStub;
  return chromeStub;
}

beforeEach(() => {
  setActivePinia(createPinia());
  window.localStorage.clear();
  installChrome();
});

afterEach(() => {
  (globalThis as unknown as { chrome?: unknown }).chrome = originalChrome;
});

describe('popup', () => {
  it('offers inspection for normal pages and captures JSON', async () => {
    const stub = installChrome();
    stub.tabs.query.mockResolvedValue([{ id: 1, url: 'https://api.example.com/data.json' }]);
    stub.runtime.sendMessage.mockResolvedValue({ status: 'captured', bytes: 10, contentType: 'application/json' });
    stub.tabs.create.mockResolvedValue({});

    const wrapper = mount(PopupApp, { attachTo: document.body });
    await flushPromises();

    const inspect = wrapper.find('[data-testid="inspect-page"]');
    expect(inspect.attributes('disabled')).toBeUndefined();

    await inspect.trigger('click');
    await flushPromises();
    // The background service worker opens the workspace; the popup relays via messaging.
    expect(stub.runtime.sendMessage).toHaveBeenCalledWith({ type: 'js:inspect' });
    expect(wrapper.text()).toMatch(/captured/i);
  });

  it('blocks inspection on restricted pages', async () => {
    const stub = installChrome();
    stub.tabs.query.mockResolvedValue([{ id: 1, url: 'chrome://version' }]);

    const wrapper = mount(PopupApp, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.find('[data-testid="inspect-page"]').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toMatch(/cannot be inspected|browser ui/i);
    expect(stub.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('reports graceful failure when no JSON is found', async () => {
    const stub = installChrome();
    stub.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com' }]);
    stub.runtime.sendMessage.mockResolvedValue({ status: 'nothing-found', detail: 'No JSON found on this page.' });

    const wrapper = mount(PopupApp, { attachTo: document.body });
    await flushPromises();

    await wrapper.find('[data-testid="inspect-page"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toMatch(/no json found/i);
    expect(stub.tabs.create).not.toHaveBeenCalled();
  });

  it('opens the plain workspace after a successful capture (no duplicated opens)', async () => {
    const stub = installChrome();
    stub.tabs.query.mockResolvedValue([{ id: 1, url: 'https://api.example.com/data.json' }]);
    stub.runtime.sendMessage.mockResolvedValue({ status: 'captured', bytes: 10 });
    stub.tabs.create.mockResolvedValue({});

    const wrapper = mount(PopupApp, { attachTo: document.body });
    await flushPromises();
    await wrapper.find('[data-testid="open-workspace"]').trigger('click');
    await flushPromises();
    expect(stub.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://test-extension-id/workspace.html' });
  });
});
