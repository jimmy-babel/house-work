<template>
  <AppShell
    label="Items Helper"
    title="家庭物品"
    badge="物品信息"
    :show-nav="false"
  >
    <StateBlock
      v-if="pageLoading || (sessionState.loading && !sessionState.initialized)"
      title="正在恢复登录状态"
      description="稍等一下，我们正在同步你的家庭与物品记录。"
    />

    <StateBlock
      v-else-if="sessionState.configError"
      title="缺少 Supabase 配置"
      :description="sessionState.configError"
    />

    <StateBlock
      v-else-if="sessionState.sessionError"
      title="恢复登录状态失败"
      :description="sessionState.sessionError"
    >
      <template #actions>
        <up-button type="primary" shape="circle" @click="reloadItemsPage">刷新页面</up-button>
      </template>
    </StateBlock>

    <ItemsPanel v-else-if="ready" ref="itemsPanelRef" />
  </AppShell>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppShell from '@/components/common/AppShell.vue'
import StateBlock from '@/components/common/StateBlock.vue'
import ItemsPanel from '@/components/items/ItemsPanel.vue'
import { ensureAuthenticatedPage, useSession } from '@/composables/useSession'

const { state: sessionState } = useSession()

const ready = ref(false)
const pageLoading = ref(true)
const itemsPanelRef = ref(null)

async function activateItemsPanel() {
  await nextTick()
  await itemsPanelRef.value?.activate?.()
}

function reloadItemsPage() {
  // #ifdef H5
  window.location.reload()
  // #endif

  // #ifndef H5
  uni.reLaunch({
    url: '/pages/items/index',
  })
  // #endif
}

onLoad(async () => {
  pageLoading.value = true

  const ok = await ensureAuthenticatedPage()
  if (!ok) {
    uni.reLaunch({
      url: '/pages/index/index',
    })
    return
  }

  ready.value = true
  pageLoading.value = false
  await activateItemsPanel()
})
</script>
