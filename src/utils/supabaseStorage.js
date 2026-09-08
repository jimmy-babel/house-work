const KEY_PREFIX = 'housework-helper'

function keyFor(key) {
  return `${KEY_PREFIX}:${key}`
}

export const supabaseStorage = {
  getItem(key) {
    try {
      return Promise.resolve(uni.getStorageSync(keyFor(key)) || null)
    } catch (error) {
      console.warn('Failed to read auth storage', error)
      return Promise.resolve(null)
    }
  },
  setItem(key, value) {
    try {
      uni.setStorageSync(keyFor(key), value)
    } catch (error) {
      console.warn('Failed to persist auth storage', error)
    }
    return Promise.resolve()
  },
  removeItem(key) {
    try {
      uni.removeStorageSync(keyFor(key))
    } catch (error) {
      console.warn('Failed to clear auth storage', error)
    }
    return Promise.resolve()
  },
}
