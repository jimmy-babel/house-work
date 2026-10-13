import dayjs from 'dayjs'

export function formatDate(dateValue, pattern = 'YYYY-MM-DD') {
  if (!dateValue) return '--'
  return dayjs(dateValue).format(pattern)
}

export function formatDateTime(dateValue, pattern = 'MM-DD HH:mm') {
  if (!dateValue) return '--'
  return dayjs(dateValue).format(pattern)
}

export function getToday() {
  return dayjs().format('YYYY-MM-DD')
}

export function getYesterday() {
  return dayjs().subtract(1, 'day').format('YYYY-MM-DD')
}

export function getNowIsoForDate(dateString) {
  const now = dayjs()
  return dayjs(
    `${dateString} ${now.format('HH:mm:ss')}`,
    'YYYY-MM-DD HH:mm:ss'
  ).toISOString()
}

export function resolveDateRange(rangeKey, customStart, customEnd) {
  const today = dayjs()
  if (rangeKey === 'week') {
    const dayOfWeek = today.day()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    return {
      startDate: today.subtract(mondayOffset, 'day').format('YYYY-MM-DD'),
      endDate: today.format('YYYY-MM-DD'),
    }
  }
  if (rangeKey === 'month') {
    return {
      startDate: today.startOf('month').format('YYYY-MM-DD'),
      endDate: today.format('YYYY-MM-DD'),
    }
  }

  if (rangeKey === 'all') {
    return {
      startDate: customStart || null,
      endDate: customEnd || null,
    }
  }

  return {
    startDate: customStart || today.startOf('month').format('YYYY-MM-DD'),
    endDate: customEnd || today.format('YYYY-MM-DD'),
  }
}

export function sortDateDesc(left, right) {
  return dayjs(right).valueOf() - dayjs(left).valueOf()
}
