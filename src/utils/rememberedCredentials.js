const STORAGE_KEY = 'housework-helper:remembered-credentials'

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getRememberedCredentials() {
  try {
    const rawValue = uni.getStorageSync(STORAGE_KEY)
    if (!rawValue) {
      return null
    }

    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
    const email = normalizeEmail(parsed?.email)
    const password = typeof parsed?.password === 'string' ? parsed.password : ''

    if (!email || !password) {
      return null
    }

    return {
      email,
      password,
      updatedAt: parsed?.updatedAt || '',
    }
  } catch (error) {
    console.warn('Failed to read remembered credentials', error)
    return null
  }
}

export function saveRememberedCredentials({ email, password }) {
  const normalizedEmail = normalizeEmail(email)
  const normalizedPassword = typeof password === 'string' ? password : ''

  if (!normalizedEmail || !normalizedPassword) {
    return
  }

  try {
    uni.setStorageSync(
      STORAGE_KEY,
      JSON.stringify({
        email: normalizedEmail,
        password: normalizedPassword,
        updatedAt: new Date().toISOString(),
      })
    )
  } catch (error) {
    console.warn('Failed to persist remembered credentials', error)
  }
}

export function clearRememberedCredentials() {
  try {
    uni.removeStorageSync(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear remembered credentials', error)
  }
}
