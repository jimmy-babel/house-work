<template>
  <view class="events-page">
    <view class="events-intro">
      <view><text class="intro-kicker">A NOTE TO YOUR FUTURE SELF</text><text class="intro-copy">想临时记录什么，就写在留言板上。</text></view>
      <view class="create-fab" @tap="openCreate"><text>＋</text></view>
    </view>

    <view v-if="loading" class="events-loading"><text>正在翻开留言板…</text></view>
    <template v-else>
      <view class="status-tabs">
        <view class="status-tab" :class="{ 'status-tab--active': activeTab === 'pending' }" @tap="activeTab = 'pending'">待处理 <text>{{ pendingEvents.length }}</text></view>
        <view class="status-tab" :class="{ 'status-tab--active': activeTab === 'completed' }" @tap="activeTab = 'completed'">已完成 <text>{{ completedEvents.length }}</text></view>
      </view>
      <view v-if="displayedEvents.length" class="events-grid">
        <TemporaryEventCard
          v-for="(event, index) in displayedEvents"
          :key="event.id"
          :event="event"
          :content="displayContent(event)"
          :index="index"
          show-menu
          :updating="updatingEventIds.has(event.id)"
          @select="openEdit"
          @delete="handleDelete"
          @toggle-completed="toggleCompleted"
        />
      </view>
      <view v-else-if="!events.length" class="empty-notes">
        <view class="empty-stack"><text class="empty-note empty-note--one">✧</text><text class="empty-note empty-note--two">♡</text><text class="empty-note empty-note--three">＋</text></view>
        <text class="empty-title">给灵感留个位置</text>
        <text class="empty-copy">临时想起的事情、待办或小计划，都可以先记在这里。</text>
        <button class="empty-button" @tap="openCreate">写下第一条</button>
      </view>
      <view v-else class="empty-filtered"><text>{{ activeTab === 'pending' ? '暂时没有待处理事项' : '还没有已完成的事项' }}</text></view>
    </template>

    <view v-if="showEditor" class="modal-mask" @tap="closeEditor">
      <view class="editor-card" @tap.stop>
        <view class="editor-top"><view><text class="editor-kicker">{{ editingEvent ? 'KEEP IT CLOSE' : 'A FRESH NOTE' }}</text><text class="editor-title">{{ editingEvent ? '编辑这条记录' : '记下一件小事' }}</text></view><text class="editor-close" @tap="closeEditor">×</text></view>
        <textarea v-model="draftContent" class="content-input" maxlength="1000" placeholder="写下要记住的事情…" :auto-height="true" />
        <view class="editor-foot"><text class="char-count">{{ draftContent.length }}/1000</text><text class="time-note">{{ editingEvent ? `记录于 ${dateTimeLabel(editingEvent.created_at)}` : '保存时自动添加记录时间' }}</text></view>
        <button class="save-button" :disabled="saving" @tap="handleSave">{{ saving ? '正在保存…' : editingEvent ? '保存修改' : '保存这条记录' }}</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useSession } from '@/composables/useSession'
import TemporaryEventCard from '@/components/events/TemporaryEventCard.vue'
import {
  createTemporaryEvent,
  deleteTemporaryEvent,
  fetchTemporaryEvents,
  setTemporaryEventCompleted,
  updateTemporaryEvent,
} from '@/services/temporaryEvents'
import { showError, showSuccess } from '@/utils/feedback'

const { state: sessionState } = useSession()
const events = ref([])
const loading = ref(false)
const saving = ref(false)
const showEditor = ref(false)
const editingEvent = ref(null)
const draftContent = ref('')
const activeTab = ref('pending')
const updatingEventIds = ref(new Set())
const pendingEvents = computed(() => events.value.filter((event) => !event.is_completed))
const completedEvents = computed(() => events.value.filter((event) => event.is_completed))
const displayedEvents = computed(() => activeTab.value === 'completed' ? completedEvents.value : pendingEvents.value)

async function activate() {
  if (!sessionState.profile?.family_id) return
  loading.value = true
  try {
    events.value = await fetchTemporaryEvents({ familyId: sessionState.profile.family_id })
  } catch (error) { showError(error, '加载留言板失败') } finally { loading.value = false }
}

function openCreate() {
  editingEvent.value = null
  draftContent.value = ''
  showEditor.value = true
}

