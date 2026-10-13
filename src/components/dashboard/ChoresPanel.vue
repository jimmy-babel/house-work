<template>
  <view class="panel">
    <StateBlock
      v-if="loading"
      title="正在加载家务清单"
      description="稍等一下，我们正在同步当前家庭的家务源数据。"
    />

    <StateBlock
      v-else-if="!groupedChores.length"
      title="还没有家务源数据"
      description="请先执行一次源数据导入脚本，把 Excel 里的家务清单同步到 Supabase。"
    />

    <template v-else>
      <!-- #ifdef H5 -->
      <scroll-view scroll-x class="desktop-scroll">
        <view class="desktop-board">
          <view v-for="group in groupedChores" :key="group.category" class="category-column">
            <view class="category-header" :style="{ borderColor: categoryColor(group.category) }">
              <text class="category-title">{{ group.category }}</text>
              <text class="category-count">{{ group.items.length }} 项</text>
            </view>
            <view class="item-list">
              <view
                v-for="item in group.items"
                :key="item.id"
                :class="['chore-item', { 'chore-item--overdue': item.isOverdue }]"
                @click="addCatalogPending(item)"
              >
                <text class="chore-name">{{ item.name }}</text>
                <text v-if="item.frequency_code" class="chore-frequency">
                  {{ frequencyLabel(item.frequency_code) }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
      <!-- #endif -->

      <!-- #ifndef H5 -->
      <view class="mobile-board">
        <view v-for="group in groupedChores" :key="group.category" class="mobile-group">
          <view class="category-header" :style="{ borderColor: categoryColor(group.category) }">
            <text class="category-title">{{ group.category }}</text>
            <text class="category-count">{{ group.items.length }} 项</text>
          </view>
          <view class="item-list item-list--mobile">
            <view
              v-for="item in group.items"
              :key="item.id"
              :class="['chore-item', { 'chore-item--overdue': item.isOverdue }]"
              @click="addCatalogPending(item)"
            >
              <text class="chore-name">{{ item.name }}</text>
              <text v-if="item.frequency_code" class="chore-frequency">
                {{ frequencyLabel(item.frequency_code) }}
              </text>
            </view>
          </view>
        </view>
      </view>
      <!-- #endif -->
    </template>

    <view class="pending-tray">
      <view class="tray-top">
        <view class="tray-title-wrap">
          <text class="tray-title">待确认列表</text>
          <view class="tray-add-button" @tap="openCustomModal">
            <text class="tray-add-button__label">+</text>
          </view>
        </view>
        <view class="tray-date-actions">
          <view
            :class="['date-quick-button', { 'date-quick-button--active': isYesterdaySelected }]"
            @tap="selectYesterday"
          >
            <text>昨日</text>
          </view>
          <view
            :class="['date-quick-button', { 'date-quick-button--active': isTodaySelected }]"
            @tap="selectToday"
          >
            <text>今日</text>
          </view>
          <picker mode="date" :value="selectedDate" @change="handleDateChange">
            <view class="date-pill">
              <text>{{ selectedDate }}</text>
            </view>
          </picker>
        </view>
      </view>

      <view v-if="pendingItems.length" class="pending-tags">
        <view v-for="item in pendingItems" :key="item.key" class="pending-tag">
          <text class="pending-tag__name">{{ item.name }}</text>
          <text class="pending-tag__remove" @tap.stop="removePending(item.key)">×</text>
        </view>
      </view>
      <text v-else class="pending-empty">
        请选择你需要记录的家务
      </text>

      <up-button
        type="primary"
        shape="circle"
        :disabled="!pendingItems.length || submitting"
        :loading="submitting"
        @click="handleConfirm"
      >
        确认 {{ pendingItems.length }} 条家务
      </up-button>
    </view>

    <view v-if="showCustomModal" class="custom-modal-mask" @tap="closeCustomModal">
      <view class="custom-modal" @tap.stop>
        <text class="custom-modal__title">自定义家务名称</text>
        <input
          v-model.trim="customInput"
          class="custom-modal__input"
          placeholder="请输入家务内容"
          maxlength="40"
          confirm-type="done"
          @confirm="confirmCustomTask"
        />
        <up-button type="primary" shape="circle" @click="confirmCustomTask">确认添加</up-button>
      </view>
    </view>

    <BackToTopButton class="back-to-top--chores" />
  </view>
</template>

<script setup>
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import StateBlock from '@/components/common/StateBlock.vue'
import BackToTopButton from '@/components/common/BackToTopButton.vue'
import { useSession } from '@/composables/useSession'
import {
  CATEGORY_COLORS,
  CATEGORY_ORDER,
  CUSTOM_CATEGORY_NAME,
  FREQUENCY_LABELS,
  FREQUENCY_WINDOWS,
  GL_FREQUENCY_PREFIX,
} from '@/constants/housework'
import {
  createCompletionRecords,
  fetchChoreCatalog,
  fetchFamilyChoreReminderState,
  normalizeChoreName,
} from '@/services/housework'
import { getNowIsoForDate, getToday, getYesterday } from '@/utils/date'
import { showError, showSuccess } from '@/utils/feedback'

const emit = defineEmits(['confirmed'])
const { state: sessionState } = useSession()

const loading = ref(false)
const submitting = ref(false)
const selectedDate = ref(getToday())
const choreItems = ref([])
const reminderState = ref({
  byName: {},
  byFrequencyCode: {},
})
const pendingItems = ref([])
const showCustomModal = ref(false)
const customInput = ref('')
let pendingSeed = 0
const MAX_FREQUENCY_WINDOW_DAYS = Math.max(...Object.values(FREQUENCY_WINDOWS))
const isTodaySelected = computed(() => selectedDate.value === getToday())
const isYesterdaySelected = computed(() => selectedDate.value === getYesterday())

const groupedChores = computed(() =>
  CATEGORY_ORDER.map((category) => ({
    category,
    items: choreItems.value
      .filter((item) => item.category_name === category)
      .map((item) => ({
        ...item,
        isOverdue: isOverdueChore(item),
      })),
  })).filter((group) => group.items.length > 0)
)

function frequencyLabel(code) {
  return FREQUENCY_LABELS[code] || code
}

function categoryColor(category) {
  return CATEGORY_COLORS[category] || '#c96a3d'
}

function getReminderStartDate() {
  return dayjs().subtract(MAX_FREQUENCY_WINDOW_DAYS - 1, 'day').format('YYYY-MM-DD')
}

function getReminderBusinessDate() {
  const now = dayjs()
  return now.hour() < 7 ? now.subtract(1, 'day').format('YYYY-MM-DD') : now.format('YYYY-MM-DD')
}

function isGlFrequencyCode(code) {
  return typeof code === 'string' && code.startsWith(`${GL_FREQUENCY_PREFIX}-`)
}

function getGlParentCodes(code) {
  if (!isGlFrequencyCode(code)) {
    return []
  }

  const parts = code.split('-')
  if (parts.length <= 2) {
    return []
  }

  return parts.slice(2).map((_, index) => parts.slice(0, index + 2).join('-'))
}

function isNormalFrequencyOverdue(item) {
  const windowDays = FREQUENCY_WINDOWS[item.frequency_code]
  if (!windowDays) {
    return false
  }

  const latestCompletedOn = reminderState.value.byName[normalizeChoreName(item.name)]
  if (!latestCompletedOn) {
    return true
  }

  const diffDays = dayjs(getReminderBusinessDate())
    .startOf('day')
    .diff(dayjs(latestCompletedOn).startOf('day'), 'day')

  return diffDays >= windowDays
}

function isGlChoreOverdue(item) {
  const parentCodes = getGlParentCodes(item.frequency_code)
  if (!parentCodes.length) {
    return false
  }

  const itemCompletion = reminderState.value.byFrequencyCode[item.frequency_code]
  return parentCodes.some((parentCode) => {
    const parentCompletion = reminderState.value.byFrequencyCode[parentCode]
    if (!parentCompletion) {
      return false
    }

    if (!itemCompletion) {
      return true
    }

    return dayjs(itemCompletion.completedAt).isBefore(dayjs(parentCompletion.completedAt))
  })
}

function isOverdueChore(item) {
  if (isGlFrequencyCode(item.frequency_code)) {
    return isGlChoreOverdue(item)
  }

  return isNormalFrequencyOverdue(item)
}

function nextPendingKey(prefix = 'pending') {
  pendingSeed += 1
  return `${prefix}-${pendingSeed}`
}

function addCatalogPending(item) {
  pendingItems.value.push({
    key: nextPendingKey(item.id),
    type: 'catalog',
    choreId: item.id,
    name: item.name,
  })
}

function addCustomPending(name) {
  pendingItems.value.push({
    key: nextPendingKey('custom'),
    type: 'custom',
    name,
    categoryName: CUSTOM_CATEGORY_NAME,
  })
}

function removePending(key) {
  pendingItems.value = pendingItems.value.filter((item) => item.key !== key)
}

function handleDateChange(event) {
  selectedDate.value = event.detail.value
}

function selectToday() {
  selectedDate.value = getToday()
}

function selectYesterday() {
  selectedDate.value = getYesterday()
}

function openCustomModal() {
  customInput.value = ''
  showCustomModal.value = true
}

function closeCustomModal() {
  showCustomModal.value = false
  customInput.value = ''
}

function confirmCustomTask() {
  const taskName = customInput.value.trim()
  if (!taskName) {
    showError('请输入自定义家务内容')
    return
  }

  addCustomPending(taskName)
  closeCustomModal()
}

async function loadCatalog() {
  if (!sessionState.profile?.family_id) return

  loading.value = true
  try {
    const [catalog, nextReminderState] = await Promise.all([
      fetchChoreCatalog(),
      fetchFamilyChoreReminderState({
        familyId: sessionState.profile.family_id,
        startDate: getReminderStartDate(),
      }),
    ])

    choreItems.value = catalog
    reminderState.value = nextReminderState
  } catch (error) {
    showError(error, '加载家务清单失败')
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  if (!pendingItems.value.length) {
    showError('请先选择至少一项家务')
    return
  }

  submitting.value = true
  try {
    await createCompletionRecords({
      userId: sessionState.profile.id,
      familyId: sessionState.profile.family_id,
      items: pendingItems.value.map((item) => ({
        type: item.type,
        choreId: item.choreId,
        name: item.name,
      })),
      completedOn: selectedDate.value,
      completedAt: getNowIsoForDate(selectedDate.value),
    })

    pendingItems.value = []
    closeCustomModal()
    reminderState.value = await fetchFamilyChoreReminderState({
      familyId: sessionState.profile.family_id,
      startDate: getReminderStartDate(),
    })
    showSuccess('已成功添加')
    emit('confirmed')
  } catch (error) {
    showError(error, '添加家务失败')
  } finally {
    submitting.value = false
  }
}

defineExpose({
  activate: loadCatalog,
})
</script>

<style lang="scss" scoped>
.panel {
  padding-bottom: 320rpx;
}

.back-to-top--chores {
  bottom: 350rpx;
}

.desktop-scroll {
  width: 100%;
}

.desktop-board {
  display: flex;
  gap: 18rpx;
  min-width: 1600rpx;
}

.mobile-board {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.category-column,
.mobile-group {
  flex: 1;
  min-width: 240rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 251, 246, 0.92);
  box-shadow: 0 16rpx 36rpx rgba(88, 57, 38, 0.07);
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12rpx;
  padding-bottom: 18rpx;
  margin-bottom: 18rpx;
  border-bottom: 6rpx solid;
}

.category-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #2e231c;
}

.category-count {
  font-size: 22rpx;
  color: #8d7665;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.item-list--mobile {
  gap: 14rpx;
}

.chore-item {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 10rpx 7rpx 10rpx 15rpx;
  border-radius: 22rpx;
  background: #f9f1e7;
  border: 2rpx solid rgba(169, 137, 112, 0.14);
}

.chore-item--overdue {
  border-color: #d84b3f;
}

.chore-name {
  font-size: 24rpx;
  line-height: 1.3;
  color: #32251d;
  // flex:1;
}

.chore-frequency {
  align-self: flex-start;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: rgba(201, 106, 61, 0.12);
  color: #c96a3d;
  font-size: 18rpx;
}

.pending-tray {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 24rpx;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 20rpx 24rpx;
  border-radius: 30rpx;
  background: rgba(46, 35, 28, 0.94);
  box-shadow: 0 24rpx 50rpx rgba(39, 25, 17, 0.22);
  width: calc(100% - 60rpx);
  max-width: calc(700px - 60rpx);
}

.tray-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14rpx;
}

