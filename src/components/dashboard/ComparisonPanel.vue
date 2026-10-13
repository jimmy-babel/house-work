<template>
  <view class="page">
    <view class="filter-card">
      <view class="range-tabs">
        <view
          v-for="option in RANGE_OPTIONS"
          :key="option.key"
          class="range-tab"
          :class="{ 'range-tab--active': rangeKey === option.key }"
          @tap="switchRange(option.key)"
        >
          <text>{{ option.label }}</text>
        </view>
      </view>

      <view v-if="rangeKey === 'all'" class="custom-range">
        <picker mode="date" :value="customStart" @change="handleCustomStart">
          <view class="date-box">{{ customStart }}</view>
        </picker>
        <text class="range-sep">至</text>
        <picker mode="date" :value="customEnd" @change="handleCustomEnd">
          <view class="date-box">{{ customEnd }}</view>
        </picker>
        <view class="refresh-button" @tap="loadData">
          <text>刷新</text>
        </view>
      </view>
    </view>

    <StateBlock
      v-if="loading"
      title="正在加载对比数据"
      description="稍等一下，我们正在读取成员列表和已完成家务记录。"
    />

    <StateBlock
      v-else-if="!comparison.memberCards.length"
      title="还没有可对比的数据"
      description="先去记录几条家务，再回来查看家庭成员完成情况。"
    />

    <template v-else>
      <view class="member-grid">
        <view v-for="member in comparison.memberCards" :key="member.id" class="member-card">
          <text class="member-name">{{ member.display_name }}</text>
          <text class="member-count">{{ member.totalCount }} 次</text>
          <text class="member-latest">
            最近完成：{{ member.latestCompletedAt ? formatDateTime(member.latestCompletedAt) : '暂无记录' }}
          </text>
          <view v-if="member.categories.length" class="member-tags">
            <view v-for="item in member.categories" :key="item.name" class="member-tag">
              <text>{{ item.name }} {{ item.count }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="timeline-card">
        <text class="section-title">时间流水</text>
        <view v-for="group in visibleTimelineGroups" :key="group.date" class="timeline-group">
          <text class="timeline-date">{{ group.date }}</text>
          <view class="timeline-list">
            <view
              v-for="record in group.records"
              :key="record.id"
              class="timeline-swipe"
              :class="{ 'timeline-swipe--open': openedRecordId === record.id }"
              @touchstart="handleSwipeStart(record, $event)"
              @touchend="handleSwipeEnd(record, $event)"
              @mousedown="handleSwipeStart(record, $event)"
              @mouseup="handleSwipeEnd(record, $event)"
            >
              <view v-if="canOperateRecord(record)" class="timeline-actions">
                <view class="timeline-action timeline-action--edit" @tap.stop="openEditModal(record)">
                  <text>编辑</text>
                </view>
                <view class="timeline-action timeline-action--delete" @tap.stop="handleDeleteRecord(record)">
                  <text>删除</text>
                </view>
              </view>
              <view class="timeline-item" @tap="handleTimelineTap">
                <view class="timeline-main">
                  <text class="timeline-name">{{ record.memberName }}</text>
                  <text class="timeline-task">{{ record.chore_name_snapshot }}</text>
                </view>
                <view class="timeline-meta">
                  <text>{{ record.category_name_snapshot }}</text>
                  <text>{{ formatDateTime(record.completed_at) }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view v-if="allTimelineRecords.length" class="timeline-load-state">
          <text v-if="hasMoreRecords">滚动到底部加载更多</text>
          <text v-else>已加载全部记录</text>
        </view>
      </view>

      <view class="matrix-card">
        <text class="section-title">分类对比</text>
        <scroll-view scroll-x class="matrix-scroll">
          <view class="matrix-table">
            <view class="matrix-row matrix-row--head">
              <text class="matrix-cell matrix-cell--category">分类</text>
              <text v-for="member in comparison.memberCards" :key="member.id" class="matrix-cell">
                {{ member.display_name }}
              </text>
              <text class="matrix-cell">总计</text>
            </view>
            <view v-for="row in comparison.categoryMatrix" :key="row.category" class="matrix-row">
              <text class="matrix-cell matrix-cell--category">{{ row.category }}</text>
              <text
                v-for="member in comparison.memberCards"
                :key="`${row.category}-${member.id}`"
                class="matrix-cell"
              >
                {{ row[member.id] }}
              </text>
              <text class="matrix-cell">{{ row.total }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </template>

    <view v-if="showEditModal" class="edit-modal-mask" @tap="closeEditModal">
      <view class="edit-modal" @tap.stop>
        <text class="edit-modal__title">修改完成日期</text>
        <text class="edit-modal__title" style="font-weight: unset;">{{ editName }}</text>
        
        <picker mode="date" :value="editDate" @change="handleEditDateChange">
          <view class="edit-date-box">{{ editDate }}</view>
        </picker>
        <up-button
          type="primary"
          shape="circle"
          :loading="editing"
          @click="confirmEditRecord"
        >
          确认修改
        </up-button>
      </view>
    </view>

    <BackToTopButton />
  </view>
</template>

<script setup>
import dayjs from 'dayjs'
import { computed, reactive, ref } from 'vue'
import StateBlock from '@/components/common/StateBlock.vue'
import BackToTopButton from '@/components/common/BackToTopButton.vue'
import { useSession } from '@/composables/useSession'
import { RANGE_OPTIONS } from '@/constants/housework'
import {
  buildComparisonData,
  deleteCompletionRecord,
  fetchCompletionRecords,
  fetchFamilyMembers,
  updateCompletionRecordDate,
} from '@/services/housework'
import { formatDateTime, getToday, resolveDateRange } from '@/utils/date'
import { showError, showSuccess } from '@/utils/feedback'

const { state: sessionState } = useSession()

const loading = ref(false)
const rangeKey = ref('week')
const customStart = ref(getToday())
const customEnd = ref(getToday())
const openedRecordId = ref('')
const showEditModal = ref(false)
const editRecord = ref(null)
const editName = ref("")
const editDate = ref(getToday())
const editing = ref(false)
const touchState = reactive({
  recordId: '',
  startX: 0,
  startY: 0,
})
const comparison = reactive({
  memberCards: [],
  categoryMatrix: [],
  timelineGroups: [],
})
const justSwiped = ref(false)
const visibleRecordCount = ref(20)
const loadingMore = ref(false)

const currentUserId = computed(() => sessionState.profile?.id || '')
const allTimelineRecords = computed(() =>
  comparison.timelineGroups.flatMap((group) => group.records)
)
const visibleTimelineGroups = computed(() => {
  const visibleRecords = allTimelineRecords.value.slice(0, visibleRecordCount.value)
  const groups = []
  const dateMap = new Map()

  visibleRecords.forEach((record) => {
    if (!dateMap.has(record.completed_on)) {
      const group = { date: record.completed_on, records: [] }
      dateMap.set(record.completed_on, group)
      groups.push(group)
    }
    dateMap.get(record.completed_on).records.push(record)
  })

  return groups
})
const hasMoreRecords = computed(() => visibleRecordCount.value < allTimelineRecords.value.length)

function fillComparison(nextValue) {
  comparison.memberCards = nextValue.memberCards
  comparison.categoryMatrix = nextValue.categoryMatrix
  comparison.timelineGroups = nextValue.timelineGroups
  visibleRecordCount.value = 20
}

async function loadData() {
  if (!sessionState.profile?.family_id) return
  closeSwipe()

  if (rangeKey.value === 'all' && customStart.value > customEnd.value) {
    showError('开始日期不能晚于结束日期')
    return
  }

  loading.value = true
  try {
    const range = resolveDateRange(rangeKey.value, customStart.value, customEnd.value)
    const [members, records] = await Promise.all([
      fetchFamilyMembers(sessionState.profile.family_id),
      fetchCompletionRecords({
        familyId: sessionState.profile.family_id,
        startDate: range.startDate,
        endDate: range.endDate,
      }),
    ])

    fillComparison(buildComparisonData(members, records))
  } catch (error) {
    showError(error, '加载对比数据失败')
  } finally {
    loading.value = false
  }
}

function switchRange(nextKey) {
  rangeKey.value = nextKey
  closeSwipe()
  loadData()
}

function handleCustomStart(event) {
  customStart.value = event.detail.value
}

function handleCustomEnd(event) {
  customEnd.value = event.detail.value
}

function canOperateRecord(record) {
  return record.user_id === currentUserId.value
}

function closeSwipe() {
  openedRecordId.value = ''
}

function getSwipePoint(event) {
  return event.changedTouches?.[0] || event.touches?.[0] || event
}

function handleSwipeStart(record, event) {
  if (!canOperateRecord(record)) return

  const point = getSwipePoint(event)
  if (typeof point.clientX !== 'number' || typeof point.clientY !== 'number') return

  touchState.recordId = record.id
  touchState.startX = point.clientX
  touchState.startY = point.clientY
}

function handleSwipeEnd(record, event) {
  if (!canOperateRecord(record) || touchState.recordId !== record.id) return

  const point = getSwipePoint(event)
  if (typeof point.clientX !== 'number' || typeof point.clientY !== 'number') return

  const deltaX = point.clientX - touchState.startX
  const deltaY = point.clientY - touchState.startY
  if (Math.abs(deltaX) <= Math.abs(deltaY)) return
  
  if (deltaX < -42) {
    openedRecordId.value = record.id
    markJustSwiped();
    return
  }

  if (deltaX > 28 && openedRecordId.value === record.id) {
    markJustSwiped();
    closeSwipe()
  }
}

function openEditModal(record) {
  if (!canOperateRecord(record)) return

  editRecord.value = record
  editName.value = record.chore_name_snapshot
  editDate.value = record.completed_on
  showEditModal.value = true
  // closeSwipe()
}

function closeEditModal() {
  if (editing.value) return

  showEditModal.value = false
  editRecord.value = null
  editDate.value = getToday()
}

function handleEditDateChange(event) {
  editDate.value = event.detail.value
}

function buildCompletedAtForDate(record, nextDate) {
  const originalTime = dayjs(record.completed_at).format('HH:mm:ss')
  return dayjs(`${nextDate} ${originalTime}`).toISOString()
}

async function confirmEditRecord() {
  if (!editRecord.value || !sessionState.profile?.family_id) return

  editing.value = true
  try {
    await updateCompletionRecordDate({
      recordId: editRecord.value.id,
      familyId: sessionState.profile.family_id,
      userId: currentUserId.value,
      completedOn: editDate.value,
      completedAt: buildCompletedAtForDate(editRecord.value, editDate.value),
    })
    showSuccess('完成日期已更新')
    showEditModal.value = false
    editRecord.value = null
    editDate.value = getToday()
    await loadData()
  } catch (error) {
    showError(error, '编辑完成记录失败')
  } finally {
    editing.value = false
  }
}

function confirmDelete(record) {
  return new Promise((resolve) => {
    uni.showModal({
      title: '确认删除',
      content: `确定要删除「${record.chore_name_snapshot}」这条完成记录吗？`,
      confirmText: '删除',
      confirmColor: '#d84b3f',
      cancelText: '取消',
      success: (result) => {
        resolve(Boolean(result.confirm))
      },
      fail: () => {
        resolve(false)
      },
    })
  })
}

async function handleDeleteRecord(record) {
  if (!canOperateRecord(record) || !sessionState.profile?.family_id) return

  const confirmed = await confirmDelete(record)
  if (!confirmed) return

  try {
    await deleteCompletionRecord({
      recordId: record.id,
      familyId: sessionState.profile.family_id,
      userId: currentUserId.value,
    })
    showSuccess('完成记录已删除')
    closeSwipe()
    await loadData()
  } catch (error) {
    showError(error, '删除完成记录失败')
  }
}

function markJustSwiped() {
  justSwiped.value = true
  setTimeout(() => {
    justSwiped.value = false
  }, 120)
}

function handleTimelineTap() {
  if (justSwiped.value) return
  closeSwipe()
}

async function loadMore() {
  if (loadingMore.value || !hasMoreRecords.value) return

  loadingMore.value = true
  await Promise.resolve()
  visibleRecordCount.value += 20
  loadingMore.value = false
}

defineExpose({
  activate: loadData,
  loadMore,
})
</script>

<style lang="scss" scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.filter-card,
.matrix-card,
.timeline-card,
.member-card {
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(255, 251, 246, 0.92);
  box-shadow: 0 14rpx 36rpx rgba(88, 57, 38, 0.08);
}

.range-tabs,
.custom-range,
.member-grid,
.member-tags {
  display: flex;
  gap: 14rpx;
  flex-wrap: wrap;
}

.range-tab,
.date-box,
.refresh-button,
.member-tag {
  padding: 7rpx 15rpx;
  border-radius: 999rpx;
  background: #f5eadb;
  color: #705d50;
  font-size: 24rpx;
}

.range-tab--active {
  background: #2f241d;
  color: #fff7f1;
}

.range-sep {
  align-self: center;
  color: #7e6959;
  font-size: 24rpx;
}

.member-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260rpx, 1fr));
}

