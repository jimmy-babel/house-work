import { getSupabaseClient } from '@/services/supabase'

const RECORD_PAGE_SIZE = 1000

export async function fetchPets({ familyId, includeArchived = false }) {
  const client = getSupabaseClient()
  let query = client
    .from('pets')
    .select('id, family_id, name, is_active, created_by, created_at, updated_at')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })

  if (!includeArchived) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createPet({ familyId, createdBy, name }) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('pets')
    .insert({ family_id: familyId, created_by: createdBy, name: name.trim() })
    .select('id, family_id, name, is_active, created_by, created_at, updated_at')
    .single()

  if (error) throw error
  return data
}

export async function archivePet({ petId, familyId }) {
  const client = getSupabaseClient()
  const { error } = await client
    .from('pets')
    .update({ is_active: false })
    .eq('id', petId)
    .eq('family_id', familyId)
    .eq('is_active', true)

  if (error) throw error
}

export async function fetchPetHealthRecords({ familyId, petId }) {
  const client = getSupabaseClient()
  const records = []
  let offset = 0

  while (true) {
    const { data, error } = await client
      .from('pet_health_records')
      .select('id, family_id, pet_id, metric_type, value, recorded_at, created_by, created_at')
      .eq('family_id', familyId)
      .eq('pet_id', petId)
      .order('recorded_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + RECORD_PAGE_SIZE - 1)

    if (error) throw error
    records.push(...(data || []))
    if (!data || data.length < RECORD_PAGE_SIZE) break
    offset += RECORD_PAGE_SIZE
  }

  return records
}

export async function createPetHealthRecord({
  familyId,
  petId,
  createdBy,
  metricType,
  value,
  recordedAt,
}) {
  const client = getSupabaseClient()
  const columns = 'id, family_id, pet_id, metric_type, value, recorded_at, created_by, created_at'
  const row = {
    family_id: familyId,
    pet_id: petId,
    created_by: createdBy,
    metric_type: metricType,
    value,
    ...(recordedAt ? { recorded_at: recordedAt } : {}),
  }
  const { data, error } = await client
    .from('pet_health_records')
    .insert(row)
    .select(columns)
    .single()

  if (error) throw error
  return data
}

export async function deletePetHealthRecord({ recordId, familyId }) {
  const client = getSupabaseClient()
  const { error } = await client
    .from('pet_health_records')
    .delete()
    .eq('id', recordId)
    .eq('family_id', familyId)

  if (error) throw error
}
