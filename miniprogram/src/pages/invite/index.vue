<template>
  <view class="invite-page">
    <!-- 头部邀请卡片 -->
    <view class="hero-card">
      <view class="hero-bg" />
      <view class="hero-content">
        <text class="hero-title">邀请好友</text>
        <text class="hero-sub">每成功邀请 1 位好友注册</text>
        <view class="reward-badge">
          <text class="reward-icon">🎁</text>
          <text class="reward-text">双方各得 <text class="reward-num">{{ inviteBonus }}</text> 积分</text>
        </view>
      </view>

      <!-- 邀请码展示 -->
      <view class="code-section">
        <text class="code-label">我的邀请码</text>
        <view class="code-box" @tap="copyCode">
          <text v-if="loading" class="code-text code-loading">加载中...</text>
          <text v-else-if="myCode" class="code-text">{{ myCode }}</text>
          <text v-else class="code-text code-empty">暂无邀请码</text>
          <text v-if="myCode" class="copy-btn">复制</text>
        </view>
      </view>
    </view>

    <!-- 分享方式 -->
    <view class="share-section">
      <text class="section-title">分享方式</text>
      <view class="share-grid">
        <view class="share-item" @tap="shareToFriend">
          <view class="share-icon-wrap green">
            <text class="share-icon">💬</text>
          </view>
          <text class="share-label">发给好友</text>
        </view>
        <view class="share-item" @tap="shareToMoments">
          <view class="share-icon-wrap blue">
            <text class="share-icon">🌐</text>
          </view>
          <text class="share-label">分享朋友圈</text>
        </view>
        <view class="share-item" @tap="copyInviteLink">
          <view class="share-icon-wrap purple">
            <text class="share-icon">🔗</text>
          </view>
          <text class="share-label">复制链接</text>
        </view>
        <view class="share-item" @tap="showQrCode">
          <view class="share-icon-wrap orange">
            <text class="share-icon">📱</text>
          </view>
          <text class="share-label">小程序码</text>
        </view>
      </view>
    </view>

    <!-- 邀请记录 -->
    <view class="records-section">
      <text class="section-title">邀请记录</text>

      <view v-if="loading" class="loading-state">
        <text class="loading-text">加载中...</text>
      </view>

      <view v-else-if="records.length === 0" class="empty-state">
        <text class="empty-icon">👥</text>
        <text class="empty-text">还没有邀请记录</text>
        <text class="empty-sub">快去邀请好友吧！</text>
      </view>

      <view v-else class="records-list">
        <view v-for="record in records" :key="record.id" class="record-item">
          <image
            class="invitee-avatar"
            :src="getImageUrl(record.invitee?.avatar) || '/static/images/default-avatar.svg'"
            mode="aspectFill"
          />
          <view class="record-info">
            <text class="invitee-name">{{ record.invitee?.username }}</text>
            <text class="record-time">{{ formatTime(record.created_at) }}</text>
          </view>
          <view class="record-reward">
            <text class="reward-amount">+{{ record.bonus_points }}</text>
            <text class="reward-unit">积分</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 活动规则 -->
    <view class="rules-section">
      <text class="section-title">活动规则</text>
      <view class="rules-card">
        <view v-for="(rule, i) in rules" :key="i" class="rule-item">
          <text class="rule-num">{{ i + 1 }}</text>
          <text class="rule-text">{{ rule }}</text>
        </view>
      </view>
    </view>

    <!-- 小程序码弹窗 -->
    <view v-if="showQr" class="qr-modal" @tap.self="showQr = false">
      <view class="qr-box">
        <text class="qr-title">扫码加入 StoryTree</text>
        <view v-if="qrLoading" class="qr-loading">
          <text>生成中...</text>
        </view>
        <image
          v-else-if="qrBase64"
          class="qr-image"
          :src="qrBase64"
          mode="aspectFit"
        />
        <text class="qr-tip">长按识别小程序码</text>
        <view class="qr-close" @tap="showQr = false">
          <text>关闭</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { getMyInvitationCodes } from '@/api/users'
import { http, getImageUrl } from '@/utils/request'

const userStore = useUserStore()
const loading = ref(true)
const myCode = ref('')
const inviteBonus = ref(100)
const records = ref<any[]>([])
const showQr = ref(false)
const qrLoading = ref(false)
const qrBase64 = ref('')

