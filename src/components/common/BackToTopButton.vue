<template>
  <view class="back-to-top" @tap="scrollToTop">
    <text class="back-to-top__icon">↑</text>
  </view>
</template>

<script setup>
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
}

.back-to-top__icon {
  color: #fff8f3;
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1;
}
</style>
