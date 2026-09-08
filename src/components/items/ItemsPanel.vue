<template>
  <view class="page">
    <StateBlock
      v-if="loading"
      title="正在加载物品列表"
      description="稍等一下，我们正在同步当前家庭的物品记录。"
    />

    <template v-else>
      <view class="columns">
        <view
          v-for="column in itemColumns"
          :key="column.key"
          class="column-card"
        >
          <view class="column-header">
            <view class="column-copy">
              <text class="column-title">{{ column.title }}</text>
              <text class="column-subtitle">{{ column.subtitle }}</text>
            </view>
            <view class="add-button" @tap="openCreateModal(column.key)">
              <text>新增</text>
            </view>
          </view>

          <view v-if="column.items.length" class="item-list">
            <view v-for="item in column.items" :key="item.id" class="item-chip">
              <view
                v-if="item.category_type === 'regular'"
                class="item-delete"
                @tap="handleDelete(item)"
              >
                <text>×</text>
              </view>
              <text class="item-name">{{ item.name }}</text>

              <view v-if="item.category_type === 'consumable'" class="item-quantity">
                <view class="quantity-button" @tap="handleQuantityChange(item, -1)">
                  <text>▼</text>
                </view>
                <text class="quantity-value">{{ item.quantity }}</text>
                <view class="quantity-button" @tap="handleQuantityChange(item, 1)">
                  <text>▲</text>
                </view>
              </view>
            </view>
          </view>
          <text v-else class="empty-text">暂无数据</text>
        </view>
      </view>
    </template>

    <view v-if="showCreateModal" class="create-modal-mask" @tap="closeCreateModal">
      <view class="create-modal" @tap.stop>
        <text class="create-modal__title">
          {{ createCategory === 'consumable' ? '新增消耗物品' : '新增常规物品' }}
        </text>
        <input
          v-model.trim="createName"
          class="create-modal__input"
          placeholder="请输入物品名称"
          maxlength="40"
          confirm-type="done"
          @confirm="handleCreateItem"
        />
        <up-button type="primary" shape="circle" :loading="creating" @click="handleCreateItem">
          确定
        </up-button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import StateBlock from '@/components/common/StateBlock.vue'
import { useSession } from '@/composables/useSession'
import {
  createHouseholdItem,
  fetchHouseholdItems,
  softDeleteHouseholdItem,
  updateConsumableQuantity,
} from '@/services/inventory'
import { showError, showSuccess } from '@/utils/feedback'

const { state: sessionState } = useSession()

const loading = ref(false)
const creating = ref(false)
const showCreateModal = ref(false)
const createCategory = ref('consumable')
const createName = ref('')
const items = ref([])

const itemColumns = computed(() => [
  {
    key: 'consumable',
    title: '消耗物品',
    // subtitle: '可增减数量，数量为 0 也会保留。',
    items: items.value.filter((item) => item.category_type === 'consumable'),
  },
  {
    key: 'regular',
    title: '常规物品',
    // subtitle: '不记录数量，只管理是否存在。',
    items: items.value.filter((item) => item.category_type === 'regular'),
  },
])

async function loadItems() {
  if (!sessionState.profile?.family_id) {
    return
  }
  if(itemColumns.value.length === 0){
    loading.value = true
  }
  try {
    items.value = await fetchHouseholdItems({
      familyId: sessionState.profile.family_id,
    })
  } catch (error) {
    showError(error, '加载物品记录失败')
  } finally {
    loading.value = false
  }
}

function openCreateModal(categoryType) {
  createCategory.value = categoryType
  createName.value = ''
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
  createName.value = ''
}

async function handleCreateItem() {
  const name = createName.value.trim()
  if (!name) {
    showError('请输入物品名称')
    return
  }

  creating.value = true
  try {
    await createHouseholdItem({
      familyId: sessionState.profile.family_id,
      createdBy: sessionState.profile.id,
      categoryType: createCategory.value,
      name,
    })
    closeCreateModal()
    await loadItems()
    showSuccess('物品已添加')
  } catch (error) {
    showError(error, '新增失败')
  } finally {
    creating.value = false
  }
}

