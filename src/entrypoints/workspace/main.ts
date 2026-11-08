import { createPinia, setActivePinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import '@/assets/styles/main.css';
import { usePreferencesStore } from '@/stores/preferences';

const pinia = createPinia();
setActivePinia(pinia);

const preferences = usePreferencesStore();

// Preferences must be resolved before the first paint to avoid a theme flash.
void preferences.load().then(() => {
  createApp(App).use(pinia).mount('#app');
});
