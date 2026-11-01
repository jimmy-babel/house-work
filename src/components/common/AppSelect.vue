<template>
  <view class="app-select" @tap.stop>
    <view
      class="app-select__trigger"
      :aria-expanded="String(open)"
      @tap="toggle"
    >
      <text class="app-select__trigger-label">{{ triggerLabel }}</text>
      <view class="app-select__arrow" :class="{ 'app-select__arrow--open': open }" />
    </view>

    <view v-if="open" class="app-select__backdrop" @tap.stop="dismiss" />

    <transition name="app-select-dropdown">
      <view v-if="open" class="app-select__menu">
        <view
          v-for="option in options"
          :key="option.key"
          class="app-select__option"
          :class="{ 'app-select__option--active': option.key === modelValue }"
          @tap.stop="selectOption(option)"
        >
          <text class="app-select__option-label">{{ option.label }}</text>
        </view>
      </view>
    </transition>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'

const emit = defineEmits(['select', 'open-change'])

const props = defineProps({
  options: {
    type: Array,
    default: () => [],
  },
  modelValue: {
    type: String,
    default: '',
  },
  triggerLabel: {
    type: String,
    default: '',
  },
})

const open = ref(false)

watch(open, (value) => emit('open-change', value))

function toggle() {
  open.value = !open.value
}

function dismiss() {
  open.value = false
}

function selectOption(option) {
  dismiss()
  emit('select', option)
}
</script>

<style lang="scss" scoped>
.app-select {
  position: relative;
  z-index: 1;
  align-self: flex-start;
  flex: none;
}

.app-select__trigger {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 12rpx 20rpx;
  border: 1px solid rgba(255, 248, 242, 0.24);
  border-radius: 999rpx;
  background: #c96a3d;
  color: #fff8f2;
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 0 15rpx 1px rgba(200, 105, 65,0.5);

}

.app-select__trigger-label {
  color: inherit;
}

.app-select__arrow {
  width: 12rpx;
  height: 12rpx;
  border-right: 4rpx solid currentColor;
  border-bottom: 4rpx solid currentColor;
  transform: translateY(-3rpx) rotate(45deg);
  transition: transform 180ms ease;
}

.app-select__arrow--open {
  transform: translateY(3rpx) rotate(225deg);
}

.app-select__menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 40;
  width: max-content;
  min-width: 100%;
  max-width: calc(100vw - 40px);
  padding: 8px;
  border: 1px solid rgba(201, 106, 61, 0.16);
  border-radius: 16px;
  background: rgba(255, 251, 246, 0.98);
  box-shadow: 0 14px 36px rgba(47, 36, 29, 0.2);
  transform-origin: top right;
}

.app-select__backdrop {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  background: transparent;
  cursor: pointer;
}

.app-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 46px;
  padding: 0 14px;
  border-radius: 10px;
  color: #6d5544;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
}

.app-select__option + .app-select__option {
  margin-top: 2px;
}

.app-select__option--active {
  background: #f5e7d9;
  color: #a94f2b;
  font-weight: 700;
}

.app-select__option-label {
  color: inherit;
}

.app-select-dropdown-enter-active,
.app-select-dropdown-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.app-select-dropdown-enter-from,
.app-select-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

@media screen and (max-width: 480px) {
  .app-select__menu {
    max-width: calc(100vw - 32px);
  }

  .app-select__option {
    min-height: 44px;
    font-size: 15px;
  }
}
</style>
