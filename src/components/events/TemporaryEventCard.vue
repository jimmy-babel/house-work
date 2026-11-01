<template>
  <view
    class="event-card"
    :class="{ 'event-card--completed': event.is_completed }"
    :style="{ backgroundColor: event.tag_color, transform: `rotate(${cardAngle(index)}deg)` }"
    @tap="$emit('select', event)"
  >
    <view class="event-card-top">
      <text class="event-label">{{ dateLabel(event.created_at) }}</text>
      <text v-if="showMenu" class="event-menu" @tap.stop="$emit('delete', event)">···</text>
    </view>
    <text class="event-content">{{ content }}</text>
    <view class="event-card-bottom">
      <text class="event-time">{{ timeLabel(event.created_at) }}</text>
      <view class="completion-control" @tap.stop="$emit('toggle-completed', event)">
        <text
          class="completion-box"
          :class="{
            'completion-box--checked': event.is_completed,
            'completion-box--busy': updating,
          }"
        >
          {{ updating ? '…' : event.is_completed ? '✓' : '' }}
        </text>
        <text class="completion-label">{{ event.is_completed ? '已完成' : '完成' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import dayjs from 'dayjs'

defineProps({
  event: { type: Object, required: true },
  content: { type: String, default: '' },
  index: { type: Number, default: 0 },
  showMenu: { type: Boolean, default: false },
  updating: { type: Boolean, default: false },
})

defineEmits(['select', 'delete', 'toggle-completed'])

function cardAngle(index) { return ((index % 3) - 1) * 0.25 }
function dateLabel(value) { return dayjs(value).format('YYYY.MM.DD') }
function timeLabel(value) { return dayjs(value).format('HH:mm') }
</script>

<style lang="scss" scoped>
.event-card {
  box-sizing: border-box;
  display: flex;
  width: calc(50% - 9rpx);
  min-height: 200rpx;
  flex-direction: column;
  padding: 24rpx 22rpx 18rpx;
  border: 1rpx solid rgba(117, 93, 72, 0.08);
  border-radius: 8rpx 26rpx 21rpx 25rpx;
  box-shadow: 0 15rpx 30rpx rgba(72, 56, 41, 0.09);
  transform-origin: center;
}

.event-card:nth-child(4n + 1) { border-radius: 26rpx 8rpx 25rpx 20rpx; }
.event-card:nth-child(4n + 2) { border-radius: 9rpx 24rpx 18rpx 26rpx; }

.event-card-top,
.event-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.event-label {
  color: rgba(77, 70, 61, 0.59);
  font-size: 22rpx;
  letter-spacing: 0.05em;
}

.event-menu {
  padding: 0 0 7rpx 12rpx;
  color: rgba(74, 65, 56, 0.52);
  font-size: 32rpx;
  line-height: 24rpx;
  cursor: pointer;
}

.event-content {
  display: -webkit-box;
  margin-top: 20rpx;
  overflow: hidden;
  color: rgba(78, 69, 59, 0.82);
  font-size: 22rpx;
  line-height: 1.65;
  word-break: break-all;
  white-space: pre-line;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
}

.event-card--completed .event-content {
  color: rgba(78, 69, 59, 0.58);
  text-decoration: line-through;
}

.event-card-bottom {
  gap: 8rpx;
  margin-top: auto;
  padding-top: 10rpx;
}

.event-time {
  color: rgba(72, 65, 56, 0.58);
  font-size: 20rpx;
}

.completion-control {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 5rpx 0 5rpx 10rpx;
  color: rgba(72, 65, 56, 0.55);
  font-size: 20rpx;
  cursor: pointer;
}

.completion-box {
  display: inline-flex;
  width: 34rpx;
  height: 34rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(102, 121, 97, 0.43);
  border-radius: 10rpx;
  background: rgba(255, 255, 255, 0.4);
  color: white;
  font-size: 23rpx;
  font-weight: 700;
}

.completion-box--checked {
  border-color: #77947d;
  background: #77947d;
}

.completion-box--busy { opacity: 0.75; }
.completion-label { min-width: 44rpx; }
</style>
