<template>
  <view class="membership-page">
    <!-- 当前会员状态 -->
    <view class="current-status">
      <view class="status-bg" />
      <view class="status-content">
        <view class="user-avatar-wrap">
          <image
            class="user-avatar"
            :src="userStore.avatarUrl"
            mode="aspectFill"
          />
          <view v-if="userStore.isMember" class="member-crown">👑</view>
        </view>
        <text class="username">{{ userStore.userInfo?.username }}</text>
        <view class="current-tier">
          <text class="tier-name">{{ currentTierLabel }}</text>
          <text v-if="userStore.userInfo?.membership_expires_at" class="expire-date">
            到期：{{ formatExpireDate(userStore.userInfo.membership_expires_at) }}
          </text>
        </view>
      </view>
    </view>

    <scroll-view class="content-scroll" scroll-y>
      <!-- 会员套餐 -->
      <view class="plans-section">
        <text class="plans-title">选择会员套餐</text>

        <view class="plan-cards">
          <view
            v-for="plan in plans"
            :key="plan.id"
            class="plan-card"
            :class="{ recommended: plan.recommended, selected: selectedPlan === plan.id }"
            @tap="selectedPlan = plan.id"
          >
            <view v-if="plan.recommended" class="recommend-badge">推荐</view>
            <text class="plan-name">{{ plan.name }}</text>
            <view class="plan-price-row">
              <text class="plan-price">¥{{ plan.price }}</text>
              <text class="plan-period">/{{ plan.period }}</text>
            </view>
            <text v-if="plan.originalPrice" class="plan-original">原价 ¥{{ plan.originalPrice }}</text>
            <view class="plan-features">
              <view
                v-for="feature in plan.features"
                :key="feature"
                class="feature-item"
              >
                <text class="feature-check">✓</text>
                <text class="feature-text">{{ feature }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 权益对比 -->
      <view class="benefits-section">
        <text class="benefits-title">会员权益</text>
        <view class="benefits-table">
          <view class="benefit-row header-row">
            <text class="benefit-name">权益</text>
            <text class="benefit-free">免费</text>
            <text class="benefit-member">会员</text>
          </view>
          <view
            v-for="benefit in benefitsList"
            :key="benefit.name"
            class="benefit-row"
          >
            <text class="benefit-name">{{ benefit.name }}</text>
            <text class="benefit-free">{{ benefit.free }}</text>
            <text class="benefit-member highlight">{{ benefit.member }}</text>
          </view>
        </view>
      </view>

      <!-- 购买按钮 -->
      <view class="buy-section">
        <button class="btn-buy-member" @tap="handlePurchase">
          立即开通会员
        </button>
        <text class="buy-tips">支付即视为同意《会员服务协议》</text>
      </view>

      <view class="bottom-placeholder" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '@/store/user'
import { MEMBERSHIP_LABELS } from '@/utils/constants'

const userStore = useUserStore()

const selectedPlan = ref('monthly')

const currentTierLabel = computed(() => {
  const tier = userStore.userInfo?.membership_tier || 'free'
  return MEMBERSHIP_LABELS[tier] || '普通用户'
})

const plans = [
  {
    id: 'monthly',
    name: '月度会员',
    price: 12,
    originalPrice: null,
    period: '月',
    recommended: false,
    features: ['无限 AI 续写', '无限 AI 润色', '专属会员标识', '优先客服'],
  },
  {
    id: 'quarterly',
    name: '季度会员',
    price: 30,
    originalPrice: 36,
    period: '季',
    recommended: true,
    features: ['无限 AI 续写', '无限 AI 润色', '专属会员标识', '优先客服', '专属主题皮肤'],
  },
  {
    id: 'yearly',
    name: '年度会员',
    price: 98,
    originalPrice: 144,
    period: '年',
    recommended: false,
    features: ['无限 AI 续写', '无限 AI 润色', '专属会员标识', '优先客服', '专属主题皮肤', '每月 500 积分'],
  },
]

const benefitsList = [
  { name: 'AI 续写次数', free: '5次/月', member: '无限次' },
  { name: 'AI 润色次数', free: '3次/月', member: '无限次' },
  { name: 'AI 插图生成', free: '不支持', member: '20次/月' },
  { name: '草稿保存', free: '3篇', member: '无限' },
  { name: '专属皮肤', free: '✗', member: '✓' },
  { name: '优先客服', free: '✗', member: '✓' },
]

function formatExpireDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function handlePurchase() {
  uni.showToast({ title: '支付功能开发中', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.membership-page {
  min-height: 100vh;
  background: #f0f2f5;
}

.current-status {
  position: relative;
  background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%);
  padding: 100rpx 40rpx 48rpx;
  overflow: hidden;
  text-align: center;

  .status-bg {
    position: absolute;
    top: -80rpx;
    right: -80rpx;
    width: 400rpx;
    height: 400rpx;
    background: rgba(124, 106, 247, 0.15);
    border-radius: 50%;
  }

  .status-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;

    .user-avatar-wrap {
      position: relative;
      margin-bottom: 16rpx;

      .user-avatar {
        width: 120rpx;
        height: 120rpx;
        border-radius: 50%;
        border: 4rpx solid rgba(255, 255, 255, 0.3);
      }

      .member-crown {
        position: absolute;
        top: -16rpx;
        right: -8rpx;
        font-size: 36rpx;
      }
    }

    .username {
      font-size: 32rpx;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 12rpx;
    }

    .current-tier {
      .tier-name {
        font-size: 26rpx;
        color: #f59e0b;
        background: rgba(245, 158, 11, 0.15);
        padding: 8rpx 24rpx;
        border-radius: 20rpx;
        display: block;
        margin-bottom: 8rpx;
      }

      .expire-date {
        font-size: 22rpx;
        color: rgba(255, 255, 255, 0.5);
      }
    }
  }
}

.content-scroll {
  height: calc(100vh - 340rpx);
}

.plans-section {
  padding: 32rpx 24rpx 0;

  .plans-title {
    font-size: 30rpx;
    font-weight: 700;
    color: #1e293b;
    display: block;
    margin-bottom: 20rpx;
  }

  .plan-cards {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
  }

  .plan-card {
    position: relative;
    background: #ffffff;
    border-radius: 24rpx;
    padding: 28rpx;
    border: 2rpx solid #e2e8f0;

    &.recommended {
      border-color: #7c6af7;
    }

    &.selected {
      border-color: #7c6af7;
      background: rgba(124, 106, 247, 0.03);
    }

    .recommend-badge {
      position: absolute;
      top: -1rpx;
      right: 28rpx;
      background: #7c6af7;
      color: #ffffff;
      font-size: 20rpx;
      padding: 6rpx 16rpx;
      border-radius: 0 0 12rpx 12rpx;
    }

    .plan-name {
      font-size: 28rpx;
      font-weight: 700;
      color: #1e293b;
      display: block;
      margin-bottom: 12rpx;
    }

    .plan-price-row {
      display: flex;
      align-items: baseline;
      gap: 4rpx;
      margin-bottom: 4rpx;

      .plan-price {
        font-size: 56rpx;
        font-weight: 900;
        color: #7c6af7;
      }

      .plan-period {
        font-size: 24rpx;
        color: #94a3b8;
      }
    }

    .plan-original {
      font-size: 22rpx;
      color: #94a3b8;
      text-decoration: line-through;
      display: block;
      margin-bottom: 20rpx;
    }

    .plan-features {
      display: flex;
      flex-direction: column;
      gap: 10rpx;

      .feature-item {
        display: flex;
        align-items: center;
        gap: 10rpx;

        .feature-check {
          font-size: 22rpx;
          color: #10b981;
        }

        .feature-text {
          font-size: 24rpx;
          color: #475569;
        }
      }
    }
  }
}

.benefits-section {
  margin: 32rpx 24rpx 0;

  .benefits-title {
    font-size: 30rpx;
    font-weight: 700;
    color: #1e293b;
    display: block;
    margin-bottom: 16rpx;
  }

  .benefits-table {
    background: #ffffff;
    border-radius: 20rpx;
    overflow: hidden;

    .benefit-row {
      display: flex;
      align-items: center;
      padding: 20rpx 24rpx;
      border-bottom: 1rpx solid #f8fafc;

      &.header-row {
        background: #f8fafc;

        text {
          font-size: 24rpx;
          font-weight: 600;
          color: #94a3b8;
        }
      }

      .benefit-name {
        flex: 2;
        font-size: 26rpx;
        color: #1e293b;
      }

      .benefit-free {
        flex: 1;
        font-size: 24rpx;
        color: #94a3b8;
        text-align: center;
      }

      .benefit-member {
        flex: 1;
        font-size: 24rpx;
        color: #94a3b8;
        text-align: center;

        &.highlight {
          color: #7c6af7;
          font-weight: 600;
        }
      }
    }
  }
}

.buy-section {
  padding: 32rpx 24rpx;
  text-align: center;

  .btn-buy-member {
    width: 100%;
    height: 96rpx;
    line-height: 96rpx;
    background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
    color: #ffffff;
    font-size: 32rpx;
    font-weight: 700;
    border-radius: 48rpx;
    border: none;
    margin-bottom: 16rpx;
  }

  .buy-tips {
    font-size: 22rpx;
    color: #94a3b8;
  }
}

.bottom-placeholder {
  height: 60rpx;
}
</style>

