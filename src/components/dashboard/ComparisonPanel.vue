<template>
  <view class="page">
    <view class="summary-card">
      <view class="filter-card">
        <view class="filter-controls">
          <!-- <view class="range-tabs">
            <view
              v-for="option in RANGE_OPTIONS"
              :key="option.key"
              class="range-tab"
              :class="{ 'range-tab--active': rangeKey === option.key }"
              @tap="switchRange(option.key)"
            >
              <text>{{ option.label }}</text>
            </view>
          </view> -->

          <view v-if="rangeKey === 'all'" class="custom-range">
            <picker mode="date" :value="customStart" @change="handleCustomStart">
              <view class="date-box">{{ customStart }}</view>
            </picker>
            <text class="range-sep">至</text>
            <picker mode="date" :value="customEnd" @change="handleCustomEnd">
              <view class="date-box">{{ customEnd }}</view>
            </picker>
          </view>
        </view>
      </view>

      <view v-if="!loading && comparison.memberCards.length" class="member-grid">
        <view v-for="member in comparison.memberCards" :key="member.id" class="member-card">
          <text class="member-name">{{ member.display_name }}</text>
          <text class="member-count">{{ member.totalCount }} 次</text>
          <!-- <text class="member-latest">
            最近完成：{{ member.latestCompletedAt ? formatDateTime(member.latestCompletedAt) : '暂无记录' }}
          </text> -->
          <!-- <view v-if="member.categories.length" class="member-tags">
            <view v-for="item in member.categories" :key="item.name" class="member-tag">
              <text>{{ item.name }} {{ item.count }}</text>
            </view>
          </view> -->
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
      <view class="timeline-card">
        <!-- <text class="section-title">时间流水</text> -->
        <view v-for="group in visibleTimelineGroups" :key="group.date" class="timeline-group">
          <text class="timeline-date">{{ formatDateWithWeekday(group.date) }}</text>
          <view
            v-for="memberGroup in group.memberGroups"
            :key="memberGroup.userId"
            class="timeline-member-group"
          >
            <text class="timeline-member-name">{{ memberGroup.memberName }}</text>
            <view class="timeline-list">
              <view
                v-for="record in memberGroup.records"
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
                    <text class="timeline-task">{{ record.chore_name_snapshot }}</text>
                  </view>
                  <view class="timeline-meta">
                    <text class="timeline-category">{{ record.category_name_snapshot }}</text>
                    <text class="timeline-time">{{ formatDateTime(record.completed_at) }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view v-if="!allTimelineRecords.length && !loadingMore" class="timeline-load-state">
          <text>暂无完成记录</text>
        </view>
        <view v-if="allTimelineRecords.length || loadingMore" class="timeline-load-state">
          <text v-if="loadingMore">正在加载更多…</text>
          <text v-else-if="hasMoreRecords">滚动到底部加载更多</text>
          <text v-else>已加载全部记录</text>
        </view>
      </view>

      <!-- <view class="matrix-card">
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
      </view> -->
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

    <!-- <BackToTopButton :visible="backToTopVisible" /> -->
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
  fetchCompletionRecordStats,
  fetchFamilyMembers,
  updateCompletionRecordDate,
} from '@/services/housework'
import { formatDateTime, getToday, resolveDateRange } from '@/utils/date'
import { showError, showSuccess } from '@/utils/feedback'

defineProps({
  backToTopVisible: {
    type: Boolean,
    default: false,
  },
})
const { state: sessionState } = useSession()

const loading = ref(false)
const rangeKey = ref('all')
const customStart = ref('2026-01-01')
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
  dailyCheckins: [],
})
const justSwiped = ref(false)
const loadingMore = ref(false)
const hasMoreRecords = ref(false)
const nextEndDate = ref('')
const loadedMembers = ref([])
const loadedRecords = ref([])
const fullStats = ref({ members: [], daily_checkins: [] })
const DATE_PAGE_DAYS = 3
let requestSequence = 0

const currentUserId = computed(() => sessionState.profile?.id || '')
const allTimelineRecords = computed(() =>
  comparison.timelineGroups.flatMap((group) => group.records)
)
const visibleTimelineGroups = computed(() => {
  const visibleRecords = allTimelineRecords.value
  const groupsByDate = new Map()
  const firstCheckinByMember = new Map(
    comparison.dailyCheckins.map((item) => [
      `${item.completed_on}:${item.user_id}`,
      dayjs(item.first_completed_at).valueOf(),
    ])
  )

  visibleRecords.forEach((record) => {
    let group = groupsByDate.get(record.completed_on)
    if (!group) {
      group = { date: record.completed_on, memberGroupsById: new Map() }
      groupsByDate.set(record.completed_on, group)
    }

    let memberGroup = group.memberGroupsById.get(record.user_id)
    if (!memberGroup) {
      memberGroup = {
        userId: record.user_id,
        memberName: record.memberName,
        firstCheckinAt:
          firstCheckinByMember.get(`${record.completed_on}:${record.user_id}`) ??
          dayjs(record.completed_at).valueOf(),
        records: [],
      }
      group.memberGroupsById.set(record.user_id, memberGroup)
    }
    memberGroup.records.push(record)
  })

  return [...groupsByDate.values()].map((group) => ({
    date: group.date,
    memberGroups: [...group.memberGroupsById.values()].sort(
      (left, right) => left.firstCheckinAt - right.firstCheckinAt
    ),
  }))
})

