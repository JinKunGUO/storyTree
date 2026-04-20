<template>
  <view class="profile-page">
    <!-- 未登录状态 -->
    <view v-if="!userStore.isLoggedIn" class="guest-view">
      <view class="guest-hero">
        <text class="guest-icon">👤</text>
        <text class="guest-title">登录后查看个人主页</text>
        <text class="guest-sub">追踪创作进度，管理你的故事</text>
        <button class="btn-login" @tap="goLogin">立即登录</button>
      </view>
    </view>

    <template v-else>
      <!-- 用户信息头部 -->
      <view class="profile-header">
        <view class="header-bg" />
        <!-- 顶部操作栏：编辑 + 消息通知 -->
        <view class="header-top-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
          <text class="header-top-title">我的</text>
          <view class="header-top-actions">
            <view class="notif-btn" @tap="goNotifications">
              <text class="notif-icon-text">🔔</text>
              <view v-if="appStore.unreadCount > 0" class="notif-badge">
                <text class="notif-badge-text">{{ appStore.unreadCount > 99 ? '99+' : appStore.unreadCount }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="header-content">
          <image
            class="avatar"
            :src="userStore.avatarUrl"
            mode="aspectFill"
            @tap="changeAvatar"
          />
          <view class="user-info">
            <text class="username">{{ userStore.userInfo?.username }}</text>
            <text class="bio">{{ userStore.userInfo?.bio || '这个人很懒，什么都没写...' }}</text>
            <view class="badges-row">
              <view class="level-badge">
                <text>Lv.{{ userStore.userInfo?.level }}</text>
              </view>
              <view v-if="userStore.isMember" class="member-badge">
                <text>👑 {{ memberLabel }}</text>
              </view>
            </view>
          </view>
          <view class="edit-btn" @tap="goEditProfile">
            <text class="edit-icon">✏️</text>
          </view>
        </view>

        <!-- 统计数据 -->
        <view class="stats-row">
          <view class="stat-item">
            <text class="stat-num">{{ userStore.userInfo?.points || 0 }}</text>
            <text class="stat-label">积分</text>
          </view>
          <view class="stat-divider" />
          <view class="stat-item">
            <text class="stat-num">{{ userStore.userInfo?.word_count || 0 }}</text>
            <text class="stat-label">字数</text>
          </view>
          <view class="stat-divider" />
          <view class="stat-item">
            <text class="stat-num">{{ userStore.userInfo?.consecutive_days || 0 }}</text>
            <text class="stat-label">连续签到</text>
          </view>
        </view>
      </view>

      <!-- 功能菜单 -->
      <scroll-view class="content-scroll" scroll-y>
        <!-- 快捷操作 -->
        <view class="quick-section">
          <view class="quick-grid">
            <view class="quick-item" @tap="goCheckin">
              <text class="quick-icon">📅</text>
              <text class="quick-label">每日签到</text>
              <view v-if="!checkedIn" class="quick-badge">未签</view>
            </view>
            <view class="quick-item" @tap="goPoints">
              <text class="quick-icon">💎</text>
              <text class="quick-label">积分中心</text>
            </view>
            <view class="quick-item" @tap="goMembership">
              <text class="quick-icon">👑</text>
              <text class="quick-label">会员中心</text>
            </view>
          </view>
        </view>

        <!-- 我的创作 -->
        <view class="menu-section">
          <text class="menu-section-title">我的创作</text>
          <view class="menu-list">
            <view class="menu-item" @tap="goMyStories">
              <text class="menu-icon">📚</text>
              <text class="menu-label">我的故事</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @tap="goMyNodes">
              <text class="menu-icon">✍️</text>
              <text class="menu-label">我写的章节</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @tap="goBookmarks">
              <text class="menu-icon">🔖</text>
              <text class="menu-label">我的收藏</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @tap="goFollowing">
              <text class="menu-icon">❤️</text>
              <text class="menu-label">我的追更</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
        </view>

        <!-- 账号设置 -->
        <view class="menu-section">
          <text class="menu-section-title">账号设置</text>
          <view class="menu-list">
            <view class="menu-item" @tap="goEditProfile">
              <text class="menu-icon">👤</text>
              <text class="menu-label">编辑资料</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @tap="goChangePassword">
              <text class="menu-icon">🔒</text>
              <text class="menu-label">修改密码</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @tap="goNotificationSettings">
              <text class="menu-icon">🔔</text>
              <text class="menu-label">通知设置</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
        </view>

        <!-- 其他 -->
        <view class="menu-section">
          <text class="menu-section-title">其他</text>
          <view class="menu-list">
            <view class="menu-item" @tap="goInvite">
              <text class="menu-icon">🎁</text>
              <text class="menu-label">邀请好友</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @tap="goAbout">
              <text class="menu-icon">ℹ️</text>
              <text class="menu-label">关于 StoryTree</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @tap="goPrivacy">
              <text class="menu-icon">🔒</text>
              <text class="menu-label">隐私政策</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @tap="goUserAgreement">
              <text class="menu-icon">📋</text>
              <text class="menu-label">用户协议</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @tap="goClearCache">
              <text class="menu-icon">🗑️</text>
              <text class="menu-label">清除缓存</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
        </view>

        <!-- 退出登录 -->
        <view class="logout-section">
          <button class="btn-logout" @tap="handleLogout">退出登录</button>
        </view>

        <view class="bottom-placeholder" />
      </scroll-view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { useAppStore } from '@/store/app'
import { getCheckinStatus } from '@/api/checkin'
import { MEMBERSHIP_LABELS } from '@/utils/constants'
import { onShow } from '@dcloudio/uni-app'

const userStore = useUserStore()
const appStore = useAppStore()

const checkedIn = ref(false)
const statusBarHeight = ref(20)

const memberLabel = computed(() => {
  const tier = userStore.userInfo?.membership_tier || 'free'
  return MEMBERSHIP_LABELS[tier] || '普通用户'
})

onShow(() => {
  if (userStore.isLoggedIn) {
    checkCheckin()
  }
  // 获取状态栏高度
  try {
    const info = uni.getSystemInfoSync()
    statusBarHeight.value = info.statusBarHeight || 20
  } catch { /* ignore */ }
})

async function checkCheckin() {
  try {
    const res = await getCheckinStatus()
    checkedIn.value = !res.canCheckin
  } catch {
    // 忽略
  }
}

function goLogin() {
  uni.navigateTo({ url: '/pages/auth/login/index' })
}

function changeAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempPath = res.tempFilePaths[0]
      try {
        const { http } = await import('@/utils/request')
        const uploadRes = await http.upload({ url: '/api/upload/avatar', filePath: tempPath, name: 'avatar' })
        const { updateProfile } = await import('@/api/users')
        await updateProfile({ avatar: uploadRes.url })
        userStore.updateUserInfo({ avatar: uploadRes.url })
        uni.showToast({ title: '头像已更新', icon: 'success' })
      } catch {
        uni.showToast({ title: '头像上传失败', icon: 'none' })
      }
    },
  })
}

