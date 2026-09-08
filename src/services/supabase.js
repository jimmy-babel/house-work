import { createClient } from '@supabase/supabase-js'
import { supabaseStorage } from '@/utils/supabaseStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export function getSupabaseConfigError() {
  if (isSupabaseConfigured) return ''
  return '请先在项目根目录创建 .env.local，并填写 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY。'
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: supabaseStorage,
      },
    })
  : null

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(getSupabaseConfigError())
  }
  return supabase
}
