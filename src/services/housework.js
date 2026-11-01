import { CATEGORY_ORDER, CUSTOM_CATEGORY_NAME } from '@/constants/housework'
import { sortDateDesc } from '@/utils/date'
import { getSupabaseClient } from '@/services/supabase'

function compareByCategoryAndOrder(left, right) {
  const leftIndex = CATEGORY_ORDER.indexOf(left.category_name)
  const rightIndex = CATEGORY_ORDER.indexOf(right.category_name)
  const categoryDiff =
    (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
    (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)

  if (categoryDiff !== 0) return categoryDiff
  return left.sort_order - right.sort_order
}

export function normalizeChoreName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim()
}

export async function fetchChoreCatalog() {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('chore_catalog')
    .select('id, category_name, name, raw_label, frequency_code, source_row_no, sort_order')
    .eq('is_active', true)

  if (error) {
    throw error
  }

  return [...(data || [])].sort(compareByCategoryAndOrder)
}

export async function fetchFamilyChoreLatestCompletionByName({ familyId, startDate }) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('chore_completion_records')
    .select('chore_name_snapshot, completed_on')
    .eq('family_id', familyId)
    .gte('completed_on', startDate)
    .order('completed_on', { ascending: false })

  if (error) {
    throw error
  }

  return (data || []).reduce((accumulator, record) => {
    const normalizedName = normalizeChoreName(record.chore_name_snapshot)
    if (!normalizedName || accumulator[normalizedName]) {
      return accumulator
    }

    accumulator[normalizedName] = record.completed_on
    return accumulator
  }, {})
}

export async function fetchFamilyChoreReminderState({ familyId, startDate }) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('chore_completion_records')
    .select('chore_name_snapshot, frequency_code_snapshot, completed_on, completed_at')
    .eq('family_id', familyId)
    .order('completed_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data || []).reduce(
    (accumulator, record) => {
      const normalizedName = normalizeChoreName(record.chore_name_snapshot)
      if (normalizedName && !accumulator.byName[normalizedName]) {
        accumulator.byName[normalizedName] = record.completed_on
      }

      if (record.frequency_code_snapshot && !accumulator.byFrequencyCode[record.frequency_code_snapshot]) {
        accumulator.byFrequencyCode[record.frequency_code_snapshot] = {
          completedOn: record.completed_on,
          completedAt: record.completed_at,
        }
      }

      return accumulator
    },
    {
      byName: {},
      byFrequencyCode: {},
    }
  )
}

export async function createCompletionRecords({ userId, familyId, items, completedOn, completedAt }) {
  const client = getSupabaseClient()
  const payload = items.map((item) => {
    if (item.type === 'custom') {
      return {
        user_id: userId,
        family_id: familyId,
        chore_id: null,
        chore_name_snapshot: item.name,
        category_name_snapshot: CUSTOM_CATEGORY_NAME,
        frequency_code_snapshot: null,
        completed_on: completedOn,
        completed_at: completedAt,
      }
    }

    return {
      user_id: userId,
      family_id: familyId,
      chore_id: item.choreId,
      completed_on: completedOn,
      completed_at: completedAt,
    }
  })

  const { error } = await client.from('chore_completion_records').insert(payload)

  if (error) {
    throw error
  }
}

export async function fetchFamilyMembers(familyId) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('profiles')
    .select('id, family_id, display_name, role, created_at')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return data || []
}

export async function fetchCompletionRecords({
  familyId,
  startDate,
  endDate,
}) {
  const client = getSupabaseClient()
  let query = client
    .from('chore_completion_records')
    .select(
      'id, family_id, user_id, chore_id, chore_name_snapshot, category_name_snapshot, frequency_code_snapshot, completed_on, completed_at, created_at'
    )
    .eq('family_id', familyId)
    .order('completed_at', { ascending: false })
    .order('id', { ascending: false })

  if (startDate) {
    query = query.gte('completed_on', startDate)
  }

  if (endDate) {
    query = query.lte('completed_on', endDate)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data || []
}

export async function fetchCompletionRecordStats({ familyId, startDate, endDate }) {
  const client = getSupabaseClient()
  const { data, error } = await client.rpc('get_completion_record_stats', {
    p_family_id: familyId,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  })

  if (error) {
    throw error
  }

  return data || { members: [], daily_checkins: [] }
}

export async function updateCompletionRecordDate({
  recordId,
  familyId,
  userId,
  completedOn,
  completedAt,
}) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('chore_completion_records')
    .update({
      completed_on: completedOn,
      completed_at: completedAt,
    })
    .eq('id', recordId)
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .select(
      'id, family_id, user_id, chore_id, chore_name_snapshot, category_name_snapshot, frequency_code_snapshot, completed_on, completed_at, created_at'
    )
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('未找到可编辑的完成记录')
  }

  return data
}

export async function deleteCompletionRecord({ recordId, familyId, userId }) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('chore_completion_records')
    .delete()
    .eq('id', recordId)
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('未找到可删除的完成记录')
  }
}

export function buildComparisonData(members, records, stats = {}) {
  const memberMap = new Map(members.map((member) => [member.id, member]))
  const statsByMember = new Map((stats.members || []).map((item) => [item.user_id, item]))

  const memberCards = members
    .map((member) => {
      const memberStats = statsByMember.get(member.id)
      const categoryCountMap = memberStats?.category_counts || {}

      return {
        ...member,
        totalCount: Number(memberStats?.total_count || 0),
        latestCompletedAt: memberStats?.latest_completed_at || null,
        categories: CATEGORY_ORDER.map((category) => ({
          name: category,
          count: Number(categoryCountMap[category] || 0),
        })).filter((item) => item.count > 0),
      }
    })
    .sort((left, right) => right.totalCount - left.totalCount)

  const categoryMatrix = CATEGORY_ORDER.map((category) => {
    const row = { category }
    memberCards.forEach((member) => {
      row[member.id] = member.categories.find((item) => item.name === category)?.count || 0
    })
    row.total = memberCards.reduce((sum, member) => sum + row[member.id], 0)
    return row
  }).filter((row) => row.total > 0)

  const timelineGroups = []
  const dateMap = new Map()

  records
    .map((record) => ({
      ...record,
      memberName: memberMap.get(record.user_id)?.display_name || '未命名成员',
    }))
    .sort((left, right) =>
      sortDateDesc(left.completed_at, right.completed_at) || right.id.localeCompare(left.id)
    )
    .forEach((record) => {
      if (!dateMap.has(record.completed_on)) {
        const group = {
          date: record.completed_on,
          records: [],
        }
        dateMap.set(record.completed_on, group)
        timelineGroups.push(group)
      }
      dateMap.get(record.completed_on).records.push(record)
    })

  return {
    memberCards,
    categoryMatrix,
    timelineGroups,
  }
}
