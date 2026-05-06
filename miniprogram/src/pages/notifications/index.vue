<template>
  <view class="notifications-page">
    <!-- 顶部操作栏 -->
    <view class="top-bar">
      <text class="top-title">消息通知</text>
      <view class="top-actions">
        <text v-if="unreadCount > 0" class="unread-count-badge">{{ unreadCount > 99 ? '99+' : unreadCount }} 未读</text>
        <text class="read-all-btn" @tap="markAllRead">全部已读</text>
      </view>
    </view>

    <scroll-view
      class="list-scroll"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
    >
      <!-- 空状态 -->
      <view v-if="!loading && notifications.length === 0" class="empty-state">
        <text class="empty-icon">🔔</text>
        <text class="empty-text">暂无通知</text>
      </view>

      <!-- 通知列表 -->
      <view class="notifications-list">
        <view
          v-for="item in notifications"
          :key="item.id"
          class="notification-item"
          :class="{ unread: !item.is_read }"
          @tap="handleNotificationTap(item)"
        >
          <view class="notif-icon-wrap">
            <text class="notif-icon">{{ getNotifIcon(item.type) }}</text>
            <view v-if="!item.is_read" class="unread-dot" />
          </view>
          <view class="notif-content">
            <text class="notif-title">{{ item.title }}</text>
            <text class="notif-body">{{ item.content }}</text>
            <text class="notif-time">{{ formatTime(item.created_at) }}</text>
          </view>
          <view class="notif-right">
            <text
              v-if="!item.is_read"
              class="mark-read-btn"
              @tap.stop="markSingleRead(item)"
            >已读</text>
            <text v-else class="notif-arrow">›</text>
          </view>
        </view>
      </view>

      <view v-if="loadingMore" class="loading-more">加载中...</view>
      <view v-if="noMore && notifications.length > 0" class="no-more">没有更多了</view>

      <view class="bottom-placeholder" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/store/app'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/api/users'
import { formatRelativeTime } from '@/utils/helpers'
import type { Notification } from '@/api/users'

const appStore = useAppStore()

const loading = ref(false)
const refreshing = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const notifications = ref<Notification[]>([])
const page = ref(1)
const unreadCount = ref(0)

onMounted(() => {
  loadNotifications()
})

async function loadNotifications(reset = true) {
  if (reset) {
    loading.value = true
    page.value = 1
    noMore.value = false
  }
  try {
    const res = await getNotifications({ page: reset ? 1 : page.value, pageSize: 20 })
    if (reset) {
      notifications.value = res.notifications as Notification[]
    } else {
      notifications.value.push(...(res.notifications as Notification[]))
    }
    unreadCount.value = res.unreadCount
    appStore.setUnreadCount(res.unreadCount)
    noMore.value = res.notifications.length < 20
  } catch (err) {
    console.error('加载通知失败', err)
  } finally {
    loading.value = false
  }
}

async function onRefresh() {
  refreshing.value = true
  await loadNotifications(true)
  refreshing.value = false
}

async function loadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  page.value++
  await loadNotifications(false)
  loadingMore.value = false
}

async function markAllRead() {
  try {
    await markAllNotificationsRead()
    notifications.value.forEach(n => { n.is_read = true })
    unreadCount.value = 0
    appStore.setUnreadCount(0)
    uni.showToast({ title: '已全部标记已读', icon: 'success' })
  } catch (err: any) {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  }
}

async function markSingleRead(item: Notification) {
  if (item.is_read) return
  try {
    await markNotificationRead(item.id)
    item.is_read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    appStore.setUnreadCount(unreadCount.value)
  } catch (err: any) {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  }
}

async function handleNotificationTap(item: Notification) {
  if (!item.is_read) {
    await markNotificationRead(item.id)
    item.is_read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    appStore.setUnreadCount(unreadCount.value)
  }

  if (item.link) {
    const miniUrl = convertLinkToMiniUrl(item.link)
    if (miniUrl) {
      // tabBar 页面必须用 switchTab（新4 Tab：动态/发现/写作/我的）
      const tabBarPages = ['/pages/index/index', '/pages/discover/index', '/pages/write/index', '/pages/profile/index']
      if (tabBarPages.includes(miniUrl.split('?')[0])) {
        uni.switchTab({ url: miniUrl.split('?')[0] })
      } else {
        uni.navigateTo({ url: miniUrl })
      }
    }
  }
}

/**
 * 将后端存储的 Web 路由转换为小程序路由
 * 后端格式：
 *   /story.html?id=3&node=6#comment-12  → 跳转到章节页（chapter/index?id=6）
 *   /chapter?id=6                        → 章节页
 *   /node/6                              → 章节页（路径参数格式）
 *   /story?id=3                          → 故事详情页
 *   /profile                             → 个人主页
 *   /ai-tasks?id=123                     → AI任务（小程序跳转到个人中心）
 */
