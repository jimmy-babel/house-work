export function showSuccess(title) {
  uni.showToast({
    title,
    icon: 'success',
  })
}

export function showError(error, fallback = '操作失败，请稍后重试') {
  const message = error?.message || (typeof error === 'string' ? error : '') || fallback

  uni.showToast({
    title: message,
    icon: 'none',
    duration: 2600,
  })
}

export function copyText(text, successTitle = '已复制') {
  uni.setClipboardData({
    data: text,
    success() {
      showSuccess(successTitle)
    },
  })
}