function openEdit(event) {
  editingEvent.value = event
  draftContent.value = displayContent(event)
  showEditor.value = true
}

function closeEditor() { showEditor.value = false }

async function handleSave() {
  const content = draftContent.value.trim()
  if (!content) return showError('请先写下要记录的内容')
  saving.value = true
  try {
    const input = { familyId: sessionState.profile.family_id, title: '留言板', content }
    const saved = editingEvent.value
      ? await updateTemporaryEvent({ ...input, eventId: editingEvent.value.id })
      : await createTemporaryEvent({ ...input, createdBy: sessionState.profile.id })
    if (editingEvent.value) {
      events.value = events.value.map((event) => event.id === saved.id ? saved : event)
    } else {
      events.value.unshift(saved)
    }
    closeEditor()
    showSuccess(editingEvent.value ? '记录已更新' : '已记下这件事')
  } catch (error) { showError(error, '保存失败，请稍后重试') } finally { saving.value = false }
}

function confirmDelete(event) {
  return new Promise((resolve) => uni.showModal({
    title: '删除这条记录？',
    content: '删除后无法恢复。',
    confirmText: '删除',
    confirmColor: '#C96A3D',
    cancelText: '取消',
    success: (result) => resolve(Boolean(result.confirm)),
    fail: () => resolve(false),
  }))
}

async function handleDelete(event) {
  if (!await confirmDelete(event)) return
  try {
    await deleteTemporaryEvent({ eventId: event.id, familyId: sessionState.profile.family_id })
    events.value = events.value.filter((item) => item.id !== event.id)
    if (editingEvent.value?.id === event.id) closeEditor()
    showSuccess('记录已删除')
  } catch (error) { showError(error, '删除失败') }
}

async function toggleCompleted(event) {
  if (updatingEventIds.value.has(event.id)) return
  updatingEventIds.value = new Set(updatingEventIds.value).add(event.id)
  try {
    const saved = await setTemporaryEventCompleted({
      eventId: event.id,
      familyId: sessionState.profile.family_id,
      isCompleted: !event.is_completed,
    })
    events.value = events.value.map((item) => item.id === saved.id ? saved : item)
    showSuccess(saved.is_completed ? '已标记完成' : '已移回待处理')
  } catch (error) { showError(error, '更新状态失败') } finally {
    const next = new Set(updatingEventIds.value)
    next.delete(event.id)
    updatingEventIds.value = next
  }
}

function displayContent(event) {
  const content = (event.content || '').trim()
  // Older notes stored their first line in title. Keep it visible while
  // presenting all notes as a single content field.
  // return event.title && event.title !== '留言板' ? [event.title, content].filter(Boolean).join('\n') : content
  return content
}
function dateTimeLabel(value) { return dayjs(value).format('YYYY.MM.DD HH:mm') }

activate()
</script>