function goEditProfile() {
  uni.navigateTo({ url: '/pages/profile/edit' })
}

function goCheckin() {
  uni.navigateTo({ url: '/pages/checkin/index' })
}

function goPoints() {
  uni.navigateTo({ url: '/pages/points/index' })
}

function goMembership() {
  uni.navigateTo({ url: '/pages/membership/index' })
}

function goNotifications() {
  uni.navigateTo({ url: '/pages/notifications/index' })
}

function goMyStories() {
  uni.navigateTo({ url: `/pages/profile/stories?userId=${userStore.userInfo?.id}` })
}

function goMyNodes() {
  uni.navigateTo({ url: '/pages/profile/nodes' })
}

function goBookmarks() {
  uni.navigateTo({ url: '/pages/profile/bookmarks' })
}

function goFollowing() {
  uni.navigateTo({ url: '/pages/profile/following' })
}

function goChangePassword() {
  uni.showToast({ title: '请前往网页端修改密码', icon: 'none' })
}

function goNotificationSettings() {
  uni.showToast({ title: '功能开发中', icon: 'none' })
}

function goAbout() {
  uni.navigateTo({ url: '/pages/about/index' })
}

function goPrivacy() {
  uni.navigateTo({ url: '/pages/about/privacy' })
}

function goUserAgreement() {
  uni.navigateTo({ url: '/pages/about/user-agreement' })
}

function goInvite() {
  uni.navigateTo({ url: '/pages/invite/index' })
}

function goClearCache() {
  uni.showModal({
    title: '清除缓存',
    content: '确定要清除本地缓存吗？',
    success: (res) => {
      if (res.confirm) {
        uni.clearStorageSync()
        uni.showToast({ title: '缓存已清除', icon: 'success' })
      }
    },
  })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        uni.switchTab({ url: '/pages/index/index' })
      }
    },
  })
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: #f0f2f5;
}

.guest-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 40rpx;
}

.guest-hero {
  display: flex;
  flex-direction: column;
  align-items: center;

  .guest-icon {
    font-size: 120rpx;
    margin-bottom: 24rpx;
  }

  .guest-title {
    font-size: 36rpx;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 12rpx;
  }

  .guest-sub {
    font-size: 26rpx;
    color: #94a3b8;
    margin-bottom: 48rpx;
  }

  .btn-login {
    background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
    color: #ffffff;
    padding: 20rpx 80rpx;
    border-radius: 40rpx;
    font-size: 30rpx;
    font-weight: 600;
    border: none;
  }
}

