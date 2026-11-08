import { createPinia, setActivePinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import '@/assets/styles/main.css';
import { usePreferencesStore } from '@/stores/preferences';
import { applyTheme } from '@/lib/utils';

const pinia = createPinia();
setActivePinia(pinia);

const preferences = usePreferencesStore();

void preferences.load().then(() => {
  applyTheme(preferences.theme);
  createApp(App).use(pinia).mount('#app');
});
