import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'JSON Studio',
    description:
      'Privacy-first JSON formatter, viewer, validator & integrity checker. Finds duplicate keys, elements & precision risks. 100% local.',
    homepage_url: 'https://github.com/vinze01/JSON-Studio',
    permissions: ['storage', 'activeTab', 'scripting'],
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      128: '/icon/128.png',
    },
    action: {
      default_title: 'JSON Studio',
      default_icon: {
        16: '/icon/16.png',
        32: '/icon/32.png',
        48: '/icon/48.png',
        128: '/icon/128.png',
      },
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
