<template>
  <view class="pet-page">
    <view v-if="loading" class="panel-card loading-card"><text>正在整理宠物助手…</text></view>
    <template v-else>
      <view class="pet-switcher panel-card">
        <view class="section-kicker">OUR COMPANIONS</view>
        <view class="pet-switcher-row">
          <scroll-view v-if="pets.length" class="pet-scroll" scroll-x>
            <view class="pet-pills">
              <view
                v-for="pet in pets"
                :key="pet.id"
                class="pet-pill"
                :class="{ 'pet-pill--active': pet.id === activePetId }"
                @tap="selectPet(pet.id)"
              >
                <text class="pet-avatar">{{ pet.name.slice(0, 1) }}</text>
                <text>{{ pet.name }}</text>
              </view>
            </view>
          </scroll-view>
          <view v-else class="pet-intro"><text class="pet-intro-title">先认识一位小伙伴</text><text class="pet-intro-copy">添加宠物后，就可以开始记录成长曲线。</text></view>
          <view class="manage-button" @tap="openManage"><text>管理</text><text class="manage-plus">＋</text></view>
        </view>
      </view>

      <template v-if="activePet">
        <!-- <view class="metric-summary">
          <view class="summary-card summary-card--weight">
            <text class="summary-label">最近体重</text>
            <view class="summary-value-row"><text class="summary-value">{{ latestWeight ? Number(latestWeight.value).toFixed(2) : '—' }}</text><text class="summary-unit">kg</text></view>
            <text class="summary-caption">{{ latestWeight ? formatDate(latestWeight.recorded_at) : '记录一次体重' }}</text>
          </view>
          <view class="summary-card summary-card--care">
            <text class="summary-label">今天的日常</text>
            <view class="daily-counts"><text>尿 <b>{{ todayCounts.urine }}</b></text><i></i><text>便 <b>{{ todayCounts.stool }}</b></text></view>
            <text class="summary-caption">每一条都值得被记下</text>
          </view>
        </view> -->
        <!-- <view class="flex-s-c pet-switcher panel-card">
          <view class="action-title">最近一次</view>
          <view class="single-day-values flex-1">
            <view class="single-day-value"><text class="single-day-dot single-day-dot--weight"></text><text>体重</text><b>{{ recordedChartDays[Math.max(recordedChartDays.length - 1, 0)].weight === null ? '—' : `${Number(recordedChartDays[Math.max(recordedChartDays.length - 1, 0)].weight).toFixed(2)} kg` }}</b></view>
            <view class="single-day-value"><text class="single-day-dot single-day-dot--urine"></text><text>尿</text><b>{{ recordedChartDays[Math.max(recordedChartDays.length - 1, 0)]?.urine || '0' }} 次</b></view>
            <view class="single-day-value"><text class="single-day-dot single-day-dot--stool"></text><text>便</text><b>{{ recordedChartDays[Math.max(recordedChartDays.length - 1, 0)]?.stool || '0' }} 次</b></view>
          </view>
        </view> -->

        <view class="quick-actions">
          <view class="quick-action quick-action--weight" @tap="openWeightModal"><text class="action-symbol">＋</text><view><text class="action-title">记录体重</text><text class="action-note">新增一次测量</text></view></view>
          <view class="quick-action quick-action--urine" @tap="openRecordModal('urine')"><text class="action-symbol">＋</text><view class="action-copy"><view class="action-title-row"><text class="action-title">尿尿打卡</text><text v-if="!todayHasRecords.urine" class="no-record-hint">[今日未记录]</text></view><text class="action-note">记录每日尿团</text></view></view>
          <view class="quick-action quick-action--stool" @tap="openRecordModal('stool')"><text class="action-symbol">＋</text><view class="action-copy"><view class="action-title-row"><text class="action-title">便便打卡</text><text v-if="!todayHasRecords.stool" class="no-record-hint">[今日未记录]</text></view><text class="action-note">记录每日便便</text></view></view>
        </view>

        <view class="panel-card chart-card">
          <view class="section-heading">
            <view><view class="section-kicker">GROWTH & DAILY CARE</view><text class="section-title">健康趋势</text></view>
            <view class="range-switch"><text v-for="range in ranges" :key="range.key" :class="{ 'range-active': activeRange === range.key }" @tap="setRange(range.key)">{{ range.label }}</text></view>
          </view>
          <view v-if="chartDays.length" class="chart-wrap">
            <qiun-data-charts
              type="line"
              :chart-data="chartData"
              :opts="chartOptions"
              :reshow="chartReshow"
              canvas-id="pet-health-chart"
              @getIndex="handleChartSelect"
            />
          </view>
          <view v-else class="chart-empty"><text class="empty-orbit">✧</text><text>写下第一条记录，趋势会在这里慢慢出现。</text></view>
          <view class="chart-legend">
            <view class="chart-legend-item" :class="{ 'chart-legend-item--muted': !visibleMetrics.urine }" @tap="toggleMetric('urine')"><i class="legend-dot legend-dot--urine"></i><text>尿/次</text></view>
            <view class="chart-legend-item" :class="{ 'chart-legend-item--muted': !visibleMetrics.stool }" @tap="toggleMetric('stool')"><i class="legend-dot legend-dot--stool"></i><text>便/次</text></view>
            <view class="chart-legend-item" :class="{ 'chart-legend-item--muted': !visibleMetrics.weight }" @tap="toggleMetric('weight')"><i class="legend-dot legend-dot--weight"></i><text>体重/kg</text></view>
          </view>
        </view>

        <view class="panel-card detail-card">
          <view class="section-heading detail-heading">
            <view><view class="section-kicker">DAILY NOTES</view><text class="section-title">{{ selectedDate ? selectedDate === today ? '今日记录' : selectedDate : '最近记录' }}</text></view>
            <view class="detail-date-actions">
              <text v-if="selectedDate" class="detail-date detail-date-recent" @tap="showRecentRecords">最近</text>
              <picker mode="date" :value="selectedDate || today" :end="today" @change="handleSelectedDateChange">
                <view class="detail-date detail-date-picker"><text>{{ selectedDate ? selectedDate === today ? 'TODAY' : formatDayLabel(selectedDate) : '最近' }}</text><text class="detail-date-chevron"></text></view>
              </picker>
            </view>
          </view>
          <view v-if="selectedDate && displayedRecords.length" class="record-list">
            <view v-for="record in displayedRecords" :key="record.id" class="record-row">
              <view class="record-marker" :class="`record-marker--${record.metric_type}`">{{ metricIcon(record.metric_type) }}</view>
              <view class="record-copy"><text class="record-title">{{ metricLabel(record.metric_type) }}</text><text class="record-time">{{ formatTime(record.recorded_at) }}</text></view>
              <text class="record-value">{{ record.metric_type === 'weight' ? `${Number(record.value).toFixed(2)} kg` : recordCount(record) === 0 ? '0' : `＋${recordCount(record)}` }}</text>
              <text class="record-delete" @tap="handleDeleteRecord(record)">×</text>
            </view>
          </view>
          <view v-else-if="!selectedDate && recentRecordGroups.length" class="record-groups">
            <view v-for="group in recentRecordGroups" :key="group.date" class="record-day-group">
              <view class="record-day-heading">
                <view>
                  <text class="record-day-label">{{ formatGroupDate(group.date) }}</text>
                  <text v-if="group.urineCount > 0" class="record-day-metric record-day-metric--urine">【尿尿 · {{ group.urineCount }}次】</text>
                  <text v-if="group.stoolCount > 0" class="record-day-metric record-day-metric--stool">【便便 · {{ group.stoolCount }}次】</text>
                </view>
                <view class="record-day-summary">
                  <text class="record-day-count">{{ group.records.length }} 条记录</text>
                </view>
              </view>
              <view class="record-list">
                <view v-for="record in group.records" :key="record.id" class="record-row">
                  <view class="record-marker" :class="`record-marker--${record.metric_type}`">{{ metricIcon(record.metric_type) }}</view>
                  <view class="record-copy"><text class="record-title">{{ metricLabel(record.metric_type) }}</text><text class="record-time">{{ formatTime(record.recorded_at) }}</text></view>
                  <text class="record-value">{{ record.metric_type === 'weight' ? `${Number(record.value).toFixed(2)} kg` : recordCount(record) === 0 ? '0' : `＋${recordCount(record)}` }}</text>
                  <text class="record-delete" @tap="handleDeleteRecord(record)">×</text>
                </view>
              </view>
            </view>
          </view>
          <view v-else class="day-empty">{{ selectedDate ? '这一天还没有记录，今天也可以从一次轻点开始。' : '最近15天还没有记录。' }}</view>
        </view>
      </template>
      <view v-else class="panel-card first-pet-card"><text class="first-pet-symbol">♡</text><text class="first-pet-title">把日常，慢慢写成回忆</text><text class="first-pet-copy">创建宠物档案，记录体重与每天的小变化。</text><button class="primary-button" @tap="openManage">添加第一只宠物</button></view>
    </template>

    <view v-if="showManage" class="modal-mask" @tap="closeManage">
      <view class="modal-card manage-modal" @tap.stop>
        <view class="modal-head"><view><text class="modal-kicker">FAMILY PETS</text><text class="modal-title">管理小伙伴</text></view><text class="modal-close" @tap="closeManage">×</text></view>
        <view v-if="pets.length" class="managed-pet-list">
          <view v-for="pet in pets" :key="pet.id" class="managed-pet">
            <text class="pet-avatar">{{ pet.name.slice(0, 1) }}</text><text class="managed-pet-name">{{ pet.name }}</text><text class="archive-link" @tap="handleArchivePet(pet)">归档</text>
          </view>
        </view>
        <text class="field-label">添加新的宠物</text>
        <input v-model.trim="newPetName" class="text-field" maxlength="32" placeholder="例如：雪球" confirm-type="done" @confirm="handleCreatePet" />
        <button class="primary-button" :disabled="creatingPet" @tap="handleCreatePet">{{ creatingPet ? '正在保存…' : '添加到家庭' }}</button>
      </view>
    </view>

    <view v-if="showRecordModal" class="modal-mask" @tap="closeRecordModal">
      <view class="modal-card weight-modal" @tap.stop>
        <view class="modal-head"><view><text class="modal-kicker">{{ recordMetricType === 'weight' ? 'A LITTLE GROWTH' : 'A LITTLE DAILY NOTE' }}</text><text class="modal-title">{{ recordModalTitle }}</text></view><text class="modal-close" @tap="closeRecordModal">×</text></view>
        <view class="weight-input-row"><input v-if="recordMetricType === 'weight'" v-model="weightValue" class="weight-input" type="digit" placeholder="0.0" /><input v-else v-model="careCount" class="weight-input" type="number" maxlength="3" placeholder="1" /><text>{{ recordMetricType === 'weight' ? 'kg' : '次' }}</text></view>
        <text class="field-label">记录日期</text>
        <picker mode="date" :value="recordDate" :end="today" @change="handleRecordDateChange">
          <view class="date-time-field"><text>{{ recordDate }}</text><text class="date-time-chevron">选择日期 ›</text></view>
        </picker>
        <text class="field-label">记录时间</text>
        <picker mode="time" :value="recordTime" @change="handleRecordTimeChange">
          <view class="date-time-field"><text>{{ recordTime }}</text><text class="date-time-chevron">选择时间 ›</text></view>
        </picker>
        <text class="weight-hint">默认使用当前日期和时间，可补录历史记录。</text>
        <button class="primary-button" :disabled="savingRecord" @tap="handleSaveRecord">{{ savingRecord ? '正在保存…' : recordMetricType === 'weight' ? '保存这次测量' : '保存这次记录' }}</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import dayjs from 'dayjs'
