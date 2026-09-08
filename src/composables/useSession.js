import { computed, reactive } from 'vue'
import { loadCurrentProfile, signOut as signOutUser } from '@/services/auth'
import { getSupabaseClient, getSupabaseConfigError, isSupabaseConfigured } from '@/services/supabase'

const state = reactive({
  initialized: false,
  loading: false,
  session: null,
  profile: null,
  profileMissing: false,
  configError: isSupabaseConfigured ? '' : getSupabaseConfigError(),
  sessionError: '',
})

let initPromise
let authSubscription
let profileRequestId = 0
const SESSION_TIMEOUT_MS = 10000

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage))
      }, timeoutMs)
    }),
  ])
}

async function executeProfileSync(requestId, session, timeoutMessage, fallbackMessage) {
  try {
    state.session = session

    if (!session?.user?.id) {
      if (requestId === profileRequestId) {
        state.profile = null
        state.profileMissing = false
      }
      return null
    }

    const profile = await withTimeout(
      loadCurrentProfile(session.user.id),
      SESSION_TIMEOUT_MS,
      timeoutMessage
    )

    if (requestId !== profileRequestId) {
      return null
    }

    state.profile = profile
    state.profileMissing = !profile
    return profile
  } catch (error) {
    if (requestId !== profileRequestId) {
      return null
    }

    console.error('Failed to sync session profile', error)
    state.sessionError = error?.message || fallbackMessage
    return null
  } finally {
    if (requestId === profileRequestId) {
      state.initialized = true
      state.loading = false
    }
  }
}

function beginProfileSync(session, timeoutMessage, fallbackMessage, deferred = false) {
  const requestId = ++profileRequestId
  state.session = session
  state.loading = true
  state.sessionError = ''

  if (deferred) {
    setTimeout(() => {
      void executeProfileSync(requestId, session, timeoutMessage, fallbackMessage)
    }, 0)
    return Promise.resolve(null)
  }

  return executeProfileSync(requestId, session, timeoutMessage, fallbackMessage)
}

async function bootstrapSession() {
  state.loading = true
  state.sessionError = ''
  try {
    if (!isSupabaseConfigured) {
      return
    }

    const client = getSupabaseClient()
    const {
      data: { session },
    } = await withTimeout(
      client.auth.getSession(),
      SESSION_TIMEOUT_MS,
      '恢复登录会话超时，请刷新页面重试。'
    )

    await beginProfileSync(
      session,
      '读取家庭资料超时，请刷新页面重试。',
      '恢复登录状态失败，请刷新页面重试。'
    )
  } catch (error) {
    console.error('Failed to bootstrap session', error)
    state.sessionError = error?.message || '恢复登录状态失败，请刷新页面重试。'
    state.initialized = true
    state.loading = false
  }
}

export function initSession() {
  if (!initPromise) {
    initPromise = bootstrapSession()
  }

  if (isSupabaseConfigured && !authSubscription) {
    const client = getSupabaseClient()
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      void beginProfileSync(
        session,
        '读取家庭资料超时，请刷新页面重试。',
        '同步登录状态失败，请刷新页面重试。',
        true
      )
    })
    authSubscription = subscription
  }

  return initPromise
}

export async function refreshProfile() {
  if (!state.session?.user?.id) {
    state.profile = null
    state.profileMissing = false
    return null
  }

  state.loading = true
  state.sessionError = ''

  try {
    const profile = await withTimeout(
      loadCurrentProfile(state.session.user.id),
      SESSION_TIMEOUT_MS,
      '读取家庭资料超时，请刷新页面重试。'
    )
    state.profile = profile
    state.profileMissing = !profile
    return profile
  } catch (error) {
    console.error('Failed to refresh profile', error)
    state.sessionError = error?.message || '同步登录状态失败，请刷新页面重试。'
    throw error
  } finally {
    state.initialized = true
    state.loading = false
  }
}

export async function ensureAuthenticatedPage() {
  await initSession()
  return Boolean(state.session?.user?.id && state.profile?.family_id)
}

export async function signOutAndReset() {
  await signOutUser()
  profileRequestId += 1
  state.session = null
  state.profile = null
  state.profileMissing = false
  state.sessionError = ''
}

export function useSession() {
  return {
    state,
    isLoggedIn: computed(() => Boolean(state.session?.user?.id)),
    hasProfile: computed(() => Boolean(state.profile?.family_id)),
  }
}
