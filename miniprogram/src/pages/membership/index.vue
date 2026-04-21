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
      <!-- 内测免费公告 -->
      <view class="beta-notice">
        <text class="beta-icon">🎉</text>
        <view class="beta-text">
          <text class="beta-title">平台内测期间，所有会员功能限时免费开放！</text>
          <text class="beta-desc">无需付费即可享受全部会员权益。付费功能将在正式上线后开放，届时提前注册的用户将享有专属优惠。</text>
        </view>
      </view>

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
            <!-- 角标行：推荐 + 即将开放 -->
            <view class="plan-badges">
              <view v-if="plan.recommended" class="recommend-badge">
                <text>⭐ 推荐</text>
              </view>
              <view class="coming-soon-badge">
                <text>即将开放</text>
              </view>
            </view>
            <view class="plan-header">
              <text class="plan-name">{{ plan.name }}</text>
              <view class="plan-price-row">
                <text class="plan-price">¥{{ plan.price }}</text>
                <text class="plan-period">/{{ plan.period }}</text>
              </view>
            </view>
            <text v-if="plan.originalPrice" class="plan-original">原价 ¥{{ plan.originalPrice }}</text>
            <!-- AI 配额 -->
            <view class="plan-quota">
              <text class="quota-label">AI 配额</text>
              <text class="quota-value">{{ plan.quota }}</text>
            </view>
            <!-- 权益列表 -->
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
          <template v-for="benefit in benefitsList" :key="benefit.group || benefit.name">
            <!-- 分组标题行 -->
            <view v-if="benefit.group" class="benefit-group-row">
              <text class="benefit-group-label">{{ benefit.group }}</text>
            </view>
            <!-- 普通权益行 -->
            <view v-else class="benefit-row">
              <text class="benefit-name">{{ benefit.name }}</text>
              <text class="benefit-free">{{ benefit.free }}</text>
              <text class="benefit-member highlight">{{ benefit.member }}</text>
            </view>
          </template>
        </view>
      </view>

      <!-- 购买按钮 -->
      <view class="buy-section">
        <button class="btn-coming-soon" disabled>
          🕐 即将开放付费通道
        </button>
        <text class="buy-tips">内测期间免费使用，正式上线后开放付费</text>
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
    id: 'trial',
    name: '体验会员',
    price: 9.9,
    originalPrice: null,
    period: '7天',
    recommended: false,
    quota: 'Lv4 配额 × 1.2 倍（续写 60次/月）',
    features: [
      '会员徽章 (铜色)',
      'AI 响应速度优先',
      '去除广告',
    ],
  },
  {
    id: 'monthly',
    name: '月度会员',
    price: 39,
    originalPrice: null,
    period: '月',
    recommended: false,
    quota: 'Lv4 配额 × 1.5 倍（续写 75次/月）',
    features: [
      '会员徽章 (银色)',
      'AI 模型选择',
      '高级编辑器功能',
      '批量操作功能',
      '优先客服支持',
    ],
  },
  {
    id: 'quarterly',
    name: '季度会员',
    price: 99,
    originalPrice: null,
    period: '季',
    recommended: false,
    quota: 'Lv4 配额 × 1.8 倍（续写 90次/月）',
    features: [
      '月度会员全部特权',
      '导出功能 (PDF/EPUB/DOCX)',
      '数据分析报表',
      '粉丝画像分析',
    ],
  },
  {
    id: 'yearly',
    name: '年度会员',
    price: 388,
    originalPrice: null,
    period: '年',
    recommended: true,
    quota: '续写·润色·插图 全部无限次',
    features: [
      '季度会员全部特权',
      '会员徽章 (金色)',
      '版本历史功能',
      '敏感词审核优先通过',
      '专属客服通道',
      '每月赠送 500 积分',
    ],
  },
  {
    id: 'enterprise',
    name: '企业版/创作团队版',
    price: 999,
    originalPrice: null,
    period: '年',
    recommended: false,
    quota: '续写·润色·插图 全部无限次',
    features: [
      '年度会员全部特权',
      '会员徽章 (钻石)',
      '团队协作增强功能',
      '多账号管理面板',
      '品牌定制选项',
      '优先功能体验资格',
      '专属客服经理',
    ],
  },
]