function convertLinkToMiniUrl(link: string): string | null {
  if (!link) return null

  // 去掉 hash 部分（如 #comment-12），小程序不支持 hash 定位
  const withoutHash = link.split('#')[0]
  // 解析路径和查询参数
  const [rawPath, query] = withoutHash.split('?')

  // 去掉 .html 后缀，统一处理（如 /story.html → /story, /profile.html → /profile）
  const path = rawPath.replace(/\.html$/, '')

  // 小程序环境不支持 URLSearchParams，手动解析 query string
  const qsMap: Record<string, string> = {}
  if (query) {
    query.split('&').forEach(pair => {
      const [k, v] = pair.split('=')
      if (k) qsMap[decodeURIComponent(k)] = decodeURIComponent(v || '')
    })
  }

  // 处理路径参数格式：/node/:id → 章节页
  const nodePathMatch = path.match(/^\/node\/(\d+)$/)
  if (nodePathMatch) {
    return `/pages/chapter/index?id=${nodePathMatch[1]}`
  }

  // 后端评论通知格式：/story.html?id=X&node=Y 或 /story?id=X&node=Y
  // node 参数就是 node_id（章节 id），直接跳章节页
  if (path === '/story') {
    const nodeId = qsMap['node']
    const storyId = qsMap['id']
    if (nodeId) {
      return `/pages/chapter/index?id=${nodeId}`
    }
    if (storyId) {
      return `/pages/story/index?id=${storyId}`
    }
    return null
  }

  // /chapter?id=X → 章节页
  if (path === '/chapter') {
    const chapterId = qsMap['id']
    if (chapterId) {
      return `/pages/chapter/index?id=${chapterId}`
    }
    return null
  }

  // /ai-tasks.html 或 /ai-tasks：小程序没有独立的 AI 任务页面
  // 跳转到个人中心，用户可以在写作中心查看草稿
  if (path === '/ai-tasks') {
    return '/pages/profile/index'
  }

  // 路由映射表
  const map: Record<string, string> = {
    '/story-settings':  '/pages/story/manage',
    '/profile':         '/pages/profile/index',
    '/checkin':         '/pages/checkin/index',
    '/points':          '/pages/points/index',
    '/membership':      '/pages/membership/index',
    '/notifications':   '/pages/notifications/index',
    '/write':           '/pages/write/index',
    '/create':          '/pages/create/index',
    '/discover':        '/pages/discover/index',
    '/invite':          '/pages/invite/index',
    '/search':          '/pages/search/index',
  }

  const miniPath = map[path]
  if (!miniPath) {
    console.log(`[通知跳转] 未知路由: ${link}`)
    return null
  }

  // 重新构建查询字符串
  const qs = query ? `?${query}` : ''
  return `${miniPath}${qs}`
}

function getNotifIcon(type: string) {
  const icons: Record<string, string> = {
    comment: '💬',
    reply: '↩️',
    follow: '👥',
    story_update: '📖',
    invitation_success: '🎉',
    system: '📢',
  }
  return icons[type] || '🔔'
}

function formatTime(date: string) {
  return formatRelativeTime(date)
}
</script>

<style lang="scss" scoped>
.notifications-page {
  min-height: 100vh;
  background: #f0f2f5;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 88rpx 32rpx 20rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #f0f2f5;

  .top-title {
    font-size: 36rpx;
    font-weight: 700;
    color: #1e293b;
  }

  .top-actions {
    display: flex;
    align-items: center;
    gap: 16rpx;

    .unread-count-badge {
      font-size: 22rpx;
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      padding: 4rpx 14rpx;
      border-radius: 20rpx;
    }

    .read-all-btn {
      font-size: 26rpx;
      color: #7c6af7;
    }
  }
}

.list-scroll {
  height: calc(100vh - 160rpx);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;

  .empty-icon {
    font-size: 100rpx;
    margin-bottom: 24rpx;
  }

  .empty-text {
    font-size: 28rpx;
    color: #94a3b8;
  }
}

.notifications-list {
  padding: 16rpx 0;

  .notification-item {
    display: flex;
    align-items: flex-start;
    gap: 20rpx;
    padding: 24rpx 32rpx;
    background: #ffffff;
    margin-bottom: 2rpx;

    &.unread {
      background: #fafbff;
    }

    .notif-icon-wrap {
      position: relative;
      width: 72rpx;
      height: 72rpx;
      background: #f0f2f5;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      .notif-icon {
        font-size: 36rpx;
      }

      .unread-dot {
        position: absolute;
        top: 0;
        right: 0;
        width: 16rpx;
        height: 16rpx;
        background: #ef4444;
        border-radius: 50%;
        border: 2rpx solid #ffffff;
      }
    }

    .notif-content {
      flex: 1;
      overflow: hidden;

      .notif-title {
        font-size: 28rpx;
        font-weight: 600;
        color: #1e293b;
        display: block;
        margin-bottom: 6rpx;
      }

      .notif-body {
        font-size: 24rpx;
        color: #64748b;
        display: block;
        margin-bottom: 8rpx;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .notif-time {
        font-size: 22rpx;
        color: #94a3b8;
      }
    }

    .notif-right {
      display: flex;
      align-items: center;
      flex-shrink: 0;

      .mark-read-btn {
        font-size: 22rpx;
        color: #7c6af7;
        background: rgba(124, 106, 247, 0.1);
        padding: 6rpx 16rpx;
        border-radius: 20rpx;
        white-space: nowrap;
      }

      .notif-arrow {
        font-size: 36rpx;
        color: #cbd5e1;
      }
    }
  }
}

.loading-more,
.no-more {
  text-align: center;
  padding: 32rpx;
  font-size: 24rpx;
  color: #94a3b8;
}

.bottom-placeholder {
  height: 60rpx;
}
</style>