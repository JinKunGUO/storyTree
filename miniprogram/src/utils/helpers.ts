/**
 * 工具函数集合
 */

import { API_BASE_URL } from './constants'

/**
 * 格式化时间（相对时间）
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  if (months < 12) return `${months}个月前`
  return `${years}年前`
}

/**
 * 格式化日期
 */
export function formatDate(dateStr: string, format = 'YYYY-MM-DD'): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
}

/**
 * 格式化数字（超过1000显示 1k+）
 */
export function formatNumber(num: number): string {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return String(num)
}

/**
 * 格式化字数
 */
export function formatWordCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万字`
  return `${count}字`
}

/**
 * 构建图片完整 URL
 */
export function getImageUrl(path?: string): string {
  if (!path) return '/static/images/default-cover.jpg'
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`
  return path
}

/**
 * 构建头像完整 URL
 */
export function getAvatarUrl(avatar?: string): string {
  if (!avatar) return '/static/images/default-avatar.png'
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`
  return avatar
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay = 300
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (...args: Parameters<T>) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
      timer = null
    }, delay)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay = 300
): (...args: Parameters<T>) => void {
  let lastTime = 0
  return function (...args: Parameters<T>) {
    const now = Date.now()
    if (now - lastTime >= delay) {
      fn(...args)
      lastTime = now
    }
  }
}

/**
 * 显示成功提示
 */
export function showSuccess(title: string, duration = 1500): void {
  uni.showToast({ title, icon: 'success', duration })
}

/**
 * 显示错误提示
 */
export function showError(title: string, duration = 2000): void {
  uni.showToast({ title, icon: 'none', duration })
}

/**
 * 显示确认弹窗
 */
export function showConfirm(options: {
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
}): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: options.title || '提示',
      content: options.content,
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      success: (res) => resolve(res.confirm),
      fail: () => resolve(false),
    })
  })
}

/**
 * 复制文本到剪贴板
 */
export function copyToClipboard(text: string): void {
  uni.setClipboardData({
    data: text,
    success: () => showSuccess('已复制'),
  })
}

/**
 * 跳转到登录页（带 redirect 参数）
 */
export function navigateToLogin(): void {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const redirect = encodeURIComponent(`/${currentPage.route}`)
  uni.navigateTo({ url: `/pages/auth/login/index?redirect=${redirect}` })
}

/**
 * 解析故事树路径为层级数组
 * 例："/1/3/7/" => [1, 3, 7]
 */
export function parsePath(path: string): number[] {
  return path
    .split('/')
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n))
}

/**
 * 计算阅读时间（分钟）
 */
export function calcReadTime(wordCount: number): string {
  const minutes = Math.ceil(wordCount / 300)
  if (minutes < 1) return '不到1分钟'
  return `约${minutes}分钟`
}

/**
 * 获取等级对应颜色
 */
export function getLevelColor(level: number): string {
  const colors = ['#94a3b8', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899']
  return colors[Math.min(level - 1, colors.length - 1)] || colors[0]
}

/**
 * 生成随机颜色（用于头像背景）
 */
export function generateAvatarColor(username: string): string {
  const colors = [
    '#7c6af7', '#10b981', '#3b82f6', '#f59e0b',
    '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
  ]
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

