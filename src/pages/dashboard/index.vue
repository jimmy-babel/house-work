<template>
  <AppShell
    :current-key="activeTab"
    label="Housework Helper"
    :title="shellContent.title"
    :subtitle="shellContent.subtitle"
    :badge="shellContent.badge"
    nav-mode="emit"
    @nav-change="handleTabChange"
  >
    <StateBlock
      v-if="pageLoading || (sessionState.loading && !sessionState.initialized)"
      title="正在恢复登录状态"
      description="稍等一下，我们正在同步你的家庭与家务记录。"
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
        <up-button type="primary" shape="circle" @click="reloadDashboard">刷新页面</up-button>
      </template>
    </StateBlock>

    <template v-else-if="ready">
      <view v-show="activeTab === 'chores'">
        <ChoresPanel ref="choresPanelRef" @confirmed="showComparisonRecords" />
      </view>
      <view v-show="activeTab === 'comparison'">
        <ComparisonPanel ref="comparisonPanelRef" />
      </view>
    </template>
  </AppShell>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import AppShell from '@/components/common/AppShell.vue'
import StateBlock from '@/components/common/StateBlock.vue'
import ChoresPanel from '@/components/dashboard/ChoresPanel.vue'
import ComparisonPanel from '@/components/dashboard/ComparisonPanel.vue'
import { ensureAuthenticatedPage, useSession } from '@/composables/useSession'

const { state: sessionState } = useSession()

const activeTab = ref('chores')
const ready = ref(false)
const pageLoading = ref(true)

const choresPanelRef = ref(null)
const comparisonPanelRef = ref(null)

const shellContentMap = {
  chores: {
    title: '今天做了哪些家务？',
    // subtitle: '从家务清单里点选已完成项目，确认后统一写入数据库。',
    badge: '记录家务',
  },
  comparison: {
    title: '完成记录',
    // subtitle: '按时间范围对比家庭成员完成次数，并查看逐条完成流水。',
    badge: '完成记录',
  },
}

const shellContent = computed(() => {
  const content = shellContentMap[activeTab.value] || shellContentMap.chores

  return {
    ...content,
    badge: content.badge,
  }
})

function resolveInitialTab(tab) {
  return ['chores', 'comparison'].includes(tab) ? tab : 'chores'
}

async function activateCurrentTab() {
  await nextTick()

  if (activeTab.value === 'chores') {
    console.log('Activating chores panel')
    await choresPanelRef.value?.activate?.()
    return
  }

  if (activeTab.value === 'comparison') {
    console.log('Activating comparison panel')
    await comparisonPanelRef.value?.activate?.()
    return
  }
}

async function handleTabChange(nextTab) {
  if (!nextTab || nextTab === activeTab.value) return

  activeTab.value = nextTab
  await activateCurrentTab()
}

async function showComparisonRecords() {
  activeTab.value = 'comparison'
  await activateCurrentTab()
}

function reloadDashboard() {
  // #ifdef H5
  window.location.reload()
  // #endif

  // #ifndef H5
  uni.reLaunch({
    url: `/pages/dashboard/index?tab=${activeTab.value}`,
  })
  // #endif
}

onLoad(async (query) => {
  activeTab.value = resolveInitialTab(query?.tab)
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
  await activateCurrentTab()
})

onReachBottom(() => {
  if (activeTab.value === 'comparison') {
    comparisonPanelRef.value?.loadMore?.()
  }
})
</script>
