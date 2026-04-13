<template>
  <view class="about-page">
    <!-- 顶部 Logo 区域 -->
    <view class="hero-section">
      <image class="logo" src="/static/images/logo.png" mode="aspectFit" />
      <text class="app-name">StoryTree</text>
      <text class="app-version">版本 {{ version }}</text>
      <text class="app-slogan">协作式故事创作平台</text>
    </view>

    <!-- 功能介绍 -->
    <view class="section">
      <text class="section-title">关于我们</text>
      <view class="card">
        <text class="desc-text">
          StoryTree 是一个创新的协作式故事创作平台，让每位读者都能成为故事的共同创作者。
          通过独特的树状故事结构，用户可以在任意章节处延伸出新的故事分支，
          创造出无限可能的故事宇宙。
        </text>
      </view>
    </view>

    <!-- 核心功能 -->
    <view class="section">
      <text class="section-title">核心功能</text>
      <view class="features-grid">
        <view v-for="feat in features" :key="feat.icon" class="feature-item">
          <text class="feat-icon">{{ feat.icon }}</text>
          <text class="feat-name">{{ feat.name }}</text>
          <text class="feat-desc">{{ feat.desc }}</text>
        </view>
      </view>
    </view>

    <!-- 菜单列表 -->
    <view class="section">
      <text class="section-title">更多信息</text>
      <view class="menu-list">
        <view
          v-for="item in menuItems"
          :key="item.label"
          class="menu-item"
          @tap="handleMenu(item)"
        >
          <text class="menu-icon">{{ item.icon }}</text>
          <text class="menu-label">{{ item.label }}</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 底部版权 -->
    <view class="footer">
      <text class="footer-text">© 2024 StoryTree. All rights reserved.</text>
      <text class="footer-text">让每个人都能创作属于自己的故事</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const version = ref('1.0.0')

const features = [
  { icon: '🌳', name: '故事树', desc: '树状分支结构，无限故事可能' },
  { icon: '✍️', name: '协作创作', desc: '与读者共同延伸故事' },
  { icon: '✨', name: 'AI 助手', desc: 'AI 续写/润色/插图' },
  { icon: '💎', name: '积分系统', desc: '创作获得积分奖励' },
  { icon: '📅', name: '每日签到', desc: '坚持创作，积累奖励' },
  { icon: '👑', name: '会员特权', desc: '解锁更多创作权益' },
]

const menuItems = [
  { icon: '📋', label: '用户协议', path: '/pages/about/user-agreement' },
  { icon: '🔒', label: '隐私政策', path: '/pages/about/privacy' },
  { icon: '📧', label: '联系我们', action: 'contact' },
  { icon: '⭐', label: '给我们评分', action: 'rate' },
  { icon: '🔗', label: '分享给朋友', action: 'share' },
]

function handleMenu(item: any) {
  if (item.path) {
    uni.navigateTo({ url: item.path })
  } else if (item.action === 'contact') {
    uni.showModal({
      title: '联系我们',
      content: '邮箱：support@storytree.com\n微信：storytree_official',
      showCancel: false,
    })
  } else if (item.action === 'rate') {
    // 跳转到小程序评分（仅在真机有效）
    uni.showToast({ title: '感谢您的支持！', icon: 'success' })
  } else if (item.action === 'share') {
    uni.showShareMenu({ withShareTicket: true })
  }
}
</script>

<style lang="scss">
.about-page {
  min-height: 100vh;
  background: #f0f2f5;
  padding-bottom: 40rpx;
}

.hero-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 40rpx 40rpx;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);

  .logo {
    width: 120rpx;
    height: 120rpx;
    border-radius: 24rpx;
    margin-bottom: 20rpx;
  }

  .app-name {
    font-size: 40rpx;
    font-weight: 700;
    color: #fff;
    letter-spacing: 2rpx;
  }

  .app-version {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 8rpx;
  }

  .app-slogan {
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 16rpx;
  }
}

.section {
  padding: 32rpx 30rpx 0;

  .section-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #666;
    margin-bottom: 16rpx;
    display: block;
  }
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;

  .desc-text {
    font-size: 28rpx;
    color: #444;
    line-height: 1.8;
  }
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;

  .feature-item {
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx 16rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;

    .feat-icon {
      font-size: 44rpx;
      margin-bottom: 12rpx;
    }

    .feat-name {
      font-size: 24rpx;
      font-weight: 600;
      color: #333;
      margin-bottom: 8rpx;
    }

    .feat-desc {
      font-size: 20rpx;
      color: #999;
      line-height: 1.4;
    }
  }
}

.menu-list {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;

  .menu-item {
    display: flex;
    align-items: center;
    padding: 32rpx 30rpx;
    border-bottom: 1rpx solid #f5f5f5;

    &:last-child {
      border-bottom: none;
    }

    .menu-icon {
      font-size: 36rpx;
      margin-right: 20rpx;
    }

    .menu-label {
      flex: 1;
      font-size: 28rpx;
      color: #333;
    }

    .menu-arrow {
      font-size: 32rpx;
      color: #ccc;
    }
  }
}

.footer {
  padding: 40rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;

  .footer-text {
    font-size: 22rpx;
    color: #bbb;
  }
}
</style>

