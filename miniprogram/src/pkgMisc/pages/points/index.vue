<template>
  <view class="points-page">
    <!-- 积分余额卡片 -->
    <view class="balance-card">
      <view class="balance-bg" />
      <text class="balance-label">我的积分</text>
      <text class="balance-num">{{ userStore.userInfo?.points || 0 }}</text>
      <view class="balance-actions">
        <view class="balance-action" @tap="goCheckin">
          <text class="action-icon">📅</text>
          <text class="action-label">每日签到</text>
        </view>
        <view class="balance-divider" />
        <view class="balance-action" @tap="showBuyPoints = true">
          <text class="action-icon">💳</text>
          <text class="action-label">购买积分</text>
        </view>
      </view>
    </view>

    <!-- 积分明细 -->
    <view class="records-section">
      <view class="section-header">
        <text class="section-title">积分明细</text>
        <view class="filter-tabs">
          <text
            v-for="tab in filterTabs"
            :key="tab.value"
            class="filter-tab"
            :class="{ active: currentFilter === tab.value }"
            @tap="currentFilter = tab.value"
          >
            {{ tab.label }}
          </text>
        </view>
      </view>

      <scroll-view class="records-scroll" scroll-y @scrolltolower="loadMore">
        <view v-if="loading && records.length === 0" class="loading-state">
          <text>加载中...</text>
        </view>

        <view v-else-if="records.length === 0" class="empty-state">
          <text class="empty-icon">💎</text>
          <text class="empty-text">暂无积分记录</text>
        </view>

        <view class="records-list">
          <view
            v-for="record in filteredRecords"
            :key="record.id"
            class="record-item"
          >
            <view class="record-left">
              <text class="record-type-icon">{{ getTypeIcon(record.type) }}</text>
              <view class="record-info">
                <text class="record-desc">{{ record.description }}</text>
                <text class="record-time">{{ formatTime(record.created_at) }}</text>
              </view>
            </view>
            <text
              class="record-amount"
              :class="record.amount > 0 ? 'positive' : 'negative'"
            >
              {{ record.amount > 0 ? '+' : '' }}{{ record.amount }}
            </text>
          </view>
        </view>

        <view v-if="noMore && records.length > 0" class="no-more">没有更多记录</view>
        <view class="bottom-placeholder" />
      </scroll-view>
    </view>

    <!-- 购买积分弹窗 -->
    <view v-if="showBuyPoints" class="buy-mask" @tap.self="showBuyPoints = false">
      <view class="buy-panel" @tap.stop>
        <text class="buy-title">购买积分</text>
        <view class="buy-options">
          <view
            v-for="option in buyOptions"
            :key="option.points"
            class="buy-option"
            :class="{ selected: selectedOption === option.points, popular: option.popular }"
            @tap="selectedOption = option.points"
          >
            <view v-if="option.popular" class="buy-popular-badge">
              <text>热门推荐</text>
            </view>
            <text class="buy-name">{{ option.name }}</text>
            <text class="buy-points">{{ option.points }} 积分</text>
            <text class="buy-price">¥{{ option.price }}</text>
          </view>
        </view>
        <button class="btn-buy" @tap="handleBuy">立即购买</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { getPointTransactions } from '@/api/users'
import { formatRelativeTime } from '@/utils/helpers'
import { POINT_TYPES } from '@/utils/constants'
import type { PointTransaction } from '@/api/users'

const userStore = useUserStore()

const loading = ref(false)
const noMore = ref(false)
const showBuyPoints = ref(false)
const records = ref<PointTransaction[]>([])
const page = ref(1)
const currentFilter = ref('all')
const selectedOption = ref(100)

const filterTabs = [
  { label: '全部', value: 'all' },
  { label: '收入', value: 'income' },
  { label: '支出', value: 'expense' },
]

const buyOptions = [
  { points: 100, price: 9.9, bonus: 0, name: '小额套餐' },
  { points: 500, price: 45.0, bonus: 0, name: '中额套餐', popular: true },
  { points: 1000, price: 85.0, bonus: 0, name: '大额套餐' },
  { points: 2000, price: 160.0, bonus: 0, name: '超值套餐' },
]

const filteredRecords = computed(() => {
  if (currentFilter.value === 'income') return records.value.filter(r => r.amount > 0)
  if (currentFilter.value === 'expense') return records.value.filter(r => r.amount < 0)
  return records.value
})

onMounted(() => {
  loadRecords()
})

async function loadRecords(reset = true) {
  loading.value = true
  try {
    const res = await getPointTransactions({ page: reset ? 1 : page.value, pageSize: 20 })
    if (reset) {
      records.value = res.transactions
    } else {
      records.value.push(...res.transactions)
    }
    noMore.value = res.transactions.length < 20
  } catch (err) {
    console.error('加载积分记录失败', err)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || noMore.value) return
  page.value++
  await loadRecords(false)
}

function getTypeIcon(type: string) {
  const icons: Record<string, string> = {
    registration_bonus: '🎁',
    invitation_reward: '🤝',
    daily_checkin: '📅',
    makeup_checkin: '📅',
    story_follow: '❤️',
    node_bookmark: '🔖',
    purchase: '💳',
    consume: '💎',
  }
  return icons[type] || '💎'
}

