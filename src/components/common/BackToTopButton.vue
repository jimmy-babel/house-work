<template>
  <view
    class="back-to-top"
    :class="{ 'back-to-top--visible': visible }"
    @tap="scrollToTop"
  >
    <text class="back-to-top__icon">↑</text>
  </view>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

function scrollToTop() {
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 300,
  })
}
</script>

<style lang="scss" scoped>
.back-to-top {
  position: fixed;
  right: 28rpx;
  bottom: 28rpx;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 82rpx;
  height: 82rpx;
  border-radius: 50%;
  background: rgba(47, 36, 29, 0.9);
  box-shadow: 0 12rpx 28rpx rgba(47, 36, 29, 0.2);
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transform: translateX(calc(100% + 28rpx));
  transition: transform 280ms ease, opacity 280ms ease;
}

.back-to-top--visible {
  opacity: 0.68;
  pointer-events: auto;
  transform: translateX(0);
}

.back-to-top__icon {
  color: #fff8f3;
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1;
}
</style>