import { useSession } from '@/composables/useSession'
import {
  archivePet,
  createPet,
  createPetHealthRecord,
  deletePetHealthRecord,
  fetchPetHealthRecords,
  fetchPets,
} from '@/services/petCare'
import { showError, showSuccess } from '@/utils/feedback'

const { state: sessionState } = useSession()
const pets = ref([])
const records = ref([])
const activePetId = ref('')
const activeRange = ref('30d')
const selectedDate = ref('')
const chartReshow = ref(false)
const visibleMetrics = ref({ weight: true, urine: true, stool: true })
const loading = ref(false)
const creatingPet = ref(false)
const savingRecord = ref(false)
const showManage = ref(false)
const showRecordModal = ref(false)
const newPetName = ref('')
const weightValue = ref('')
const careCount = ref('1')
const recordMetricType = ref('weight')
const recordDate = ref('')
const recordTime = ref('')
const today = dayjs().format('YYYY-MM-DD')
const ranges = [
  { key: '7d', label: '7天' },
  { key: '30d', label: '30天' },
  { key: 'all', label: '全部' },
]

const activePet = computed(() => pets.value.find((pet) => pet.id === activePetId.value) || null)
const recordModalTitle = computed(() => ({ weight: '记录体重', urine: '尿尿打卡', stool: '便便打卡' })[recordMetricType.value] || '记录健康数据')
const latestWeight = computed(() => records.value.filter((record) => record.metric_type === 'weight').slice(-1)[0] || null)
const selectedRecords = computed(() => records.value
  .filter((record) => dayjs(record.recorded_at).format('YYYY-MM-DD') === selectedDate.value)
  .sort((left, right) => dayjs(right.recorded_at).valueOf() - dayjs(left.recorded_at).valueOf()))