.profile-header {
  position: relative;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding-bottom: 0;

  .header-bg {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 70% 30%, rgba(124, 106, 247, 0.3) 0%, transparent 60%);
    opacity: 0.6;
  }

  // 顶部操作栏：标题 + 消息通知按钮
  .header-top-bar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16rpx 32rpx 0;

    .header-top-title {
      font-size: 36rpx;
      font-weight: 700;
      color: #ffffff;
    }

    .header-top-actions {
      display: flex;
      align-items: center;
      gap: 16rpx;

      .notif-btn {
        position: relative;
        width: 72rpx;
        height: 72rpx;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;

        .notif-icon-text {
          font-size: 36rpx;
        }

        .notif-badge {
          position: absolute;
          top: 4rpx;
          right: 4rpx;
          min-width: 32rpx;
          height: 32rpx;
          background: #ef4444;
          border-radius: 16rpx;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 6rpx;
          border: 2rpx solid #1a1a2e;

          .notif-badge-text {
            font-size: 18rpx;
            color: #ffffff;
            font-weight: 600;
          }
        }
      }
    }
  }

  .header-content {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 24rpx;
    padding: 24rpx 32rpx 24rpx;

    .avatar {
      width: 120rpx;
      height: 120rpx;
      border-radius: 50%;
      border: 4rpx solid rgba(255, 255, 255, 0.3);
      flex-shrink: 0;
    }

    .user-info {
      flex: 1;
      padding-top: 8rpx;

      .username {
        font-size: 36rpx;
        font-weight: 700;
        color: #ffffff;
        display: block;
        margin-bottom: 8rpx;
      }

      .bio {
        font-size: 24rpx;
        color: rgba(255, 255, 255, 0.6);
        display: block;
        margin-bottom: 12rpx;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .badges-row {
        display: flex;
        gap: 12rpx;

        .level-badge {
          background: rgba(124, 106, 247, 0.4);
          padding: 6rpx 16rpx;
          border-radius: 20rpx;

          text {
            font-size: 22rpx;
            color: #a78bfa;
            font-weight: 600;
          }
        }

        .member-badge {
          background: rgba(245, 158, 11, 0.2);
          padding: 6rpx 16rpx;
          border-radius: 20rpx;

          text {
            font-size: 22rpx;
            color: #f59e0b;
          }
        }
      }
    }

    .edit-btn {
      width: 64rpx;
      height: 64rpx;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 8rpx;

      .edit-icon {
        font-size: 28rpx;
      }
    }
  }

  .stats-row {
    position: relative;
    display: flex;
    align-items: center;
    padding: 24rpx 32rpx;
    border-top: 1rpx solid rgba(255, 255, 255, 0.08);

    .stat-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;

      .stat-num {
        font-size: 36rpx;
        font-weight: 700;
        color: #ffffff;
      }

      .stat-label {
        font-size: 22rpx;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 4rpx;
      }
    }

    .stat-divider {
      width: 1rpx;
      height: 60rpx;
      background: rgba(255, 255, 255, 0.1);
    }
  }
}

.content-scroll {
  height: calc(100vh - 360rpx);
}

.quick-section {
  margin: 24rpx 24rpx 0;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 24rpx;

    .quick-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16rpx;

    .quick-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10rpx;
      padding: 16rpx 8rpx;

      .quick-icon {
        font-size: 44rpx;
      }

      .quick-label {
        font-size: 22rpx;
        color: #475569;
        text-align: center;
      }

      .quick-badge {
        position: absolute;
        top: 8rpx;
        right: 8rpx;
        background: #f59e0b;
        color: #ffffff;
        font-size: 18rpx;
        padding: 2rpx 8rpx;
        border-radius: 20rpx;

        &.red {
          background: #ef4444;
        }
      }
    }
  }
}

.menu-section {
  margin: 20rpx 24rpx 0;
  background: #ffffff;
  border-radius: 24rpx;
  overflow: hidden;

  .menu-section-title {
    font-size: 24rpx;
    color: #94a3b8;
    padding: 20rpx 28rpx 12rpx;
    display: block;
  }

  .menu-list {
    .menu-item {
      display: flex;
      align-items: center;
      gap: 20rpx;
      padding: 28rpx 28rpx;
      border-top: 1rpx solid #f8fafc;

      .menu-icon {
        font-size: 36rpx;
      }

      .menu-label {
        flex: 1;
        font-size: 28rpx;
        color: #1e293b;
      }

      .menu-arrow {
        font-size: 36rpx;
        color: #cbd5e1;
      }
    }
  }
}

.logout-section {
  margin: 32rpx 24rpx 0;

  .btn-logout {
    width: 100%;
    height: 96rpx;
    line-height: 96rpx;
    background: transparent;
    border: 2rpx solid #ef4444;
    border-radius: 16rpx;
    font-size: 30rpx;
    color: #ef4444;
    font-weight: 600;
  }
}

.bottom-placeholder {
  height: 60rpx;
}
</style>