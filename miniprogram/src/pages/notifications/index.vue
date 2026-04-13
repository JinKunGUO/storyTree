<template>
  <view class="notifications-page">
    <!-- 顶部操作栏 -->
    <view class="top-bar">
      <text class="top-title">消息通知</text>
      <text
        v-if="unreadCount > 0"
        class="read-all-btn"
        @tap="markAllRead"
      >
        全部已读
      </text>
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
          <text class="notif-arrow">›</text>
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

async function handleNotificationTap(item: Notification) {
  if (!item.is_read) {
    await markNotificationRead(item.id)
    item.is_read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    appStore.setUnreadCount(unreadCount.value)
  }

  if (item.link) {
    uni.navigateTo({ url: item.link })
  }
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

  .read-all-btn {
    font-size: 26rpx;
    color: #7c6af7;
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

    .notif-arrow {
      font-size: 36rpx;
      color: #cbd5e1;
      flex-shrink: 0;
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

