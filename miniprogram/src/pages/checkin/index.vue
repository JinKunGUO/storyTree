<template>
  <view class="checkin-page">
    <view class="header">
      <text class="header-title">每日签到</text>
      <text class="header-sub">连续签到 {{ status.consecutiveDays }} 天</text>
    </view>

    <scroll-view class="content" scroll-y>
      <!-- 签到卡片 -->
      <view class="checkin-card">
        <view class="streak-display">
          <text class="streak-num">{{ status.consecutiveDays }}</text>
          <text class="streak-label">连续签到天数</text>
        </view>

        <view class="points-preview">
          <text class="points-text">今日可获得</text>
          <text class="points-num">+{{ todayPoints }} 积分</text>
        </view>

        <button
          v-if="!status.hasCheckedIn"
          class="btn-checkin"
          :loading="loading"
          @tap="doCheckin"
        >
          {{ loading ? '签到中...' : '立即签到' }}
        </button>
        <view v-else class="checked-in">
          <text class="checked-icon">✓</text>
          <text class="checked-text">今日已签到</text>
        </view>
      </view>

      <!-- 本月签到日历 -->
      <view class="calendar-card">
        <text class="calendar-title">本月签到记录</text>
        <view class="calendar-grid">
          <view
            v-for="day in calendarDays"
            :key="day.date"
            class="calendar-day"
            :class="{
              checked: day.checked,
              today: day.isToday,
              'out-of-month': !day.inMonth,
            }"
          >
            <text class="day-num">{{ day.day }}</text>
            <text v-if="day.checked" class="day-check">✓</text>
          </view>
        </view>
      </view>

      <!-- 补签 -->
      <view v-if="status.makeupChances > 0" class="makeup-card">
        <view class="makeup-header">
          <text class="makeup-title">补签机会</text>
          <text class="makeup-count">剩余 {{ status.makeupChances }} 次</text>
        </view>
        <text class="makeup-desc">可以补签最近3天内漏签的日期</text>
        <view class="missed-days">
          <view
            v-for="day in missedDays"
            :key="day"
            class="missed-day-btn"
            @tap="doMakeup(day)"
          >
            {{ day }}
          </view>
        </view>
      </view>

      <!-- 积分规则 -->
      <view class="rules-card">
        <text class="rules-title">签到规则</text>
        <view class="rule-item">
          <text class="rule-dot">•</text>
          <text class="rule-text">每日签到可获得 10 积分</text>
        </view>
        <view class="rule-item">
          <text class="rule-dot">•</text>
          <text class="rule-text">连续签到 7 天，额外奖励 20 积分</text>
        </view>
        <view class="rule-item">
          <text class="rule-dot">•</text>
          <text class="rule-text">连续签到 30 天，额外奖励 100 积分</text>
        </view>
        <view class="rule-item">
          <text class="rule-dot">•</text>
          <text class="rule-text">每月可使用 3 次补签机会</text>
        </view>
      </view>

      <view class="bottom-placeholder" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { getCheckinStatus, doCheckin as apiCheckin, makeupCheckin } from '@/api/checkin'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const loading = ref(false)

const status = reactive({
  hasCheckedIn: false,
  consecutiveDays: 0,
  makeupChances: 0,
  todayPoints: 10,
  monthRecords: [] as any[],
})

const todayPoints = computed(() => {
  const days = status.consecutiveDays
  let base = 10
  if (days > 0 && (days + 1) % 7 === 0) base += 20
  if (days > 0 && (days + 1) % 30 === 0) base += 100
  return base
})

const calendarDays = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  const checkedDates = new Set(
    status.monthRecords.map(r => new Date(r.checkin_date).getDate())
  )

  const days = []
  // 填充前置空白
  for (let i = 0; i < firstDay; i++) {
    days.push({ day: '', date: `empty-${i}`, inMonth: false, checked: false, isToday: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      day: d,
      date: `${year}-${month + 1}-${d}`,
      inMonth: true,
      checked: checkedDates.has(d),
      isToday: d === now.getDate(),
    })
  }
  return days
})

const missedDays = computed(() => {
  const now = new Date()
  const checkedDates = new Set(
    status.monthRecords.map(r => {
      const d = new Date(r.checkin_date)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
  )
  const missed = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!checkedDates.has(key)) {
      missed.push(key)
    }
  }
  return missed
})

onMounted(async () => {
  await loadStatus()
})

