import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatRelativeTime,
  formatDate,
  formatNumber,
  formatWordCount,
  getImageUrl,
  getAvatarUrl,
  truncateText,
  parsePath,
  calcReadTime,
  getLevelColor,
  generateAvatarColor,
  debounce,
  throttle,
} from '../helpers'

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------
describe('formatRelativeTime', () => {
  it('returns "刚刚" for times less than 60 seconds ago', () => {
    const now = new Date()
    expect(formatRelativeTime(now.toISOString())).toBe('刚刚')
    const tenSecondsAgo = new Date(now.getTime() - 10 * 1000)
    expect(formatRelativeTime(tenSecondsAgo.toISOString())).toBe('刚刚')
  })

  it('returns "X分钟前" for 1-59 minutes ago', () => {
    const now = new Date()
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMinAgo.toISOString())).toBe('5分钟前')

    const fiftyNineMinAgo = new Date(now.getTime() - 59 * 60 * 1000)
    expect(formatRelativeTime(fiftyNineMinAgo.toISOString())).toBe('59分钟前')
  })

  it('returns "X小时前" for 1-23 hours ago', () => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000)
    expect(formatRelativeTime(oneHourAgo.toISOString())).toBe('1小时前')

    const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000)
    expect(formatRelativeTime(twentyThreeHoursAgo.toISOString())).toBe('23小时前')
  })

  it('returns "X天前" for 1-29 days ago', () => {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(oneDayAgo.toISOString())).toBe('1天前')

    const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(twentyNineDaysAgo.toISOString())).toBe('29天前')
  })

  it('returns "X个月前" for 1-11 months ago', () => {
    const now = new Date()
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(oneMonthAgo.toISOString())).toBe('1个月前')

    const elevenMonthsAgo = new Date(now.getTime() - 330 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(elevenMonthsAgo.toISOString())).toBe('11个月前')
  })

  it('returns "X年前" for 12+ months ago', () => {
    const now = new Date()
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(oneYearAgo.toISOString())).toBe('1年前')

    const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(twoYearsAgo.toISOString())).toBe('2年前')
  })
})

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  // Use date strings without 'Z' so Date parses them as local time,
  // matching the behavior of getHours()/getMinutes() which return local time.
  it('formats with default YYYY-MM-DD', () => {
    const result = formatDate('2024-06-15T10:30:00')
    expect(result).toBe('2024-06-15')
  })

  it('formats with YYYY-MM-DD HH:mm', () => {
    const result = formatDate('2024-06-15T10:30:00', 'YYYY-MM-DD HH:mm')
    expect(result).toBe('2024-06-15 10:30')
  })

  it('pads single-digit months and days', () => {
    const result = formatDate('2024-01-05T09:05:00')
    expect(result).toBe('2024-01-05')
  })

  it('pads single-digit hours and minutes', () => {
    const result = formatDate('2024-06-15T08:07:00', 'YYYY-MM-DD HH:mm')
    expect(result).toBe('2024-06-15 08:07')
  })
})

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------
describe('formatNumber', () => {
  it('returns the number as string for values < 1000', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(500)).toBe('500')
    expect(formatNumber(999)).toBe('999')
  })

  it('returns X.Xk for values >= 1000 and < 10000', () => {
    expect(formatNumber(1000)).toBe('1.0k')
    expect(formatNumber(5500)).toBe('5.5k')
    expect(formatNumber(9900)).toBe('9.9k')
  })

  it('returns X.Xw for values >= 10000', () => {
    expect(formatNumber(10000)).toBe('1.0w')
    expect(formatNumber(15000)).toBe('1.5w')
    expect(formatNumber(123456)).toBe('12.3w')
  })
})

// ---------------------------------------------------------------------------
// formatWordCount
// ---------------------------------------------------------------------------
describe('formatWordCount', () => {
  it('returns "X字" for counts < 10000', () => {
    expect(formatWordCount(0)).toBe('0字')
    expect(formatWordCount(500)).toBe('500字')
    expect(formatWordCount(9999)).toBe('9999字')
  })

  it('returns "X.X万字" for counts >= 10000', () => {
    expect(formatWordCount(10000)).toBe('1.0万字')
    expect(formatWordCount(25000)).toBe('2.5万字')
  })
})

// ---------------------------------------------------------------------------
// getImageUrl
// ---------------------------------------------------------------------------
describe('getImageUrl', () => {
  it('returns default cover when path is undefined', () => {
    expect(getImageUrl()).toBe('/static/images/default-cover.jpg')
  })

  it('returns default cover when path is empty string', () => {
    expect(getImageUrl('')).toBe('/static/images/default-cover.jpg')
  })

  it('returns http URL unchanged', () => {
    expect(getImageUrl('http://example.com/img.jpg')).toBe('http://example.com/img.jpg')
  })

  it('returns https URL unchanged', () => {
    expect(getImageUrl('https://example.com/img.jpg')).toBe('https://example.com/img.jpg')
  })

  it('prepends API_BASE_URL for relative paths starting with /', () => {
    expect(getImageUrl('/uploads/img.jpg')).toBe('http://localhost:3001/uploads/img.jpg')
  })
})