<style lang="scss" scoped>
.events-page { padding-bottom: 48rpx; color: #4b4037; }
.events-intro { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin: 7rpx 0 25rpx; padding: 24rpx 26rpx; border: 1rpx solid rgba(166,142,119,.13); border-radius: 24rpx; background: linear-gradient(115deg, rgba(255,253,247,.98), rgba(244,239,229,.85)); box-shadow: 0 10rpx 26rpx rgba(84,63,44,.045); }
.events-intro view:first-child { display: flex; flex-direction: column; gap: 9rpx; }
.intro-kicker, .editor-kicker { color: #a18d78; font-size: 16rpx; font-weight: 700; letter-spacing: .15em; }
.intro-copy { color: #5c4c3f; font-size: 25rpx; font-weight: 600; }
.create-fab { display: flex; width: 72rpx; height: 72rpx; flex: none; align-items: center; justify-content: center; border-radius: 23rpx; background: #977455; box-shadow: 0 9rpx 18rpx rgba(117,84,54,.2); color: #fffaf3; font-size: 40rpx; cursor: pointer; }
.status-tabs { display: flex; gap: 10rpx; margin: 0 0 20rpx; padding: 7rpx; border: 1rpx solid rgba(166,142,119,.33); border-radius: 18rpx; background: rgba(255,253,247,.82); }
.status-tab { display: flex; flex: 1; align-items: center; justify-content: center; gap: 9rpx; min-height: 64rpx; border-radius: 13rpx; color: #8e7b69; font-size: 21rpx; cursor: pointer; }
@media screen and (min-width: 900px) {
  .status-tab {
  min-height: 86rpx;
  }
}
.status-tab text { display: inline-flex; min-width: 30rpx; height: 30rpx; align-items: center; justify-content: center; padding: 0 6rpx; border-radius: 999rpx; background: rgba(151,116,85,.09); color: #9b8066; font-size: 16rpx; }
.status-tab--active { background: #987657; color: #fffaf3; box-shadow: 0 5rpx 12rpx rgba(117,84,54,.15); }
.status-tab--active text { background: rgba(255,255,255,.2); color: #fffaf3; }
.events-loading { padding: 70rpx 20rpx; color: #998879; text-align: center; }
.events-grid { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 22rpx 16rpx; padding: 5rpx 2rpx; }
.empty-filtered { padding: 75rpx 20rpx; border: 1rpx dashed rgba(166,142,119,.25); border-radius: 20rpx; color: #a08d7b; text-align: center; font-size: 21rpx; }
.empty-notes { display: flex; flex-direction: column; align-items: center; padding: 45rpx 35rpx 50rpx; text-align: center; }
.empty-stack { position: relative; width: 180rpx; height: 155rpx; margin-bottom: 22rpx; }
.empty-note { position: absolute; display: flex; width: 100rpx; height: 120rpx; align-items: center; justify-content: center; border: 1rpx solid rgba(110,89,69,.1); border-radius: 18rpx 5rpx 18rpx 15rpx; box-shadow: 0 9rpx 20rpx rgba(80,61,43,.1); font-size: 36rpx; }
.empty-note--one { top: 6rpx; left: 16rpx; transform: rotate(-13deg); background: #e9f1e8; color: #80a18a; }.empty-note--two { top: 4rpx; right: 15rpx; transform: rotate(13deg); background: #f5e8dd; color: #bf9271; }.empty-note--three { top: 29rpx; left: 41rpx; z-index: 1; transform: rotate(-2deg); background: #eeeaf4; color: #9686af; }
.empty-title { color: #534539; font-size: 31rpx; font-weight: 700; }.empty-copy { max-width: 500rpx; margin-top: 11rpx; color: #98897a; font-size: 21rpx; line-height: 1.7; }
.empty-button { margin-top: 28rpx; padding: 0 33rpx; border: 1rpx solid #d5c1ad; border-radius: 999rpx; background: #fbf5ee; color: #886847; font-size: 22rpx; line-height: 70rpx; }.empty-button::after { border: 0; }
.modal-mask { position: fixed; z-index: 100; inset: 0; display: flex; align-items: flex-end; justify-content: center; padding: 26rpx; background: rgba(48,39,31,.35); backdrop-filter: blur(8px); cursor: pointer; }
.editor-card { box-sizing: border-box; width: 100%; max-width: 700px; padding: 32rpx; border-radius: 32rpx; background: #fffdf9; box-shadow: 0 20rpx 80rpx rgba(47,35,25,.2); cursor: auto; }
.editor-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26rpx; }.editor-top view { display: flex; flex-direction: column; gap: 7rpx; }.editor-title { color: #493c31; font-size: 34rpx; font-weight: 700; }.editor-close { color: #aa9988; font-size: 43rpx; cursor: pointer; }
.content-input { box-sizing: border-box; width: 100%; min-height: 210rpx; max-height: 430rpx; margin-top: 16rpx; padding: 18rpx 19rpx; border: 1rpx solid #ece3d9; border-radius: 16rpx; background: #fcfaf6; color: #55473a; font-size: 22rpx; line-height: 1.65; }
.editor-foot { display: flex; align-items: center; justify-content: space-between; gap: 10rpx; margin-top: 11rpx; }.char-count, .time-note { color: #a39486; font-size: 17rpx; }.time-note { text-align: right; }
.save-button { display: block; width: 100%; margin: 22rpx 0 0; padding: 0 22rpx; border: 0; border-radius: 18rpx; background: #977455; color: #fffaf5; font-size: 24rpx; line-height: 82rpx; }.save-button::after { border: 0; }.save-button[disabled] { opacity: .55; }
</style>
