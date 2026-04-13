/**
 * HTTP 请求封装
 * 基于 uni.request，支持拦截器、错误处理、Token 自动注入
 */

import { useUserStore } from '@/store/user'

// API 基础地址（生产环境替换为实际域名）
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://your-domain.com'

// 请求配置类型
interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  data?: Record<string, unknown> | string
  header?: Record<string, string>
  timeout?: number
  showLoading?: boolean
  showError?: boolean
}

// 响应类型
interface ApiResponse<T = unknown> {
  data: T
  code?: number
  message?: string
}

// 请求队列（防止 token 刷新时并发请求）
let isRefreshing = false
const pendingRequests: Array<() => void> = []

/**
 * 核心请求函数
 */
function request<T = unknown>(options: RequestOptions): Promise<T> {
  const {
    url,
    method = 'GET',
    data,
    header = {},
    timeout = 30000,
    showLoading = false,
    showError = true,
  } = options

  // 从 store 获取 token
  const userStore = useUserStore()
  const token = userStore.token

  // 构建请求头
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...header,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (showLoading) {
    uni.showLoading({ title: '加载中...', mask: true })
  }

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: headers,
      timeout,
      success: (res) => {
        if (showLoading) uni.hideLoading()

        const statusCode = res.statusCode

        if (statusCode === 200 || statusCode === 201) {
          resolve(res.data as T)
          return
        }

        // 401 未授权 - 清除登录状态并跳转登录页
        if (statusCode === 401) {
          const respData = res.data as ApiResponse & { code?: string }
          const isKicked = respData?.code === 'TOKEN_REPLACED'
          userStore.logout()
          uni.showModal({
            title: isKicked ? '账号已在其他设备登录' : '登录已过期',
            content: isKicked
              ? '你的账号已在其他设备登录，当前设备已退出。如非本人操作，请修改密码。'
              : '登录状态已过期，请重新登录',
            showCancel: false,
            confirmText: '重新登录',
            success: () => {
              uni.reLaunch({ url: '/pages/auth/login/index' })
            }
          })
          reject(new Error(isKicked ? '账号已在其他设备登录' : '登录已过期，请重新登录'))
          return
        }

        // 其他错误
        const errMsg = (res.data as ApiResponse)?.message || `请求失败 (${statusCode})`
        if (showError) {
          uni.showToast({ title: errMsg, icon: 'none', duration: 2000 })
        }
        reject(new Error(errMsg))
      },
      fail: (err) => {
        if (showLoading) uni.hideLoading()
        const errMsg = err.errMsg || '网络请求失败，请检查网络连接'
        if (showError) {
          uni.showToast({ title: errMsg, icon: 'none', duration: 2000 })
        }
        reject(new Error(errMsg))
      },
    })
  })
}

/**
 * 文件上传
 */
function uploadFile(options: {
  url: string
  filePath: string
  name?: string
  formData?: Record<string, string>
}): Promise<{ url: string }> {
  const userStore = useUserStore()
  const token = userStore.token

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${BASE_URL}${options.url}`,
      filePath: options.filePath,
      name: options.name || 'file',
      formData: options.formData,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const data = JSON.parse(res.data)
          resolve(data)
        } catch {
          reject(new Error('上传响应解析失败'))
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '上传失败'))
      },
    })
  })
}

// 导出便捷方法
export const http = {
  get<T = unknown>(url: string, data?: Record<string, unknown>, options?: Partial<RequestOptions>) {
    return request<T>({ url, method: 'GET', data, ...options })
  },
  post<T = unknown>(url: string, data?: Record<string, unknown>, options?: Partial<RequestOptions>) {
    return request<T>({ url, method: 'POST', data, ...options })
  },
  put<T = unknown>(url: string, data?: Record<string, unknown>, options?: Partial<RequestOptions>) {
    return request<T>({ url, method: 'PUT', data, ...options })
  },
  delete<T = unknown>(url: string, data?: Record<string, unknown>, options?: Partial<RequestOptions>) {
    return request<T>({ url, method: 'DELETE', data, ...options })
  },
  upload: uploadFile,
}

export default http