function fillComparison(nextValue) {
  comparison.memberCards = nextValue.memberCards
  comparison.categoryMatrix = nextValue.categoryMatrix
  comparison.timelineGroups = nextValue.timelineGroups
  comparison.dailyCheckins = fullStats.value.daily_checkins || []
}

function getPagingDateRange(range) {
  return {
    startDate: range.startDate || '1900-01-01',
    endDate: range.endDate || getToday(),
  }
}

function getThreeDayWindow(endDate, startDate) {
  const windowStartDate = dayjs(endDate)
    .subtract(DATE_PAGE_DAYS - 1, 'day')
    .format('YYYY-MM-DD')

  return {
    startDate: windowStartDate < startDate ? startDate : windowStartDate,
    endDate,
  }
}

function getLatestRecordDateOnOrBefore(endDate, range, dailyCheckins) {
  return (dailyCheckins || []).reduce((latestDate, item) => {
    if (
      item.completed_on >= range.startDate &&
      item.completed_on <= endDate &&
      item.completed_on > latestDate
    ) {
      return item.completed_on
    }
    return latestDate
  }, '')
}

async function fetchNextRecordsBatch({ familyId, range, endDate, dailyCheckins }) {
  let cursorEndDate = endDate

  while (cursorEndDate >= range.startDate) {
    const latestRecordDate = getLatestRecordDateOnOrBefore(
      cursorEndDate,
      range,
      dailyCheckins
    )
    if (!latestRecordDate) {
      return {
        records: [],
        nextEndDate: dayjs(range.startDate).subtract(1, 'day').format('YYYY-MM-DD'),
        hasMore: false,
      }
    }

    const regularWindow = getThreeDayWindow(cursorEndDate, range.startDate)
    const windowEndDate = latestRecordDate < regularWindow.startDate
      ? dayjs(latestRecordDate).add(DATE_PAGE_DAYS - 1, 'day').format('YYYY-MM-DD')
      : cursorEndDate
    const window = getThreeDayWindow(windowEndDate, range.startDate)
    const records = await fetchCompletionRecords({
      familyId,
      startDate: window.startDate,
      endDate: window.endDate,
    })

    cursorEndDate = dayjs(window.startDate).subtract(1, 'day').format('YYYY-MM-DD')
    if (records.length) {
      return {
        records,
        nextEndDate: cursorEndDate,
        hasMore: Boolean(
          getLatestRecordDateOnOrBefore(cursorEndDate, range, dailyCheckins)
        ),
      }
    }
  }

  return {
    records: [],
    nextEndDate: cursorEndDate,
    hasMore: false,
  }
}

async function loadData() {
  const requestId = ++requestSequence
  if (!sessionState.profile?.family_id) return
  closeSwipe()
  loadingMore.value = false
  hasMoreRecords.value = false

  if (rangeKey.value === 'all' && customStart.value > customEnd.value) {
    showError('开始日期不能晚于结束日期')
    loading.value = false
    return
  }

  loading.value = true
  nextEndDate.value = ''
  loadedRecords.value = []
  try {
    const range = resolveDateRange(rangeKey.value, customStart.value, customEnd.value)
    const pagingRange = getPagingDateRange(range)
    const firstWindow = getThreeDayWindow(pagingRange.endDate, pagingRange.startDate)
    const [members, stats, firstRecords] = await Promise.all([
      fetchFamilyMembers(sessionState.profile.family_id),
      fetchCompletionRecordStats({
        familyId: sessionState.profile.family_id,
        startDate: range.startDate,
        endDate: range.endDate,
      }),
      fetchCompletionRecords({
        familyId: sessionState.profile.family_id,
        startDate: firstWindow.startDate,
        endDate: firstWindow.endDate,
      }),
    ])

    if (requestId !== requestSequence) return

    const batch = firstRecords.length
      ? {
          records: firstRecords,
          nextEndDate: dayjs(firstWindow.startDate).subtract(1, 'day').format('YYYY-MM-DD'),
          hasMore: Boolean(
            getLatestRecordDateOnOrBefore(
              dayjs(firstWindow.startDate).subtract(1, 'day').format('YYYY-MM-DD'),
              pagingRange,
              stats.daily_checkins
            )
          ),
        }
      : await fetchNextRecordsBatch({
          familyId: sessionState.profile.family_id,
          range: pagingRange,
          endDate: dayjs(firstWindow.startDate).subtract(1, 'day').format('YYYY-MM-DD'),
          dailyCheckins: stats.daily_checkins,
        })

    if (requestId !== requestSequence) return

    loadedMembers.value = members
    fullStats.value = stats
    loadedRecords.value = batch.records
    nextEndDate.value = batch.nextEndDate
    hasMoreRecords.value = batch.hasMore
    fillComparison(buildComparisonData(members, batch.records, stats))
  } catch (error) {
    if (requestId === requestSequence) showError(error, '加载对比数据失败')
  } finally {
    if (requestId === requestSequence) loading.value = false
  }
}