const benefitsList = [
  // ── 基础 AI 配额（所有等级）──
  { group: 'AI 配额（全等级）' },
  { name: 'AI 续写次数', free: '按等级配额', member: '倍增/无限' },
  { name: 'AI 润色次数', free: '按等级配额', member: '无限次' },
  { name: 'AI 插图生成', free: '按等级配额', member: '倍增/无限' },
  // ── 体验会员 ──
  { group: '体验会员起' },
  { name: 'AI 响应加速', free: '✗', member: '体验+' },
  { name: '去除广告', free: '✗', member: '体验+' },
  { name: '会员徽章', free: '✗', member: '体验+' },
  // ── 月度会员 ──
  { group: '月度会员起' },
  { name: 'AI 模型选择', free: '✗', member: '月度+' },
  { name: '高级编辑器', free: '✗', member: '月度+' },
  { name: '批量操作', free: '✗', member: '月度+' },
  { name: '优先客服', free: '✗', member: '月度+' },
  // ── 季度会员 ──
  { group: '季度会员起' },
  { name: '导出 PDF/EPUB', free: '✗', member: '季度+' },
  { name: '数据分析报表', free: '✗', member: '季度+' },
  { name: '粉丝画像分析', free: '✗', member: '季度+' },
  // ── 年度会员 ──
  { group: '年度会员起' },
  { name: '版本历史', free: '✗', member: '年度+' },
  { name: '专属客服通道', free: '✗', member: '年度+' },
  { name: '每月赠积分', free: '✗', member: '年度 500分' },
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

.beta-notice {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin: 24rpx 24rpx 0;
  padding: 24rpx;
  background: linear-gradient(135deg, #fff8e1 0%, #fff3cd 100%);
  border: 2rpx solid #ffc107;
  border-radius: 20rpx;

  .beta-icon {
    font-size: 36rpx;
    flex-shrink: 0;
    margin-top: 2rpx;
  }

  .beta-text {
    display: flex;
    flex-direction: column;
    gap: 8rpx;

    .beta-title {
      font-size: 26rpx;
      font-weight: 700;
      color: #664d03;
      display: block;
    }

    .beta-desc {
      font-size: 22rpx;
      color: #856404;
      line-height: 1.6;
      display: block;
    }
  }
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
      display: inline-flex;
      align-items: center;
      background: #7c6af7;
      padding: 6rpx 16rpx;
      border-radius: 20rpx;

      text {
        font-size: 20rpx;
        color: #ffffff;
        font-weight: 600;
        line-height: 1;
      }
    }

    .coming-soon-badge {
      display: inline-flex;
      align-items: center;
      background: linear-gradient(135deg, #ff9800, #ffa726);
      padding: 6rpx 16rpx;
      border-radius: 20rpx;

      text {
        font-size: 20rpx;
        color: #ffffff;
        font-weight: 600;
        line-height: 1;
      }
    }

    .plan-badges {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12rpx;
      margin-bottom: 16rpx;
    }

    .plan-header {
      margin-bottom: 4rpx;
    }

    .plan-name {
      font-size: 28rpx;
      font-weight: 700;
      color: #1e293b;
      display: block;
      margin-bottom: 8rpx;
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
      margin-bottom: 16rpx;
    }

    .plan-quota {
      display: flex;
      align-items: center;
      gap: 12rpx;
      background: #f0f4ff;
      border-radius: 12rpx;
      padding: 12rpx 16rpx;
      margin: 12rpx 0 16rpx;

      .quota-label {
        font-size: 22rpx;
        color: #7c6af7;
        font-weight: 600;
        flex-shrink: 0;
        background: rgba(124, 106, 247, 0.12);
        padding: 4rpx 12rpx;
        border-radius: 8rpx;
      }

      .quota-value {
        font-size: 22rpx;
        color: #475569;
        line-height: 1.4;
      }
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

    .benefit-group-row {
      display: block;
      width: 100%;
      background: linear-gradient(90deg, #ede9fe 0%, #f5f3ff 100%);
      padding: 16rpx 24rpx;
      border-bottom: 1rpx solid #ddd6fe;
      border-top: 1rpx solid #ddd6fe;
      margin-top: 4rpx;

      .benefit-group-label {
        font-size: 24rpx;
        font-weight: 700;
        color: #6d28d9;
        letter-spacing: 0.5px;
        display: block;
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

  .btn-coming-soon {
    width: 100%;
    height: 96rpx;
    line-height: 96rpx;
    background: #e0e0e0;
    color: #999999;
    font-size: 30rpx;
    font-weight: 600;
    border-radius: 48rpx;
    border: none;
    margin-bottom: 16rpx;
    opacity: 0.85;
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