.member-card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.member-name {
  font-size: 34rpx;
  font-weight: 700;
  color: #2e221b;
}

.member-count {
  font-size: 50rpx;
  font-weight: 700;
  color: #c96a3d;
}

.member-latest {
  font-size: 24rpx;
  color: #7a6556;
}

.section-title {
  display: block;
  margin-bottom: 18rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #2e231c;
}

.matrix-scroll {
  width: 100%;
}

.matrix-table {
  min-width: 760rpx;
}

.matrix-row {
  display: flex;
  border-bottom: 2rpx solid rgba(132, 101, 82, 0.12);
}

.matrix-row--head {
  background: #f7efe4;
  border-radius: 20rpx 20rpx 0 0;
}

.matrix-cell {
  min-width: 120rpx;
  padding: 18rpx 14rpx;
  font-size: 24rpx;
  color: #554338;
}

.matrix-cell--category {
  min-width: 180rpx;
  font-weight: 700;
  color: #2f251e;
}

.timeline-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.timeline-group {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.timeline-date {
  font-size: 28rpx;
  font-weight: 700;
  color: #7f5a42;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.timeline-load-state {
  padding: 12rpx 0 4rpx;
  color: #8a7567;
  font-size: 22rpx;
  text-align: center;
}

.timeline-swipe {
  position: relative;
  overflow: hidden;
  border-radius: 22rpx;
  background: #ead8c8;
}

.timeline-actions {
  position: absolute;
  inset: 0 0 0 auto;
  width: 138rpx;
  display: flex;
  flex-direction: column;
}

.timeline-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff8f3;
  font-size: 24rpx;
  font-weight: 700;
}

.timeline-action--edit {
  background: #7f9476;
}

.timeline-action--delete {
  background: #d84b3f;
}

.timeline-item {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 20rpx;
  background: #f8f1e8;
  transition: transform 180ms ease;
}

.timeline-swipe--open .timeline-item {
  transform: translateX(-138rpx);
}

.timeline-main,
.timeline-meta {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.timeline-name {
  font-size: 28rpx;
  font-weight: 700;
  color: #2b221c;
}

.timeline-task,
.timeline-meta {
  font-size: 24rpx;
  color: #6f6054;
}

.edit-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background: rgba(0, 0, 0, 0.58);
}

.edit-modal {
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

.edit-modal__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #2f241d;
  text-align: center;
}

.edit-date-box {
  padding: 22rpx 24rpx;
  border: 2rpx solid rgba(153, 120, 93, 0.18);
  border-radius: 22rpx;
  background: #fffdf9;
  color: #2b211b;
  font-size: 30rpx;
  text-align: center;
}
</style>
