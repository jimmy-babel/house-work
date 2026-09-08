import { createSSRApp } from 'vue'
import App from './App.vue'
import uviewPlus from 'uview-plus'
import { initSession } from '@/composables/useSession'

export function createApp() {
  const app = createSSRApp(App)
  app.use(uviewPlus)
  console.log('main.js')
  initSession()
  return {
    app,
  }
}