async function loadStatus() {
  try {
    const res = await getCheckinStatus()
    Object.assign(status, res)
  } catch (err) {
    console.error('加载签到状态失败', err)
  }
}

async function doCheckin() {
  loading.value = true
  try {
    const res = await apiCheckin()
    status.hasCheckedIn = true
    status.consecutiveDays = res.consecutive_days
    userStore.updateUserInfo({ consecutive_days: res.consecutive_days, points: (userStore.userInfo?.points || 0) + res.points_earned })
    uni.showToast({ title: `签到成功！+${res.points_earned} 积分`, icon: 'success' })
    await loadStatus()
  } catch (err: any) {
    uni.showToast({ title: err.message || '签到失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function doMakeup(date: string) {
  try {
    await makeupCheckin(date)
    uni.showToast({ title: '补签成功', icon: 'success' })
    await loadStatus()
  } catch (err: any) {
    uni.showToast({ title: err.message || '补签失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.checkin-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.header {
  padding: 100rpx 32rpx 32rpx;
  text-align: center;

  .header-title {
    font-size: 44rpx;
    font-weight: 700;
    color: #ffffff;
    display: block;
  }

  .header-sub {
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 8rpx;
    display: block;
  }
}

.content {
  height: calc(100vh - 200rpx);
  padding: 0 24rpx;
}

.checkin-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 32rpx;
  padding: 40rpx;
  text-align: center;
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  margin-bottom: 24rpx;

  .streak-display {
    margin-bottom: 24rpx;

    .streak-num {
      font-size: 96rpx;
      font-weight: 900;
      color: #7c6af7;
      display: block;
      line-height: 1;
    }

    .streak-label {
      font-size: 26rpx;
      color: rgba(255, 255, 255, 0.6);
    }
  }

  .points-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12rpx;
    margin-bottom: 32rpx;

    .points-text {
      font-size: 26rpx;
      color: rgba(255, 255, 255, 0.6);
    }

    .points-num {
      font-size: 36rpx;
      font-weight: 700;
      color: #f59e0b;
    }
  }

  .btn-checkin {
    width: 100%;
    height: 96rpx;
    background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
    border-radius: 48rpx;
    font-size: 32rpx;
    color: #ffffff;
    font-weight: 700;
    border: none;
  }

  .checked-in {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12rpx;
    padding: 24rpx;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 48rpx;

    .checked-icon {
      font-size: 36rpx;
      color: #10b981;
    }

    .checked-text {
      font-size: 28rpx;
      color: #10b981;
      font-weight: 600;
    }
  }
}

.calendar-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.1);

  .calendar-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #ffffff;
    display: block;
    margin-bottom: 20rpx;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8rpx;

    .calendar-day {
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 12rpx;
      position: relative;

      &.out-of-month {
        opacity: 0;
      }

      &.today {
        border: 2rpx solid #7c6af7;
      }

      &.checked {
        background: rgba(124, 106, 247, 0.2);
      }

      .day-num {
        font-size: 22rpx;
        color: rgba(255, 255, 255, 0.7);
      }

      .day-check {
        font-size: 16rpx;
        color: #7c6af7;
      }
    }
  }
}

.makeup-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid rgba(245, 158, 11, 0.3);

  .makeup-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12rpx;

    .makeup-title {
      font-size: 28rpx;
      font-weight: 600;
      color: #f59e0b;
    }

    .makeup-count {
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.6);
    }
  }

  .makeup-desc {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.5);
    display: block;
    margin-bottom: 20rpx;
  }

  .missed-days {
    display: flex;
    gap: 16rpx;
    flex-wrap: wrap;

    .missed-day-btn {
      padding: 12rpx 24rpx;
      background: rgba(245, 158, 11, 0.15);
      border-radius: 20rpx;
      font-size: 24rpx;
      color: #f59e0b;
      border: 1rpx solid rgba(245, 158, 11, 0.3);
    }
  }
}

.rules-card {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;

  .rules-title {
    font-size: 26rpx;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    display: block;
    margin-bottom: 16rpx;
  }

  .rule-item {
    display: flex;
    gap: 12rpx;
    margin-bottom: 12rpx;

    .rule-dot {
      color: #7c6af7;
      font-size: 24rpx;
    }

    .rule-text {
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.5);
    }
  }
}

.bottom-placeholder {
  height: 60rpx;
}
</style>