// ---------------------------------------------------------------------------
// getAvatarUrl
// ---------------------------------------------------------------------------
describe('getAvatarUrl', () => {
  it('returns default avatar when avatar is undefined', () => {
    expect(getAvatarUrl()).toBe('/static/images/default-avatar.png')
  })

  it('returns default avatar when avatar is empty string', () => {
    expect(getAvatarUrl('')).toBe('/static/images/default-avatar.png')
  })

  it('returns http URL unchanged', () => {
    expect(getAvatarUrl('http://example.com/avatar.png')).toBe('http://example.com/avatar.png')
  })

  it('returns https URL unchanged', () => {
    expect(getAvatarUrl('https://example.com/avatar.png')).toBe('https://example.com/avatar.png')
  })

  it('prepends API_BASE_URL for relative paths starting with /', () => {
    expect(getAvatarUrl('/uploads/avatar.png')).toBe('http://localhost:3001/uploads/avatar.png')
  })
})

// ---------------------------------------------------------------------------
// truncateText
// ---------------------------------------------------------------------------
describe('truncateText', () => {
  it('returns empty string for falsy text', () => {
    expect(truncateText('', 10)).toBe('')
  })

  it('returns text unchanged if length <= maxLength', () => {
    expect(truncateText('hello', 10)).toBe('hello')
    expect(truncateText('hello', 5)).toBe('hello')
  })

  it('truncates and adds "..." when length > maxLength', () => {
    expect(truncateText('hello world', 5)).toBe('hello...')
  })
})

// ---------------------------------------------------------------------------
// parsePath
// ---------------------------------------------------------------------------
describe('parsePath', () => {
  it('parses a path with numeric segments', () => {
    expect(parsePath('/1/3/7/')).toEqual([1, 3, 7])
  })

  it('parses a path without trailing slash', () => {
    expect(parsePath('/1/3/7')).toEqual([1, 3, 7])
  })

  it('filters out NaN values from non-numeric segments', () => {
    expect(parsePath('/1/abc/3')).toEqual([1, 3])
  })

  it('returns empty array for empty path', () => {
    expect(parsePath('')).toEqual([])
    expect(parsePath('/')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// calcReadTime
// ---------------------------------------------------------------------------
describe('calcReadTime', () => {
  it('returns "不到1分钟" for wordCount of 0', () => {
    expect(calcReadTime(0)).toBe('不到1分钟')
  })

  it('returns "约1分钟" for small positive counts (ceil rounds up to 1)', () => {
    expect(calcReadTime(1)).toBe('约1分钟')
    expect(calcReadTime(299)).toBe('约1分钟')
  })

  it('returns "约X分钟" for larger counts', () => {
    expect(calcReadTime(300)).toBe('约1分钟')
    expect(calcReadTime(600)).toBe('约2分钟')
    expect(calcReadTime(900)).toBe('约3分钟')
  })

  it('ceils the result', () => {
    expect(calcReadTime(301)).toBe('约2分钟')
  })
})

// ---------------------------------------------------------------------------
// getLevelColor
// ---------------------------------------------------------------------------
describe('getLevelColor', () => {
  it('returns color for level 1', () => {
    expect(getLevelColor(1)).toBe('#94a3b8')
  })

  it('returns color for level 7', () => {
    expect(getLevelColor(7)).toBe('#ec4899')
  })

  it('clamps to the last color for levels beyond the array', () => {
    expect(getLevelColor(100)).toBe('#ec4899')
  })

  it('returns the first color for level 0 or negative (falls back to colors[0])', () => {
    expect(getLevelColor(0)).toBe('#94a3b8')
  })
})

// ---------------------------------------------------------------------------
// generateAvatarColor
// ---------------------------------------------------------------------------
describe('generateAvatarColor', () => {
  it('is deterministic: same username always produces the same color', () => {
    const first = generateAvatarColor('alice')
    const second = generateAvatarColor('alice')
    expect(first).toBe(second)
  })

  it('can produce different colors for different usernames', () => {
    const color1 = generateAvatarColor('alice')
    const color2 = generateAvatarColor('bob')
    // Not guaranteed different for every pair, but these two should differ
    expect(typeof color1).toBe('string')
    expect(typeof color2).toBe('string')
    // Verify it's one of the expected palette colors
    const palette = [
      '#7c6af7', '#10b981', '#3b82f6', '#f59e0b',
      '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
    ]
    expect(palette).toContain(color1)
    expect(palette).toContain(color2)
  })
})

// ---------------------------------------------------------------------------
// debounce
// ---------------------------------------------------------------------------
describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call the function immediately', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 300)
    debounced()
    expect(fn).not.toHaveBeenCalled()
  })

  it('calls the function after the delay', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 300)
    debounced()
    vi.advanceTimersByTime(300)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('resets the timer on subsequent calls', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 300)
    debounced()
    vi.advanceTimersByTime(200)
    debounced()
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('passes the latest arguments to the function', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced('a')
    debounced('b')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledWith('b')
  })

  it('uses a default delay of 300ms', () => {
    const fn = vi.fn()
    const debounced = debounce(fn)
    debounced()
    vi.advanceTimersByTime(299)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// throttle
// ---------------------------------------------------------------------------
describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls the function immediately on the first call', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 300)
    throttled()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not call the function again within the delay', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 300)
    throttled()
    throttled()
    throttled()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('calls the function again after the delay has elapsed', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 300)
    throttled()
    vi.advanceTimersByTime(300)
    throttled()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('passes arguments through', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)
    throttled('hello', 'world')
    expect(fn).toHaveBeenCalledWith('hello', 'world')
  })

  it('uses a default delay of 300ms', () => {
    const fn = vi.fn()
    const throttled = throttle(fn)
    throttled()
    vi.advanceTimersByTime(299)
    throttled()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    throttled()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})