.tray-title-wrap {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.tray-date-actions {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.tray-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #fff;
}

.tray-add-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 45rpx;
  height: 45rpx;
  border-radius: 999rpx;
  background: rgba(255, 248, 241, 0.18);
}

.tray-add-button__label {
  font-size: 30rpx;
  line-height: 1.4;
  color: #fff8f3;
}

.date-pill {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 248, 241, 0.14);
  color: #fff6ef;
  font-size: 24rpx;
}

.date-quick-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 78rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(255, 248, 241, 0.14);
  color: #f3e9df;
  font-size: 24rpx;
  border: 4rpx solid transparent;
}

.date-quick-button--active {
  background: rgba(255, 248, 241, 0.26);
  border-color: rgba(255, 248, 241, 0.6);
  color: #ffffff;
}

.pending-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.pending-tag {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 248, 241, 0.12);
}

.pending-tag__name,
.pending-empty {
  font-size: 24rpx;
  color: #efefef;
}

.pending-empty{
  color: #afafaf;
}

.pending-tag__remove {
  font-size: 28rpx;
  line-height: 1;
  color: #ffd5c4;
}

.custom-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background: rgba(0, 0, 0, 0.58);
}

.custom-modal {
  width: 100%;
  max-width: 620rpx;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 32rpx;
  border-radius: 28rpx;
  background: #fffaf4;
  box-shadow: 0 30rpx 70rpx rgba(0, 0, 0, 0.18);
}

.custom-modal__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #2f241d;
  text-align: center;
}

.custom-modal__input {
  width: 100%;
  min-height: 88rpx;
  padding: 0 24rpx;
  border: 2rpx solid rgba(153, 120, 93, 0.18);
  border-radius: 22rpx;
  background: #fffdf9;
  font-size: 28rpx;
  // color: #2b211b;
}
</style>
