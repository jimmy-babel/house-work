<template>
  <view class="shell">
    <view class="hero">
      <view class="hero-copy">
        <text class="eyebrow">{{ label }}</text>
        <text class="title">{{ title }}</text>
        <text v-if="subtitle" class="subtitle">{{ subtitle }}</text>
      </view>
      <view v-if="badge" class="hero-badge">{{ badge }}</view>
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
      <slot />
    </view>
  </view>
</template>

<script setup>
import { APP_NAV_ITEMS } from '@/constants/housework'

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
  currentKey: {
    type: String,
    default: '',
  },
  showNav: {
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

const navItems = APP_NAV_ITEMS

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
  max-width: 840px;
  margin: 0 auto;
}

.hero {
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding: 36rpx;
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
  inset: auto -20rpx -48rpx auto;
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(201, 106, 61, 0.18), rgba(201, 106, 61, 0));
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
  align-self: flex-start;
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  background: #c96a3d;
  color: #fff8f2;
  font-size: 22rpx;
  font-weight: 600;
  white-space: nowrap;
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 18rpx;
  margin-bottom: 18rpx;
}

.nav-item {
  padding: 10rpx 20rpx;
  border: 2rpx solid rgba(158, 123, 97, 0.18);
  border-radius: 999rpx;
  background: rgba(255, 250, 244, 0.82);
}

.nav-item--active {
  background: #2f241d;
  border-color: #2f241d;
}

.nav-label {
  font-size: 24rpx;
  color: #694f3d;
}

.nav-item--active .nav-label {
  color: #fff8f3;
}

.shell-body {
  // margin-top: 22rpx;
}
</style>