const recentRecords = computed(() => {
  const start = dayjs().subtract(14, 'day').startOf('day')
  return records.value
    .filter((record) => dayjs(record.recorded_at).isAfter(start.subtract(1, 'millisecond')) && dayjs(record.recorded_at).isBefore(dayjs().add(1, 'day').startOf('day')))
    .sort((left, right) => dayjs(right.recorded_at).valueOf() - dayjs(left.recorded_at).valueOf())
})
const displayedRecords = computed(() => selectedDate.value ? selectedRecords.value : recentRecords.value)
const recentRecordGroups = computed(() => {
  const groups = new Map()
  for (const record of recentRecords.value) {
    const date = dayjs(record.recorded_at).format('YYYY-MM-DD')
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date).push(record)
  }
  return [...groups].map(([date, dayRecords]) => ({
    date,
    records: dayRecords,
    urineCount: dayRecords.filter((record) => record.metric_type === 'urine').reduce((sum, record) => sum + recordCount(record), 0),
    stoolCount: dayRecords.filter((record) => record.metric_type === 'stool').reduce((sum, record) => sum + recordCount(record), 0),
  }))
})
const todayHasRecords = computed(() => ({
  urine: records.value.some((record) => record.metric_type === 'urine' && dayjs(record.recorded_at).format('YYYY-MM-DD') === today),
  stool: records.value.some((record) => record.metric_type === 'stool' && dayjs(record.recorded_at).format('YYYY-MM-DD') === today),
}))

