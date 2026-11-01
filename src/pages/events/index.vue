<template>
  <AppShell
    label="LITTLE MOMENTS"
    nav-title="留言板"
    title="随手记 & 留言板"
    badge="留言板"
    :badge-options="QUICK_ENTRY_ITEMS"
    current-quick-entry-key="events"
    :show-nav="false"
  >
    <StateBlock v-if="pageLoading || (sessionState.loading && !sessionState.initialized)" title="正在恢复登录状态" description="稍等一下，我们正在同步你的家庭记录。" />
    <StateBlock v-else-if="sessionState.configError" title="缺少 Supabase 配置" :description="sessionState.configError" />
    <StateBlock v-else-if="sessionState.sessionError" title="恢复登录状态失败" :description="sessionState.sessionError">
      <template #actions><up-button type="primary" shape="circle" @click="reloadPage">刷新页面</up-button></template>
    </StateBlock>
    <TemporaryEventsPanel v-else-if="ready" />
  </AppShell>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppShell from '@/components/common/AppShell.vue'
import StateBlock from '@/components/common/StateBlock.vue'
import TemporaryEventsPanel from '@/components/events/TemporaryEventsPanel.vue'
import { ensureAuthenticatedPage, useSession } from '@/composables/useSession'
import { QUICK_ENTRY_ITEMS } from '@/constants/housework'

const { state: sessionState } = useSession()
const ready = ref(false)
const pageLoading = ref(true)

function reloadPage() {
  // #ifdef H5
  window.location.reload()
  // #endif
  // #ifndef H5
  uni.reLaunch({ url: '/pages/events/index' })
  // #endif
}

onLoad(async () => {
  const authenticated = await ensureAuthenticatedPage()
  if (!authenticated) {
    uni.reLaunch({ url: '/pages/index/index' })
    return
  }
  ready.value = true
  pageLoading.value = false
})
</script>
