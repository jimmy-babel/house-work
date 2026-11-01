export const CATEGORY_ORDER = ['厨房', '客厅', '厕所', '卧室', '洗衣机房', '雪福', '其他', '自定义']

export const CATEGORY_COLORS = {
  厨房: '#C96A3D',
  厕所: '#4F8FA7',
  客厅: '#7B6FAD',
  卧室: '#AE7D55',
  洗衣机房: '#5F8F6B',
  雪福: '#C47D9B',
  其他: '#6B625B',
  自定义: '#C0567B',
}

export const CUSTOM_CATEGORY_NAME = '自定义'

export const FREQUENCY_LABELS = {
  D: '日',
  W: '周',
  '2W': '2周',
  M: '月',
  L: '留意',
  '6M': '半年',
}

export const GL_FREQUENCY_PREFIX = 'GL'

export const FREQUENCY_WINDOWS = {
  D: 1,
  W: 7,
  '2W': 14,
  M: 30,
  '6M': 180,
}

export const RANGE_OPTIONS = [
  // { key: 'month', label: '本月' },
  // { key: 'week', label: '本周' },
  { key: 'all', label: '全部' },
]

export const APP_NAV_ITEMS = [
  { key: 'chores', label: '家务列表', url: '/pages/dashboard/index?tab=chores' },
  { key: 'comparison', label: '历史记录', url: '/pages/dashboard/index?tab=comparison' },
]

export const QUICK_ENTRY_ITEMS = [
  {
    key: 'chores',
    label: '家务',
    target: 'tab',
    tabKey: 'chores',
    url: '/pages/dashboard/index?tab=chores',
  },
  { key: 'pets', label: '宠物', target: 'page', url: '/pages/pets/index' },
  { key: 'items', label: '物品', target: 'page', url: '/pages/items/index' },
  { key: 'events', label: '留言板', target: 'page', url: '/pages/events/index' },
]