function getWeightAxisRange() {
  const weights = chartDays.value
    .map((day) => day.weight)
    .filter((weight) => Number.isFinite(weight))
  if (!weights.length) return { min: 0, max: 4, tofix: 0 }

  const dataMin = Math.min(...weights)
  const dataMax = Math.max(...weights)
  const span = dataMax - dataMin
  const padding = Math.max(0.1, span * 0.15)
  const targetStep = (span + padding * 2) / 4
  let step = getNiceWeightAxisStep(targetStep)
  // Keep a few weight-axis intervals around the data so a narrow weight
  // trend does not stretch across the same vertical span as care counts.
  const axisPadding = Math.max(padding, step * 2)
  let min = Math.floor((dataMin - axisPadding) / step) * step
  let max = min + step * 4

  while (max < dataMax + padding - Number.EPSILON) {
    step = getNiceWeightAxisStep(step * 1.01)
    min = Math.floor((dataMin - Math.max(padding, step * 2)) / step) * step
    max = min + step * 4
  }

  const decimals = Math.max(0, Math.ceil(-Math.log10(step)))
  return {
    min: Number(min.toFixed(decimals + 2)),
    max: Number(max.toFixed(decimals + 2)),
    tofix: decimals,
  }
}

function getNiceWeightAxisStep(value) {
  if (!Number.isFinite(value) || value <= 0) return 0.5
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const multipliers = [1, 1.5, 2, 2.5, 5, 10]
  const multiplier = multipliers.find((candidate) => candidate >= normalized) || 10
  return Math.max(0.5, multiplier * magnitude)
}

function recordCount(record) {
  const value = Number(record.value)
  return Number.isInteger(value) && value >= 0 ? value : 1
}