const rules = [
  '每位用户拥有专属邀请码，可无限次分享',
  '好友使用邀请码注册成功后，双方各获得积分奖励',
  '积分奖励将在对方注册成功后立即到账',
  '积分可用于解锁付费章节，不可提现',
  '如发现刷单等违规行为，平台有权取消奖励并封号',
]

// 页面加载时开启右上角转发按钮（开发者工具不支持，跳过）
onLoad(() => {
  const { platform } = uni.getSystemInfoSync()
  if (platform === 'devtools') return
  try {
    uni.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
  } catch (e) { /* ignore */ }
})

// 定义分享内容（落地页为首页，邀请码通过 invite 参数传递，让新用户先体验内容再注册）
onShareAppMessage(() => ({
  title: '加入 StoryTree，一起创作故事！',
  path: myCode.value ? `/pages/index/index?invite=${myCode.value}` : '/pages/index/index',
}))

onMounted(async () => {
  if (!userStore.isLoggedIn) {
    uni.showModal({
      title: '提示',
      content: '请先登录后查看邀请信息',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({ url: '/pages/auth/login/index' })
        }
      }
    })
    return
  }
  await loadData()
})

async function loadData() {
  loading.value = true
  try {
    // 后端 GET /api/invitations/my-codes 同时返回 inviteRecords，无需单独请求
    const codesRes = await getMyInvitationCodes() as any
    
    if (codesRes.codes?.length > 0) {
      // 已有邀请码
      myCode.value = codesRes.codes[0].code
      inviteBonus.value = codesRes.codes[0].bonus_points || 100
    } else if (codesRes.canGenerate && codesRes.availableCount > 0) {
      // 没有邀请码但可以生成，自动生成一个
      try {
        const generateRes = await http.post<{ success: boolean; code: string }>('/api/invitations/generate')
        if (generateRes.success && generateRes.code) {
          myCode.value = generateRes.code
          inviteBonus.value = 100
        }
      } catch (e) {
        console.error('自动生成邀请码失败', e)
        myCode.value = ''
      }
    } else {
      // 没有邀请码且不满足生成条件
      myCode.value = ''
      // 显示提示
      uni.showToast({
        title: codesRes.generateReason || '暂未满足邀请码生成条件',
        icon: 'none',
        duration: 3000
      })
    }
    
    // inviteRecords 字段由后端在 my-codes 响应中直接返回
    records.value = codesRes.inviteRecords || []
  } catch (e) {
    console.error('加载邀请数据失败', e)
    myCode.value = ''
  } finally {
    loading.value = false
  }
}

function copyCode() {
  if (!myCode.value) return
  uni.setClipboardData({
    data: myCode.value,
    success: () => uni.showToast({ title: '邀请码已复制', icon: 'success' })
  })
}

function copyInviteLink() {
  const link = `https://storytree.online/register.html?invite=${myCode.value}`
  uni.setClipboardData({
    data: link,
    success: () => uni.showToast({ title: '邀请链接已复制', icon: 'success' })
  })
}

function shareToFriend() {
  uni.showToast({ title: '请点击右上角"..."分享', icon: 'none' })
}

function shareToMoments() {
  uni.showToast({ title: '请点击右上角分享', icon: 'none' })
}

async function showQrCode() {
  showQr.value = true
  if (qrBase64.value) return
  qrLoading.value = true
  try {
    const res = await http.post<{ base64: string }>('/api/shares/miniprogram-code', {
      page: 'pages/auth/register/index',
      scene: `invite=${myCode.value}`,
    })
    qrBase64.value = res.base64
  } catch (e) {
    uni.showToast({ title: '生成失败，请重试', icon: 'none' })
    showQr.value = false
  } finally {
    qrLoading.value = false
  }
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<style lang="scss">
.invite-page {
  min-height: 100vh;
  background: #f0f2f5;
  padding-bottom: 40rpx;
}

.hero-card {
  position: relative;
  padding: 50rpx 30rpx 40rpx;
  overflow: hidden;

  .hero-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #1a1a2e 0%, #7c6af7 100%);
  }

  .hero-content {
    position: relative;
    z-index: 1;
    margin-bottom: 30rpx;

    .hero-title {
      display: block;
      font-size: 44rpx;
      font-weight: 700;
      color: #fff;
      margin-bottom: 12rpx;
    }

    .hero-sub {
      display: block;
      font-size: 26rpx;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 20rpx;
    }

    .reward-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 30rpx;
      padding: 12rpx 24rpx;
      gap: 10rpx;

      .reward-icon { font-size: 32rpx; }

      .reward-text {
        font-size: 26rpx;
        color: #fff;

        .reward-num {
          font-size: 36rpx;
          font-weight: 700;
          color: #ffd700;
        }
      }
    }
  }

  .code-section {
    position: relative;
    z-index: 1;

    .code-label {
      display: block;
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 12rpx;
    }

    .code-box {
      display: flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 12rpx;
      padding: 20rpx 24rpx;

      .code-text {
        flex: 1;
        font-size: 40rpx;
        font-weight: 700;
        color: #fff;
        letter-spacing: 6rpx;

        &.code-loading {
          font-size: 28rpx;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.6);
          letter-spacing: 0;
        }

        &.code-empty {
          font-size: 28rpx;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.6);
          letter-spacing: 0;
        }
      }

      .copy-btn {
        font-size: 26rpx;
        color: #ffd700;
        padding: 8rpx 20rpx;
        border: 1rpx solid #ffd700;
        border-radius: 30rpx;
      }
    }
  }
}