function formatTime(date: string) {
  return formatRelativeTime(date)
}

function goCheckin() {
  uni.navigateTo({ url: '/pkgMisc/pages/checkin/index' })
}

function handleBuy() {
  uni.showToast({ title: '支付功能开发中', icon: 'none' })
  showBuyPoints.value = false
}
</script>

<style lang="scss" scoped>
.points-page {
  min-height: 100vh;
  background: #f0f2f5;
}

.balance-card {
  position: relative;
  background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
  padding: 100rpx 40rpx 40rpx;
  overflow: hidden;
  text-align: center;

  .balance-bg {
    position: absolute;
    top: -60rpx;
    right: -60rpx;
    width: 300rpx;
    height: 300rpx;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
  }

  .balance-label {
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.8);
    display: block;
    margin-bottom: 12rpx;
  }

  .balance-num {
    font-size: 80rpx;
    font-weight: 900;
    color: #ffffff;
    display: block;
    margin-bottom: 32rpx;
  }

  .balance-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 20rpx;
    padding: 20rpx 0;

    .balance-action {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8rpx;

      .action-icon {
        font-size: 36rpx;
      }

      .action-label {
        font-size: 24rpx;
        color: rgba(255, 255, 255, 0.9);
      }
    }

    .balance-divider {
      width: 1rpx;
      height: 60rpx;
      background: rgba(255, 255, 255, 0.3);
    }
  }
}

.records-section {
  margin: 24rpx 24rpx 0;

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16rpx;

    .section-title {
      font-size: 30rpx;
      font-weight: 700;
      color: #1e293b;
    }

    .filter-tabs {
      display: flex;
      gap: 8rpx;

      .filter-tab {
        padding: 8rpx 20rpx;
        border-radius: 20rpx;
        font-size: 24rpx;
        color: #94a3b8;

        &.active {
          background: rgba(124, 106, 247, 0.1);
          color: #7c6af7;
          font-weight: 600;
        }
      }
    }
  }
}

.records-scroll {
  height: calc(100vh - 500rpx);
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;

  .empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
  }

  .empty-text {
    font-size: 26rpx;
    color: #94a3b8;
  }
}

.records-list {
  .record-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx 28rpx;
    border-bottom: 1rpx solid #f8fafc;

    .record-left {
      display: flex;
      align-items: center;
      gap: 16rpx;

      .record-type-icon {
        font-size: 40rpx;
        width: 64rpx;
        text-align: center;
      }

      .record-info {
        .record-desc {
          font-size: 26rpx;
          color: #1e293b;
          display: block;
        }

        .record-time {
          font-size: 22rpx;
          color: #94a3b8;
          margin-top: 4rpx;
          display: block;
        }
      }
    }

    .record-amount {
      font-size: 30rpx;
      font-weight: 700;

      &.positive {
        color: #10b981;
      }

      &.negative {
        color: #ef4444;
      }
    }
  }
}

.no-more {
  text-align: center;
  padding: 32rpx;
  font-size: 24rpx;
  color: #94a3b8;
}

.bottom-placeholder {
  height: 60rpx;
}

.buy-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.buy-panel {
  width: 100%;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx 32rpx calc(40rpx + env(safe-area-inset-bottom));

  .buy-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #1e293b;
    text-align: center;
    display: block;
    margin-bottom: 32rpx;
  }

  .buy-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20rpx;
    margin-bottom: 32rpx;

    .buy-option {
      position: relative;
      padding: 24rpx;
      border: 2rpx solid #e2e8f0;
      border-radius: 20rpx;
      text-align: center;

      &.selected {
        border-color: #7c6af7;
        background: rgba(124, 106, 247, 0.06);
      }

      &.popular {
        border-color: #f59e0b;
      }

      .buy-popular-badge {
        position: absolute;
        top: -12rpx;
        right: -12rpx;
        background: linear-gradient(135deg, #f59e0b, #fbbf24);
        padding: 4rpx 14rpx;
        border-radius: 20rpx;

        text {
          font-size: 18rpx;
          color: #ffffff;
          font-weight: 600;
          line-height: 1;
        }
      }

      .buy-name {
        font-size: 22rpx;
        color: #94a3b8;
        display: block;
        margin-bottom: 8rpx;
      }

      .buy-points {
        font-size: 28rpx;
        font-weight: 700;
        color: #1e293b;
        display: block;
        margin-bottom: 8rpx;
      }

      .buy-price {
        font-size: 32rpx;
        font-weight: 900;
        color: #7c6af7;
        display: block;
      }

      .buy-bonus {
        position: absolute;
        top: -12rpx;
        right: -12rpx;
        background: #ef4444;
        padding: 4rpx 12rpx;
        border-radius: 20rpx;
        display: flex;
        align-items: center;
        justify-content: center;

        text {
          font-size: 18rpx;
          color: #ffffff;
          line-height: 1;
        }
      }
    }
  }

  .btn-buy {
    width: 100%;
    height: 96rpx;
    line-height: 96rpx;
    background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
    color: #ffffff;
    font-size: 30rpx;
    font-weight: 600;
    border-radius: 16rpx;
    border: none;
  }
}
</style>