function buildChartDays() {
  if (!records.value.length) return []
  const end = dayjs().startOf('day')
  let start = end
  if (activeRange.value === '7d') start = end.subtract(6, 'day')
  else if (activeRange.value === '30d') start = end.subtract(29, 'day')
  else {
    const oldest = records.value[0]?.recorded_at
    if (oldest) start = dayjs(oldest).startOf('day')
  }

  const byDate = new Map()
  for (const record of records.value) {
    const date = dayjs(record.recorded_at).format('YYYY-MM-DD')
    if (date < start.format('YYYY-MM-DD') || date > end.format('YYYY-MM-DD')) continue
    const day = byDate.get(date) || { date, weight: null, urine: null, stool: null }
    if (record.metric_type === 'weight') day.weight = Number(record.value)
    if (record.metric_type === 'urine') day.urine = (day.urine ?? 0) + recordCount(record)
    if (record.metric_type === 'stool') day.stool = (day.stool ?? 0) + recordCount(record)
    byDate.set(date, day)
  }

  // Keep only days with at least one saved record so empty calendar dates do
  // not compress the useful trend points into the end of the chart.
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

async function refreshChart() {
  await nextTick()
  chartReshow.value = false
  await nextTick()
  chartReshow.value = true
}

const chartDays = computed(buildChartDays)
const weightAxisRange = computed(getWeightAxisRange)
const recordedChartDays = computed(() => chartDays.value.filter((day) => day.weight !== null || day.urine !== null || day.stool !== null))
const chartData = computed(() => ({
  categories: chartDays.value.map((day) => dayjs(day.date).format('MM/DD')),
  series: [
    { name: '体重', data: chartDays.value.map((day) => day.weight), color: '#D4935E', index: 0, show: visibleMetrics.value.weight, connectNulls: true },
    { name: '尿', data: chartDays.value.map((day) => day.urine), color: '#6BAE9B', index: 1, show: visibleMetrics.value.urine, connectNulls: true },
    { name: '便', data: chartDays.value.map((day) => day.stool), color: '#8295C6', index: 1, show: visibleMetrics.value.stool, connectNulls: true },
  ],
}))
const chartOptions = computed(() => ({
  color: ['#D4935E', '#6BAE9B', '#8295C6'],
  background: '#FFFEFC',
  animation: false,
  dataLabel: chartDays.value.length === 1,
  dataPointShape: true,
  padding: [14, 18, 6, 10],
  legend: { show: false },
  xAxis: { fontColor: '#9A8D81', fontSize: 10, axisLineColor: '#EFE7DF', gridColor: '#F5F0EA', labelCount: 6 },
  yAxis: {
    showTitle: true,
    splitNumber: 4,
    gridColor: '#F1ECE6',
    gridType: 'dash',
    data: [
      { position: 'right', title: 'kg', min: weightAxisRange.value.min, max: weightAxisRange.value.max, tofix: weightAxisRange.value.tofix, fontColor: '#A28168' },
      { position: 'left', title: '次', min: 0, tofix: 0, fontColor: '#78988D' },
    ],
  },
  extra: { line: { type: 'curve', width: 3 } },
  tooltip: { group: [], index: -1, showBox: true, showCategory: true, showValue: true, fontColor: '#55483D', bgColor: '#FFFDF9', bgOpacity: 1 },
}))

async function activate() {
  if (!sessionState.profile?.family_id) return
  loading.value = true
  try {
    pets.value = await fetchPets({ familyId: sessionState.profile.family_id })
    if (!pets.value.some((pet) => pet.id === activePetId.value)) activePetId.value = pets.value[0]?.id || ''
    if (activePetId.value) await loadRecords()
  } catch (error) {
    showError(error, '加载宠物记录失败')
  } finally {
    loading.value = false
    await nextTick()
    if (activePetId.value) await refreshChart()
  }
}

async function loadRecords() {
  if (!activePetId.value || !sessionState.profile?.family_id) {
    records.value = []
    return
  }
  records.value = await fetchPetHealthRecords({ familyId: sessionState.profile.family_id, petId: activePetId.value })
  const days = chartDays.value
}

async function selectPet(petId) {
  if (petId === activePetId.value) return
  activePetId.value = petId
  selectedDate.value = ''
  visibleMetrics.value = { weight: true, urine: true, stool: true }
  loading.value = true
  try { await loadRecords() } catch (error) { showError(error, '加载宠物记录失败') } finally {
    loading.value = false
    await nextTick()
    await refreshChart()
  }
}

async function setRange(range) {
  activeRange.value = range
  if (selectedDate.value && !chartDays.value.some((day) => day.date === selectedDate.value) && chartDays.value.length) {
    selectedDate.value = chartDays.value[chartDays.value.length - 1].date
  }
}

function toggleMetric(metricType) {
  visibleMetrics.value[metricType] = !visibleMetrics.value[metricType]
}

function handleChartSelect(event) {
  const index = Number(event?.currentIndex ?? event?.detail?.currentIndex)
  if (Number.isInteger(index) && chartDays.value[index]) selectedDate.value = chartDays.value[index].date
}

function openManage() { newPetName.value = ''; showManage.value = true }
function closeManage() { showManage.value = false }
function openWeightModal() { openRecordModal('weight') }
function openRecordModal(metricType) {
  const now = dayjs()
  recordMetricType.value = metricType
  recordDate.value = now.format('YYYY-MM-DD')
  recordTime.value = now.format('HH:mm')
  weightValue.value = ''
  careCount.value = '1'
  showRecordModal.value = true
}
function closeRecordModal() { showRecordModal.value = false }
function handleRecordDateChange(event) { recordDate.value = event.detail.value }
function handleRecordTimeChange(event) { recordTime.value = event.detail.value }
function handleSelectedDateChange(event) { selectedDate.value = event.detail.value }
function showRecentRecords() { selectedDate.value = '' }

function selectedRecordTimestamp() {
  const [year, month, date] = recordDate.value.split('-').map(Number)
  const [hour, minute] = recordTime.value.split(':').map(Number)
  const localDate = new Date(year, month - 1, date, hour, minute, 0, 0)
  if (Number.isNaN(localDate.getTime())) return null
  return localDate.toISOString()
}

async function handleCreatePet() {
  const name = newPetName.value.trim()
  if (!name) return showError('请输入宠物名字')
  creatingPet.value = true
  try {
    const pet = await createPet({ familyId: sessionState.profile.family_id, createdBy: sessionState.profile.id, name })
    pets.value.push(pet)
    activePetId.value = pet.id
    records.value = []
    closeManage()
    showSuccess('宠物档案已创建')
  } catch (error) { showError(error, '添加宠物失败') } finally { creatingPet.value = false }
}

function confirmAction(title, content, confirmText = '确认') {
  return new Promise((resolve) => uni.showModal({
    title,
    content,
    confirmText,
    confirmColor: '#C96A3D',
    cancelText: '取消',
    success: (result) => resolve(Boolean(result.confirm)),
    fail: () => resolve(false),
  }))
}

async function handleArchivePet(pet) {
  const confirmed = await confirmAction('归档宠物', `归档「${pet.name}」后会保留全部健康记录。`)
  if (!confirmed) return
  try {
    await archivePet({ petId: pet.id, familyId: sessionState.profile.family_id })
    pets.value = pets.value.filter((item) => item.id !== pet.id)
    if (activePetId.value === pet.id) {
      activePetId.value = pets.value[0]?.id || ''
      records.value = []
      if (activePetId.value) await loadRecords()
    }
    showSuccess('宠物已归档')
    if (!pets.value.length) closeManage()
  } catch (error) { showError(error, '归档宠物失败') }
}

async function handleSaveRecord() {
  if (!activePet.value || savingRecord.value) return
  const metricType = recordMetricType.value
  const careCountText = String(careCount.value).trim()
  if (metricType !== 'weight' && !careCountText) return showError('请输入 0 至 99 之间的整数次数')
  const value = metricType === 'weight' ? Number(weightValue.value) : Number(careCount.value)
  if (metricType === 'weight' && (!Number.isFinite(value) || value <= 0 || value > 999999.99)) return showError('请输入有效的体重数值（kg）')
  if (metricType !== 'weight' && (!Number.isInteger(value) || value < 0 || value > 99)) return showError('请输入 0 至 99 之间的整数次数')
  const recordedAt = selectedRecordTimestamp()
  if (!recordedAt) return showError('请选择有效的记录日期和时间')
  savingRecord.value = true
  try {
    await createPetHealthRecord({ familyId: sessionState.profile.family_id, petId: activePetId.value, createdBy: sessionState.profile.id, metricType, value, recordedAt })
    closeRecordModal()
    await loadRecords()
    if (!chartDays.value.some((day) => day.date === recordDate.value)) activeRange.value = 'all'
    selectedDate.value = recordDate.value
    showSuccess(metricType === 'weight' ? '体重已保存' : `${metricType === 'urine' ? '尿尿' : '便便'}已记录 ${value} 次`)
  } catch (error) { showError(error, '保存记录失败') } finally { savingRecord.value = false }
}

async function handleDeleteRecord(record) {
  const confirmed = await confirmAction('删除记录', `确定删除这条${metricLabel(record.metric_type)}吗？`, '删除')
  if (!confirmed) return
  try {
    await deletePetHealthRecord({ recordId: record.id, familyId: sessionState.profile.family_id })
    records.value = records.value.filter((item) => item.id !== record.id)
    showSuccess('记录已删除')
  } catch (error) { showError(error, '删除记录失败') }
}

function metricLabel(type) { return ({ weight: '体重测量', urine: '尿尿记录', stool: '便便记录' })[type] || '健康记录' }
function metricIcon(type) { return ({ weight: '↗', urine: '⌁', stool: '✦' })[type] || '·' }
function formatDate(value) { return dayjs(value).format('MM月DD日') }
function formatTime(value) { return dayjs(value).format('HH:mm') }
function formatGroupDate(value) {
  const date = dayjs(value)
  if (value === today) return `今天 · ${date.format('MM月DD日')}`
  if (value === dayjs().subtract(1, 'day').format('YYYY-MM-DD')) return `昨天 · ${date.format('MM月DD日')}`
  return date.format('MM月DD日 · dddd')
}
function formatDayLabel(value) { return dayjs(value).format('MM月DD日') }

activate()
</script>

<style lang="scss" scoped>
.pet-page { display: flex; flex-direction: column; gap: 22rpx; padding-bottom: 40rpx; color: #3f352e; }
.panel-card { border: 1rpx solid rgba(160, 132, 107, .12); border-radius: 28rpx; background: rgba(255, 254, 251, .94); box-shadow: 0 12rpx 34rpx rgba(91, 66, 45, .055); }
.loading-card { padding: 52rpx; color: #8e7b6b; text-align: center; }
.pet-switcher { padding: 28rpx 30rpx; }
.section-kicker, .modal-kicker { color: #9e8b79; font-size: 17rpx; font-weight: 700; letter-spacing: .18em; }
.pet-switcher-row { display: flex; align-items: center; gap: 16rpx; margin-top: 20rpx; }
.pet-scroll { min-width: 0; flex: 1; white-space: nowrap; }
.pet-pills { display: inline-flex; gap: 12rpx; }
.pet-pill { display: inline-flex; align-items: center; gap: 10rpx; padding: 10rpx 20rpx 10rpx 10rpx; border: 1rpx solid #ece5dd; border-radius: 999rpx; color: #78695c; font-size: 23rpx; cursor: pointer; }
.pet-pill--active { border-color: #d6b79a; background: #f8efe6; color: #704e35; box-shadow: inset 0 0 0 1rpx rgba(201,106,61,.08); }
.pet-avatar { display: inline-flex; width: 46rpx; height: 46rpx; align-items: center; justify-content: center; border-radius: 50%; background: #e8f0e8; color: #65836d; font-size: 23rpx; font-weight: 700; }
.manage-button { display: inline-flex; align-items: center; gap: 8rpx; padding: 14rpx 18rpx; border-radius: 999rpx; background: #f5f1eb; color: #827262; font-size: 22rpx; white-space: nowrap; cursor: pointer; }
.manage-plus { color: #bd8054; font-size: 28rpx; }
.pet-intro { display: flex; flex: 1; flex-direction: column; gap: 6rpx; }
.pet-intro-title { color: #59483a; font-size: 26rpx; font-weight: 650; }
.pet-intro-copy { color: #a09081; font-size: 20rpx; }
.metric-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 18rpx; }
.summary-card { min-width: 0; padding: 25rpx 26rpx; border-radius: 26rpx; }
.summary-card--weight { background: linear-gradient(145deg, #f5e7d9, #fbf2e9); }
.summary-card--care { background: linear-gradient(145deg, #e6f0e9, #f0f5ef); }
.summary-label { color: #8b7764; font-size: 21rpx; }
.summary-value-row { display: flex; align-items: baseline; gap: 8rpx; margin-top: 12rpx; }
.summary-value { color: #614b37; font-size: 48rpx; font-weight: 700; letter-spacing: -.04em; }
.summary-unit { color: #92785f; font-size: 20rpx; }
.summary-caption { display: block; margin-top: 7rpx; color: #9d8d7e; font-size: 18rpx; }
.daily-counts { display: flex; align-items: baseline; gap: 16rpx; margin-top: 18rpx; color: #688271; font-size: 23rpx; }
.daily-counts b { margin-left: 5rpx; color: #456854; font-size: 34rpx; }
.daily-counts i { width: 1rpx; height: 26rpx; background: #c8d7cc; }
.quick-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx; }
.quick-action { display: flex; min-height: 126rpx; align-items: center; gap: 12rpx; padding: 17rpx 14rpx; border: 1rpx solid rgba(156,134,114,.1); border-radius: 22rpx; background: #fffdf9; box-shadow: 0 8rpx 22rpx rgba(91,66,45,.045); cursor: pointer; }
.quick-action--weight .action-symbol { background: #f5e8db; color: #bd8054; }
.quick-action--urine .action-symbol { background: #e6f1eb; color: #6ba18b; }
.quick-action--stool .action-symbol { background: #e9ebf5; color: #7e8fbe; }
.action-symbol { display: flex; flex: none; width: 48rpx; height: 48rpx; align-items: center; justify-content: center; border-radius: 16rpx; font-size: 29rpx; }
.action-title, .action-note { display: block;padding-right: 10rpx; }
.action-title { color: #53473d; font-size: 24rpx; font-weight: 650; }
.action-copy { min-width: 0; flex: 1; }
.action-title-row { display: flex; align-items: center; gap: 2rpx; min-width: 0; flex-wrap: wrap; }
// .quick-action--urine .action-title, .quick-action--stool .action-title { overflow: hidden; text-overflow: ellipsis; }
.no-record-hint { flex: none; color: #d84b3f; font-size: 18rpx; }
.action-note { margin-top: 7rpx; color: #a39486; font-size: 18rpx; }
.chart-card, .detail-card { padding: 28rpx 26rpx; }
.section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 14rpx; }
.section-title { display: block; margin-top: 8rpx; color: #44382e; font-size: 34rpx; font-weight: 700; }
.range-switch { display: flex; gap: 5rpx; padding: 5rpx; border-radius: 999rpx; background: #f4f1ec; }
.range-switch text { padding: 9rpx 14rpx; border-radius: 999rpx; color: #988a7c; font-size: 18rpx; cursor: pointer; }
.range-switch .range-active { background: #fffdf9; color: #76583f; box-shadow: 0 3rpx 9rpx rgba(90,70,50,.08); }
.chart-wrap { height: 420rpx; margin: 20rpx -8rpx 0; }
.chart-empty { display: flex; height: 300rpx; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; color: #9c8d7e; font-size: 22rpx; text-align: center; }
.empty-orbit { color: #cfa47e; font-size: 54rpx; }
.single-day-values { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx;  padding: 15rpx 10rpx; border-radius: 18rpx; }
.single-day-value { display: flex; align-items: center; justify-content: center; gap: 7rpx; color: #938476; font-size: 18rpx; white-space: nowrap; }
.single-day-value b { color: #665548; font-size: 19rpx; font-weight: 650; }
.single-day-dot { width: 12rpx; height: 12rpx; flex: none; border-radius: 50%; }
.single-day-dot--weight { background: #D4935E; }.single-day-dot--urine { background: #6BAE9B; }.single-day-dot--stool { background: #8295C6; }
.chart-legend { display: flex; justify-content: center; gap: 28rpx; color: #8e8174; font-size: 19rpx; }
.chart-legend-item { display: inline-flex; align-items: center; gap: 8rpx; padding: 8rpx 4rpx; transition: opacity .18s ease; cursor: pointer; }
.chart-legend-item--muted { opacity: .38; }
.legend-dot { display: inline-block; width: 12rpx; height: 12rpx; border-radius: 50%; }
.legend-dot--weight { background: #D4935E; }.legend-dot--urine { background: #6BAE9B; }.legend-dot--stool { background: #8295C6; }
.detail-heading { align-items: center; margin-bottom: 18rpx; }
.detail-date-actions { display: flex; align-items: center; gap: 10rpx; }
.detail-date { color: #b4a28e; font-size: 18rpx; letter-spacing: .13em; }
.detail-date-recent { padding: 10rpx 4rpx; color: #8c7762; letter-spacing: 0; cursor: pointer; }
.detail-date-picker { display: flex; align-items: center; gap: 10rpx; padding: 10rpx 14rpx; border: 1rpx solid #efe6dc; border-radius: 999rpx; background: #fcfaf6; cursor: pointer; }
.detail-date-chevron { display: block; width: 10rpx; height: 10rpx; flex: none; margin-right: 6rpx; border-right: 1.5rpx solid #b08a69; border-bottom: 1.5rpx solid #b08a69; transform: rotate(45deg); }
.record-groups { display: flex; flex-direction: column; gap: 18rpx; }
.record-day-group { padding: 0 16rpx; border: 1rpx solid #f0e9e1; border-radius: 20rpx; background: #fffdfa; }
.record-day-heading { display: flex; align-items: center; justify-content: space-between; padding: 17rpx 0 12rpx; }
.record-day-label { color: #705a46; font-size: 22rpx; font-weight: 650;padding-right: 4rpx; }
.record-day-summary { display: flex; align-items: center; gap: 14rpx; }
.record-day-metric { font-size: 20rpx; white-space: nowrap;font-weight: bold;padding-right: 4rpx; }
.record-day-metric--urine { color: #6ba18b; }.record-day-metric--stool { color: #8295c6; }
.record-day-count { color: #aa9988; font-size: 17rpx; }
.record-list { display: flex; flex-direction: column; }
.record-row { display: flex; align-items: center; gap: 15rpx; padding: 18rpx 0; border-top: 1rpx solid #f2ece5; }
.record-marker { display: flex; width: 48rpx; height: 48rpx; flex: none; align-items: center; justify-content: center; border-radius: 16rpx; font-size: 26rpx; }
.record-marker--weight { background: #f5e9de; color: #bd8054; }.record-marker--urine { background: #e8f2ec; color: #6ba18b; }.record-marker--stool { background: #ececf6; color: #8295c6; }
.record-copy { display: flex; flex: 1; flex-direction: column; gap: 5rpx; }
.record-title { color: #584b40; font-size: 22rpx; font-weight: 600; }.record-time { color: #a39486; font-size: 18rpx; }
.record-value { color: #776653; font-size: 21rpx; }.record-delete { padding: 8rpx 5rpx 8rpx 12rpx; color: #bc9e86; font-size: 31rpx; cursor: pointer; }
.day-empty { padding: 26rpx 0 8rpx; color: #a09285; font-size: 21rpx; text-align: center; }
.first-pet-card { display: flex; flex-direction: column; align-items: center; padding: 54rpx 35rpx; text-align: center; }
.first-pet-symbol { color: #c98f65; font-size: 70rpx; }.first-pet-title { margin-top: 15rpx; color: #554638; font-size: 31rpx; font-weight: 700; }.first-pet-copy { margin: 12rpx 0 28rpx; color: #978879; font-size: 21rpx; }
.primary-button { display: block; width: 100%; margin: 22rpx 0 0; padding: 0 22rpx; border: 0; border-radius: 18rpx; background: #9c7353; color: #fffaf5; font-size: 24rpx; line-height: 82rpx; }
.primary-button::after { border: 0; }
.primary-button[disabled] { opacity: .55; }
.modal-mask { position: fixed; z-index: 100; inset: 0; display: flex; align-items: flex-end; justify-content: center; padding: 30rpx; background: rgba(48, 39, 31, .34); backdrop-filter: blur(8px); cursor: pointer; }
.modal-card { width: 100%; max-width: 400px; padding: 34rpx; border-radius: 32rpx; background: #fffdf9; box-shadow: 0 20rpx 80rpx rgba(47,35,25,.2); cursor: auto; }
.modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26rpx; }.modal-head view { display: flex; flex-direction: column; gap: 7rpx; }.modal-title { color: #483a2f; font-size: 34rpx; font-weight: 700; }.modal-close { color: #aa9988; font-size: 42rpx; cursor: pointer; }
.managed-pet-list { max-height: 340rpx; overflow: auto; margin: 0 0 25rpx; }.managed-pet { display: flex; align-items: center; gap: 15rpx; padding: 16rpx 0; border-bottom: 1rpx solid #f1ebe4; }.managed-pet-name { flex: 1; color: #5b4a3b; font-size: 24rpx; }.archive-link { color: #b27c61; font-size: 21rpx; cursor: pointer; }
.field-label { display: block; margin-bottom: 10rpx; color: #8c7a69; font-size: 20rpx; }.text-field { box-sizing: border-box; width: 100%; height: 78rpx; padding: 0 20rpx; border: 1rpx solid #e9dfd4; border-radius: 16rpx; background: #fcfaf6; color: #514337; font-size: 24rpx; }
.weight-input-row { display: flex; align-items: baseline; gap: 14rpx; padding: 20rpx 0; margin-bottom: 20rpx; border-bottom: 1rpx solid #eadfd3; color: #92775f; font-size: 26rpx; }.weight-input { width: 100%; color: #4c3e32; font-size: 58rpx; }.weight-hint { display: block; margin-top: 14rpx; color: #a29485; font-size: 20rpx; }
.date-time-field { display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; width: 100%; height: 76rpx; margin: 0 0 21rpx; padding: 0 20rpx; border: 1rpx solid #e9dfd4; border-radius: 16rpx; background: #fcfaf6; color: #514337; font-size: 24rpx; cursor: pointer; }
.date-time-chevron { color: #a18b76; font-size: 20rpx; }
@media (max-width: 360px) { .action-note { display: none; }.quick-action { justify-content: center; }.action-title { font-size: 18rpx; } }
</style>
