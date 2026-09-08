<template>
  <view class="page">
    <StateBlock
      v-if="loading"
      title="正在加载家庭信息"
      description="稍等一下，我们正在同步家庭成员与邀请码。"
    />

    <template v-else>
      <view class="card">
        <text class="card-title">{{ familyName }}</text>
        <text class="card-subtitle">当前登录成员：{{ currentName }}</text>
        <view class="info-row">
          <view class="info-box">
            <text class="info-label">家庭码</text>
            <text class="info-value">{{ familyJoinCode }}</text>
          </view>
          <view class="copy-button" @tap="handleCopyCode">
            <text>复制家庭码</text>
          </view>
        </view>
      </view>

      <view class="card">
        <text class="card-title">家庭成员</text>
        <view v-if="members.length" class="member-list">
          <view v-for="member in members" :key="member.id" class="member-item">
            <view class="member-main">
              <text class="member-name">
                {{ member.display_name }}
                <text v-if="member.id === currentUserId" class="member-self">（你）</text>
              </text>
              <text class="member-meta">{{ member.role === 'owner' ? '创建者' : '成员' }}</text>
            </view>
            <text class="member-date">{{ formatDate(member.created_at) }} 加入</text>
          </view>
        </view>
        <text v-else class="empty-text">当前还没有成员数据。</text>
      </view>

      <up-button type="error" shape="circle" @click="handleSignOut">退出登录</up-button>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import StateBlock from '@/components/common/StateBlock.vue'
import { signOutAndReset, useSession } from '@/composables/useSession'
import { fetchFamilyMembers } from '@/services/housework'
import { formatDate } from '@/utils/date'
import { copyText, showError, showSuccess } from '@/utils/feedback'

const { state: sessionState } = useSession()

const loading = ref(false)
const members = ref([])

const familyData = computed(() => {
  const family = sessionState.profile?.family
  return Array.isArray(family) ? family[0] : family
})

const currentUserId = computed(() => sessionState.profile?.id || '')
const currentName = computed(() => sessionState.profile?.display_name || '家庭成员')
const familyName = computed(() => familyData.value?.name || '未加入家庭')
const familyJoinCode = computed(() => familyData.value?.join_code || '--')

async function loadFamily() {
  if (!sessionState.profile?.family_id) return
  console.log('ProfilePanel 加载数据')

  loading.value = true
  try {
    members.value = await fetchFamilyMembers(sessionState.profile.family_id)
  } catch (error) {
    showError(error, '加载家庭信息失败')
  } finally {
    loading.value = false
  }
}

function handleCopyCode() {
  if (familyJoinCode.value && familyJoinCode.value !== '--') {
    copyText(familyJoinCode.value, '家庭码已复制')
  }
}

async function handleSignOut() {
  try {
    await signOutAndReset()
    showSuccess('已退出登录')
    uni.reLaunch({
      url: '/pages/index/index',
    })
  } catch (error) {
    showError(error, '退出失败')
  }
}

defineExpose({
  activate: loadFamily,
})
</script>

<style lang="scss" scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(255, 251, 246, 0.92);
  box-shadow: 0 14rpx 36rpx rgba(88, 57, 38, 0.08);
}

.card-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #2d221b;
}

.card-subtitle,
.member-date,
.member-meta,
.empty-text {
  font-size: 24rpx;
  color: #726255;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  align-items: center;
  flex-wrap: wrap;
}

.info-box {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.info-label {
  font-size: 24rpx;
  color: #8a7463;
}

.info-value {
  font-size: 42rpx;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #c96a3d;
}

.copy-button {
  padding: 14rpx 20rpx;
  border-radius: 999rpx;
  background: #2e241d;
  color: #fff8f3;
  font-size: 24rpx;
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.member-item {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
  background: #f7efe4;
}

.member-main {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.member-name {
  font-size: 28rpx;
  font-weight: 700;
  color: #2e241d;
}

.member-self {
  color: #c96a3d;
}
</style>
