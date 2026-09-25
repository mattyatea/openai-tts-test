import { createRouter, createWebHistory } from 'vue-router'

import LiveView from './views/LiveView.vue'
import PlaygroundView from './views/PlaygroundView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/playground' },
    { path: '/playground', name: 'playground', component: PlaygroundView, meta: { title: 'TTS プレイグラウンド' } },
    { path: '/live', name: 'live', component: LiveView, meta: { title: 'GPT Live → 自作TTS' } },
  ],
})
