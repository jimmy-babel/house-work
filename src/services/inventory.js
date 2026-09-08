import { getSupabaseClient } from '@/services/supabase'

function normalizeItemName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim()
}

function mapInventoryError(error) {
  if (error?.code === '23505') {
    return new Error('同分类下已存在同名物品')
  }

  return error
}

export async function fetchHouseholdItems({ familyId }) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('household_items')
    .select('id, family_id, category_type, name, quantity, sort_order, is_active, created_by, created_at, updated_at')
    .eq('family_id', familyId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw mapInventoryError(error)
  }

  return data || []
}

export async function createHouseholdItem({ familyId, createdBy, categoryType, name }) {
  const normalizedName = normalizeItemName(name)
  const client = getSupabaseClient()
  const payload = {
    family_id: familyId,
    created_by: createdBy,
    category_type: categoryType,
    name: normalizedName,
    quantity: categoryType === 'consumable' ? 1 : null,
  }

  const { data, error } = await client
    .from('household_items')
    .insert(payload)
    .select('id, family_id, category_type, name, quantity, sort_order, is_active, created_by, created_at, updated_at')
    .single()

  if (error) {
    throw mapInventoryError(error)
  }

  return data
}

export async function updateConsumableQuantity({ itemId, familyId, delta }) {
  const client = getSupabaseClient()
  const { data: item, error: selectError } = await client
    .from('household_items')
    .select('id, family_id, category_type, quantity, is_active')
    .eq('id', itemId)
    .eq('family_id', familyId)
    .eq('is_active', true)
    .maybeSingle()

  if (selectError) {
    throw mapInventoryError(selectError)
  }

  if (!item) {
    throw new Error('未找到对应物品')
  }

  if (item.category_type !== 'consumable') {
    throw new Error('只有消耗物品可以调整数量')
  }

  const nextQuantity = Math.max(0, Number(item.quantity || 0) + delta)
  const { data, error: updateError } = await client
    .from('household_items')
    .update({ quantity: nextQuantity })
    .eq('id', itemId)
    .eq('family_id', familyId)
    .eq('is_active', true)
    .select('id, family_id, category_type, name, quantity, sort_order, is_active, created_by, created_at, updated_at')
    .single()

  if (updateError) {
    throw mapInventoryError(updateError)
  }

  return data
}

export async function softDeleteHouseholdItem({ itemId, familyId }) {
  const client = getSupabaseClient()
  const { error } = await client
    .from('household_items')
    .update({ is_active: false })
    .eq('id', itemId)
    .eq('family_id', familyId)
    .eq('is_active', true)

  if (error) {
    throw mapInventoryError(error)
  }
}