function confirmDelete(item) {
  return new Promise((resolve) => {
    uni.showModal({
      title: '确认删除',
      content: `确定要删除「${item.name}」吗？`,
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

async function deleteItem(item) {
  try {
    await softDeleteHouseholdItem({
      itemId: item.id,
      familyId: sessionState.profile.family_id,
    })
    items.value = items.value.filter((current) => current.id !== item.id)
    showSuccess('物品已删除')
  } catch (error) {
    showError(error, '删除物品失败')
  }
}

async function handleDelete(item) {
  const confirmed = await confirmDelete(item)
  if (!confirmed) return

  await deleteItem(item)
}

async function handleQuantityChange(item, delta) {
  if (delta < 0 && Number(item.quantity || 0) <= 0) {
    const confirmed = await confirmDelete(item)
    if (!confirmed) return

    await deleteItem(item)
    return
  }

  try {
    const updatedItem = await updateConsumableQuantity({
      itemId: item.id,
      familyId: sessionState.profile.family_id,
      delta,
    })
    items.value = items.value.map((current) =>
      current.id === updatedItem.id ? updatedItem : current
    )
  } catch (error) {
    showError(error, '更新数量失败')
  }
}

defineExpose({
  activate: loadItems,
})
</script>

<style lang="scss" scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.column-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  min-width: 0;
  padding: 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 251, 246, 0.92);
  box-shadow: 0 16rpx 36rpx rgba(88, 57, 38, 0.07);
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}

.column-copy {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.column-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #2e231c;
}

.column-subtitle,
.empty-text {
  font-size: 22rpx;
  line-height: 1.6;
  color: #8d7665;
}

.add-button {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #c96a3d;
  color: #fff8f3;
  font-size: 20rpx;
  line-height: 20rpx;
  cursor: pointer;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.item-chip {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  // flex-direction: column;
  gap: 12rpx;
  padding: 6rpx 10rpx;
  // border-radius: 22rpx;
  // background: #f9f1e7;
  // border: 2rpx solid rgba(169, 137, 112, 0.14);
}

.item-name {
  padding-right: 4rpx;
  font-size: 24rpx;
  line-height: 24rpx;
  // line-height: 1.4;
  color: #32251d;
  word-break: break-word;
}

.item-delete {
  position: absolute;
  top: 50%;
  right: 1px;
  transform: translateY(-50%);
  width: 26rpx;
  height: 26rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(47, 36, 29, 0.5);
  color: #fff;
  font-size: 18rpx;
  cursor: pointer;
  overflow: hidden;
}

.item-quantity {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  align-self: flex-start;
  // padding: 0 10rpx;
  border-radius: 999rpx;
  margin-right: -14rpx;
  // background: rgba(201, 106, 61, 0.1);
}

.quantity-button {
  width: 34rpx;
  height: 34rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #fff8f2;
  color: #6b5647;
  font-size: 18rpx;
  // line-height: 34rpx;
  cursor: pointer;
  font-weight: bold;
}

.quantity-value {
  min-width: 24rpx;
  text-align: center;
  font-size: 24rpx;
  font-weight: 700;
  color: #c96a3d;
}

.create-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background: rgba(0, 0, 0, 0.58);
}

.create-modal {
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

.create-modal__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #2f241d;
  text-align: center;
}

.create-modal__input {
  width: 100%;
  min-height: 88rpx;
  padding: 0 24rpx;
  border: 2rpx solid rgba(153, 120, 93, 0.18);
  border-radius: 22rpx;
  background: #fffdf9;
  font-size: 28rpx;
  color: #2b211b;
}

@media screen and (max-width: 420px) {
  .columns {
    gap: 14rpx;
  }

  .column-card {
    padding: 18rpx;
  }
}
</style>
