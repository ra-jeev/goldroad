import { createApp } from 'vue';
import '@fontsource-variable/chivo/wght.css';
import '@fontsource/marcellus/400.css';
import '#game/app/assets/css/main.css';
import './reddit.css';
import GameBoardMetrics from '#game/app/components/GameBoardMetrics.vue';
import PlayApp from './PlayApp.vue';

// The website's GameBoardHeader uses GameBoardMetrics through a Nuxt
// auto-import. Register it by name so that header finds it here too.
createApp(PlayApp).component('GameBoardMetrics', GameBoardMetrics).mount('#app');
