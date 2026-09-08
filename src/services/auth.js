import { getSupabaseClient } from '@/services/supabase'

export async function loadCurrentProfile(userId) {
  const client = getSupabaseClient()
  const { data: profile, error } = await client
    .from('profiles')
    .select('id, family_id, display_name, role, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!profile) {
    return null
  }

  let family = null
  if (profile.family_id) {
    const { data: familyData, error: familyError } = await client
      .from('families')
      .select('id, name, join_code, created_at')
      .eq('id', profile.family_id)
      .maybeSingle()

    if (familyError) {
      throw familyError
    }

    family = familyData
  }

  return {
    ...profile,
    family,
  }
}

async function ensurePasswordSession(email, password, signupResult) {
  if (signupResult?.session) {
    return signupResult.session
  }

  const client = getSupabaseClient()
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  return data.session
}

export async function signInWithPassword(email, password) {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  return data
}

export async function signUpAndCreateFamily({ email, password, displayName, familyName }) {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.signUp({
    email,
    password,
  })

  if (error) {
    throw error
  }

  await ensurePasswordSession(email, password, data)
  const { data: familyData, error: familyError } = await client.rpc('create_family_with_profile', {
    p_family_name: familyName,
    p_display_name: displayName,
  })

  if (familyError) {
    throw familyError
  }

  return Array.isArray(familyData) ? familyData[0] : familyData
}

export async function signUpAndJoinFamily({ email, password, displayName, joinCode }) {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.signUp({
    email,
    password,
  })

  if (error) {
    throw error
  }

  await ensurePasswordSession(email, password, data)
  const { data: familyData, error: joinError } = await client.rpc('join_family_with_profile', {
    p_join_code: joinCode,
    p_display_name: displayName,
  })

  if (joinError) {
    throw joinError
  }

  return Array.isArray(familyData) ? familyData[0] : familyData
}

export async function createFamilyForCurrentUser({ displayName, familyName }) {
  const client = getSupabaseClient()
  const { data, error } = await client.rpc('create_family_with_profile', {
    p_family_name: familyName,
    p_display_name: displayName,
  })

  if (error) {
    throw error
  }

  return Array.isArray(data) ? data[0] : data
}

export async function joinFamilyForCurrentUser({ displayName, joinCode }) {
  const client = getSupabaseClient()
  const { data, error } = await client.rpc('join_family_with_profile', {
    p_join_code: joinCode,
    p_display_name: displayName,
  })

  if (error) {
    throw error
  }

  return Array.isArray(data) ? data[0] : data
}

export async function signOut() {
  const client = getSupabaseClient()
  const { error } = await client.auth.signOut()
  if (error) {
    throw error
  }
}
