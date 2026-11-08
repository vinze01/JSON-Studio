import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'JSON Studio',
    description:
      'A modern, privacy-first JSON formatter, viewer, validator and developer utility. All processing happens locally.',
    permissions: ['storage', 'activeTab', 'scripting'],
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      128: '/icon/128.png',
    },
    action: {
      default_title: 'Open JSON Studio',
    },
    commands: {
      'open-workspace': {
        suggested_key: { default: 'Ctrl+Shift+J' },
        description: 'Open the JSON Studio workspace',
      },
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
  }),
});
