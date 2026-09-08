<template>
  <view class="state-block">
    <text class="state-title">{{ title }}</text>
    <text v-if="description" class="state-description">{{ description }}</text>
    <view v-if="$slots.actions" class="state-actions">
      <slot name="actions" />
    </view>
  </view>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
})
</script>

<style lang="scss" scoped>
.state-block {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 36rpx 32rpx;
  border-radius: 28rpx;
  border: 2rpx dashed rgba(128, 102, 83, 0.22);
  background: rgba(255, 251, 246, 0.88);
  text-align: center;
}

.state-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #2d221b;
}

.state-description {
  font-size: 26rpx;
  line-height: 1.7;
  color: #6f5f53;
}

.state-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16rpx;
}
</style>