.share-section,
.records-section,
.rules-section {
  padding: 30rpx 30rpx 0;

  .section-title {
    display: block;
    font-size: 28rpx;
    font-weight: 600;
    color: #666;
    margin-bottom: 16rpx;
  }
}

.share-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;

  .share-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;

    .share-icon-wrap {
      width: 100rpx;
      height: 100rpx;
      border-radius: 24rpx;
      display: flex;
      align-items: center;
      justify-content: center;

      &.green { background: #e8f5e9; }
      &.blue { background: #e3f2fd; }
      &.purple { background: #ede7f6; }
      &.orange { background: #fff3e0; }

      .share-icon { font-size: 44rpx; }
    }

    .share-label {
      font-size: 22rpx;
      color: #666;
    }
  }
}

.loading-state,
.empty-state {
  background: #fff;
  border-radius: 16rpx;
  padding: 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;

  .empty-icon { font-size: 80rpx; }
  .empty-text { font-size: 30rpx; color: #333; font-weight: 600; }
  .empty-sub { font-size: 26rpx; color: #999; }
  .loading-text { font-size: 26rpx; color: #999; }
}

.records-list {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;

  .record-item {
    display: flex;
    align-items: center;
    padding: 24rpx 30rpx;
    border-bottom: 1rpx solid #f5f5f5;

    &:last-child { border-bottom: none; }

    .invitee-avatar {
      width: 80rpx;
      height: 80rpx;
      border-radius: 50%;
      margin-right: 20rpx;
    }

    .record-info {
      flex: 1;

      .invitee-name {
        display: block;
        font-size: 28rpx;
        color: #333;
        font-weight: 600;
        margin-bottom: 6rpx;
      }

      .record-time {
        font-size: 22rpx;
        color: #999;
      }
    }

    .record-reward {
      text-align: right;

      .reward-amount {
        display: block;
        font-size: 32rpx;
        font-weight: 700;
        color: #7c6af7;
      }

      .reward-unit {
        font-size: 22rpx;
        color: #999;
      }
    }
  }
}

.rules-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 30rpx;

  .rule-item {
    display: flex;
    align-items: flex-start;
    padding: 16rpx 0;
    border-bottom: 1rpx solid #f5f5f5;
    gap: 16rpx;

    &:last-child { border-bottom: none; }

    .rule-num {
      width: 40rpx;
      height: 40rpx;
      background: #7c6af7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22rpx;
      color: #fff;
      font-weight: 700;
      flex-shrink: 0;
      line-height: 40rpx;
      text-align: center;
    }

    .rule-text {
      font-size: 26rpx;
      color: #555;
      line-height: 1.6;
      flex: 1;
    }
  }
}

.qr-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  .qr-box {
    background: #fff;
    border-radius: 24rpx;
    padding: 40rpx;
    width: 560rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20rpx;

    .qr-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #333;
    }

    .qr-loading {
      width: 280rpx;
      height: 280rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
    }

    .qr-image {
      width: 280rpx;
      height: 280rpx;
    }

    .qr-tip {
      font-size: 24rpx;
      color: #999;
    }

    .qr-close {
      padding: 16rpx 60rpx;
      background: #f5f5f5;
      border-radius: 30rpx;
      font-size: 28rpx;
      color: #666;
    }
  }
}
</style>