function switchRange(nextKey) {
  rangeKey.value = nextKey
  closeSwipe()
  loadData()
}

function handleCustomStart(event) {
  customStart.value = event.detail.value
  loadData()
}

function handleCustomEnd(event) {
  customEnd.value = event.detail.value
  loadData()
}

function formatDateWithWeekday(date) {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${date} ${weekdays[dayjs(date).day()]}`
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
  if (loading.value || loadingMore.value || !hasMoreRecords.value) return

  loadingMore.value = true
  const requestId = requestSequence
  const range = resolveDateRange(rangeKey.value, customStart.value, customEnd.value)
  const pagingRange = getPagingDateRange(range)
  try {
    const batch = await fetchNextRecordsBatch({
      familyId: sessionState.profile.family_id,
      range: pagingRange,
      endDate: nextEndDate.value,
      dailyCheckins: fullStats.value.daily_checkins,
    })

    if (requestId !== requestSequence) return

    loadedRecords.value = [...loadedRecords.value, ...batch.records]
    nextEndDate.value = batch.nextEndDate
    hasMoreRecords.value = batch.hasMore
    fillComparison(buildComparisonData(loadedMembers.value, loadedRecords.value, fullStats.value))
  } catch (error) {
    if (requestId === requestSequence) showError(error, '加载更多记录失败')
  } finally {
    if (requestId === requestSequence) loadingMore.value = false
  }
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

.summary-card,
.matrix-card,
.timeline-card,
.member-card {
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(255, 251, 246, 0.92);
  box-shadow: 0 14rpx 36rpx rgba(88, 57, 38, 0.08);
}

.summary-card {
  display: flex;
  flex-direction: column;
  // gap: 15rpx;
  position: relative;
}

.filter-card {
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.filter-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-bottom: 15rpx;
  margin-top: -6rpx;
}


@media screen and (min-width: 900px) {
  .filter-controls{
    position: absolute;
    right: 30rpx;
    top: 20rpx;
    margin-bottom: 0;
    margin-top: 0;
  }
}

.range-tabs,
.custom-range,
.member-grid,
.member-tags {
  display: flex;
  gap: 14rpx;
  flex-wrap: wrap;
}

.range-tabs,
.custom-range {
  flex-wrap: nowrap;
}

.range-tab,
.date-box,
.member-tag {
  padding: 7rpx 15rpx;
  border-radius: 999rpx;
  background: #f5eadb;
  color: #705d50;
  font-size: 24rpx;
}

.range-tab,
.date-box {
  cursor: pointer;
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
  gap: 8rpx;
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
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

.timeline-member-group {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 16rpx 20rpx 10rpx;
  border-radius: 22rpx;
  background: #f8f1e8;
}

.timeline-member-name {
  font-size: 26rpx;
  font-weight: 700;
  color: #2b221c;
}

.timeline-date {
  font-size: 28rpx;
  font-weight: 700;
  color: #7f5a42;
}

.timeline-list {
  display: flex;
  flex-direction: column;
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
}

.timeline-swipe + .timeline-swipe {
  border-top: 1rpx solid rgba(132, 101, 82, 0.16);
}

.timeline-actions {
  position: absolute;
  inset: 0 0 0 auto;
  width: 138rpx;
  display: flex;
  flex-direction: row;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease, visibility 180ms ease;
}

.timeline-swipe--open .timeline-actions {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
}

.timeline-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff8f3;
  font-size: 24rpx;
  font-weight: 700;
  cursor: pointer;
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
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  padding: 12rpx 0;
  background: #f8f1e8;
  transition: transform 180ms ease;
  cursor: pointer;
}

.timeline-swipe--open .timeline-item {
  transform: translateX(-138rpx);
}

.timeline-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.timeline-meta {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: none;
  gap: 12rpx;
}

.timeline-task {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 24rpx;
  color: #6f6054;
}

.timeline-category {
  max-width: 150rpx;
  overflow: hidden;
  padding: 3rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(201, 106, 61, 0.1);
  color: #7a6556;
  font-size: 22rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-time {
  flex: none;
  color: #6f6054;
  font-size: 22rpx;
  white-space: nowrap;
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
  cursor: pointer;
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
  cursor: auto;
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
  cursor: pointer;
}

</style>
