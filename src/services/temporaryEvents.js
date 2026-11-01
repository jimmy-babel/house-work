import { getSupabaseClient } from '@/services/supabase'

const SOFT_COLORS = [
  '#E5F2E8', '#E5EFF7', '#F6E9DE', '#F2E8F2', '#E7F0F0', '#F7EADB',
  '#E9EAF6', '#F1EEDC', '#E4F0E8', '#F6E6E6', '#E4EDF3', '#F0E8DC',
]

function uniquePastelColor(usedColors) {
  const used = new Set(usedColors.map((color) => color.toLowerCase()))
  const available = SOFT_COLORS.filter((color) => !used.has(color.toLowerCase()))
  if (available.length) return available[Math.floor(Math.random() * available.length)]

  // Hue, saturation and lightness vary to keep additional tags soft and distinct.
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const hue = Math.floor(Math.random() * 360)
    const saturation = 36 + Math.floor(Math.random() * 25)
    const lightness = 88 + Math.floor(Math.random() * 8)
    const color = hslToHex(hue, saturation, lightness)
    if (!used.has(color.toLowerCase())) return color
  }

  const hue = (used.size * 137.508) % 360
  return hslToHex(hue, 46, 91)
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100
  const l = lightness / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const section = hue / 60
  const secondary = chroma * (1 - Math.abs((section % 2) - 1))
  let rgb = [0, 0, 0]

  if (section < 1) rgb = [chroma, secondary, 0]
  else if (section < 2) rgb = [secondary, chroma, 0]
  else if (section < 3) rgb = [0, chroma, secondary]
  else if (section < 4) rgb = [0, secondary, chroma]
  else if (section < 5) rgb = [secondary, 0, chroma]
  else rgb = [chroma, 0, secondary]

  const offset = l - chroma / 2
  return `#${rgb.map((value) => Math.round((value + offset) * 255).toString(16).padStart(2, '0')).join('')}`
}

function mapEventError(error) {
  if (error?.code === '23505') return new Error('标签颜色冲突，请重试')
  return error
}

export async function fetchTemporaryEvents({ familyId }) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('temporary_events')
    .select('id, family_id, title, content, tag_color, is_completed, created_by, created_at, updated_at')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createTemporaryEvent({ familyId, createdBy, title = '留言板', content }) {
  const client = getSupabaseClient()

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: existing, error: readError } = await client
      .from('temporary_events')
      .select('tag_color')
      .eq('family_id', familyId)

    if (readError) throw readError

    const tagColor = uniquePastelColor((existing || []).map((item) => item.tag_color))
    const { data, error } = await client
      .from('temporary_events')
      .insert({
        family_id: familyId,
        created_by: createdBy,
        title: title.trim(),
        content: content.trim(),
        tag_color: tagColor,
        is_completed: false,
      })
      .select('id, family_id, title, content, tag_color, is_completed, created_by, created_at, updated_at')
      .single()

    if (!error) return data
    if (error.code !== '23505') throw error
  }

  throw new Error('暂时无法分配不重复的标签颜色，请重试')
}

export async function updateTemporaryEvent({ eventId, familyId, title = '留言板', content }) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('temporary_events')
    .update({ title: title.trim(), content: content.trim() })
    .eq('id', eventId)
    .eq('family_id', familyId)
    .select('id, family_id, title, content, tag_color, is_completed, created_by, created_at, updated_at')
    .single()

  if (error) throw error
  return data
}

export async function setTemporaryEventCompleted({ eventId, familyId, isCompleted }) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('temporary_events')
    .update({ is_completed: isCompleted })
    .eq('id', eventId)
    .eq('family_id', familyId)
    .select('id, family_id, title, content, tag_color, is_completed, created_by, created_at, updated_at')
    .single()

  if (error) throw error
  return data
}

export async function deleteTemporaryEvent({ eventId, familyId }) {
  const client = getSupabaseClient()
  const { error } = await client
    .from('temporary_events')
    .delete()
    .eq('id', eventId)
    .eq('family_id', familyId)

  if (error) throw mapEventError(error)
}
