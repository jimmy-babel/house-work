<template>
  <view class="shell" @tap="closeQuickSelect">
    <view v-if="showCard" class="hero" :class="{ 'hero--select-open': quickSelectOpen }">
      <view class="flex-s-c W100">
        <view v-if="!isHomePage" class="hero-back" aria-label="返回" @tap.stop="handlePageBack">
          <view class="hero-back-tip" />
        </view>
        <view class="flex-b-c flex-1">
          <view class="hero-copy">
            <text class="eyebrow">{{ label }}</text>
            <text class="title">{{ title }}</text>
            <!-- <text v-if="subtitle" class="subtitle">{{ subtitle }}</text> -->
          </view>
          <AppSelect
            v-if="badge && badgeOptions.length"
            class="hero-badge-picker"
            :options="badgeOptions"
            :model-value="currentQuickEntryKey"
            :trigger-label="badge"
            @select="handleBadgeOptionSelect"
            @open-change="handleQuickSelectOpenChange"
          />
          <view v-else-if="badge" class="hero-badge">{{ badge }}</view>
        </view>
      </view>
    </view>

    <view v-if="showNav" class="nav">
      <view
        v-for="item in navItems"
        :key="item.key"
        class="nav-item"
        :class="{ 'nav-item--active': item.key === currentKey }"
        @tap="go(item)"
      >
        <text class="nav-label">{{ item.label }}</text>
      </view>
    </view>

    <view class="shell-body">
      <slot :navigate="navigateQuickEntry" />
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { APP_NAV_ITEMS } from '@/constants/housework'
import AppSelect from '@/components/common/AppSelect.vue'

const emit = defineEmits(['nav-change'])

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  subtitle: {
    type: String,
    default: '',
  },
  badge: {
    type: String,
    default: '',
  },
  badgeOptions: {
    type: Array,
    default: () => [],
  },
  currentQuickEntryKey: {
    type: String,
    default: '',
  },
  currentKey: {
    type: String,
    default: '',
  },
  showNav: {
    type: Boolean,
    default: true,
  },
  showCard: {
    type: Boolean,
    default: true,
  },
  navMode: {
    type: String,
    default: 'route',
  },
  label: {
    type: String,
    default: '',
  },
})

const quickSelectOpen = ref(false)
const navItems = APP_NAV_ITEMS
const pages = getCurrentPages()
const currentRoute = pages[pages.length - 1]?.route || ''
const isHomePage = currentRoute === 'pages/index/index'

function handleBadgeOptionSelect(selected) {
  navigateQuickEntry(selected, { replaceCurrent: true })
}

function handleQuickSelectOpenChange(value) {
  quickSelectOpen.value = value
}

function closeQuickSelect() {
  quickSelectOpen.value = false
}

function handlePageBack() {
  const currentPages = getCurrentPages()
  if (currentPages.length > 1) {
    uni.navigateBack()
    return
  }

  uni.reLaunch({ url: '/pages/index/index' })
}

function navigateQuickEntry(item, { replaceCurrent = false } = {}) {
  if (!item?.url) return

  if (item.target === 'tab' && props.navMode === 'emit') {
    if (item.tabKey !== props.currentKey) emit('nav-change', item.tabKey)
    return
  }

  if (item.key === props.currentQuickEntryKey) return

  const route = item.url.split('?')[0].replace(/^\//, '')
  const pages = getCurrentPages()
  const currentRoute = pages[pages.length - 1]?.route
  if (route === currentRoute) return

  if (replaceCurrent) {
    uni.redirectTo({ url: item.url })
    return
  }

  uni.navigateTo({ url: item.url })
}

function go(item) {
  if (item.key === props.currentKey) return

  if (props.navMode === 'emit' || !item.url) {
    emit('nav-change', item.key)
    return
  }

  uni.navigateTo({
    url: item.url,
  })
}
</script>

<style lang="scss" scoped>
.shell {
  padding: 30rpx;
  max-width: 1280px;
  margin: 0 auto;
}

.hero {
  position: relative;
  z-index: 0;
  overflow: visible;
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding: 20rpx 25rpx 20rpx 20rpx;
  border: 2rpx solid rgba(201, 106, 61, 0.12);
  border-radius: 32rpx;
  background:
    linear-gradient(135deg, rgba(255, 249, 240, 0.96), rgba(245, 232, 219, 0.92)),
    #fff9f0;
  box-shadow: 0 18rpx 40rpx rgba(85, 56, 38, 0.08);
  margin-bottom: 16rpx;
}

.hero::after {
  content: '';
  position: absolute;
  inset: auto 0 0 auto;
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(201, 106, 61, 0.18), rgba(201, 106, 61, 0));
  pointer-events: none;
}

.hero-back {
  // position: absolute;
  // z-index: 2;
  // top: 50%;
  // left: -38px;
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(201, 106, 61, 0.1);
  cursor: pointer;
  margin-right: 30rpx;
  box-shadow: 0 0 20rpx 1px rgba($color: #ccc, $alpha: 0.3);
}

.hero-back-tip {
  width: 8px;
  height: 8px;
  border-top: 2px solid #a77a5d;
  border-left: 2px solid #a77a5d;
  transform: translateX(2px) rotate(-45deg);
}

.hero--select-open {
  z-index: 20;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}

.eyebrow {
  font-size: 22rpx;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #8e694f;
  font-weight: 600;
}

.title {
  font-size: 48rpx;
  font-weight: 700;
  color: #281d17;
}

.subtitle {
  font-size: 26rpx;
  line-height: 1.65;
  color: #6d5d52;
}

.hero-badge {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  align-self: flex-start;
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  background: #c96a3d;
  color: #fff8f2;
  font-size: 22rpx;
  font-weight: 600;
  white-space: nowrap;
}

.hero-badge-picker {
  position: relative;
  z-index: 1;
  flex: none;
}

.nav {
  display: flex;
  flex-wrap: nowrap;
  gap: 8rpx;
  margin-top: 18rpx;
  margin-bottom: 18rpx;
  padding: 8rpx;
  border: 2rpx solid rgba(166, 142, 119, 0.33);
  border-radius: 20rpx;
  background: rgba(255, 253, 247, 0.82);
}

.nav-item {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 64rpx;
  padding: 0 20rpx;
  border-radius: 14rpx;
  background: transparent;
  cursor: pointer;
}
@media screen and (min-width: 900px) {
  .nav-item {
  min-height: 86rpx;
  }
}

.nav-item--active {
  background: #987657;
  box-shadow: 0 5rpx 12rpx rgba(117, 84, 54, 0.15);
}

.nav-label {
  font-size: 24rpx;
  color: #8e7b69;
}

.nav-item--active .nav-label {
  color: #fffaf3;
}

.shell-body {
  // margin-top: 22rpx;
}
</style>
