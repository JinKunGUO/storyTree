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
          v-if="status.canCheckin"
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
        <view class="calendar-header-row">
          <text class="calendar-title">本月签到记录</text>
          <text v-if="status.makeupChances > 0" class="makeup-hint">点击漏签日期可补签（剩余 {{ status.makeupChances }} 次）</text>
        </view>
        <view class="calendar-grid">
          <view
            v-for="day in calendarDays"
            :key="day.date"
            class="calendar-day"
            :class="{
              checked: day.checked,
              today: day.isToday,
              'out-of-month': !day.inMonth,
              missed: day.isMissed,
              'making-up': makeupLoading === day.date,
            }"
            @tap="day.isMissed ? doMakeup(day.date) : undefined"
          >
            <text class="day-num">{{ day.day }}</text>
            <text v-if="day.checked" class="day-check">✓</text>
            <text v-else-if="day.isMissed" class="day-makeup-icon">+</text>
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
import { getCheckinStatus, getCheckinHistory, doCheckin as apiCheckin, makeupCheckin } from '@/api/checkin'
import type { CheckinRecord } from '@/api/checkin'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const loading = ref(false)
const makeupLoading = ref<string | null>(null) // 当前正在补签的日期

// 签到状态（对齐后端 /api/checkin/status 实际字段）
const status = reactive({
  canCheckin: true,          // 今天是否可签到
  isMissed: false,           // 昨天是否漏签
  consecutiveDays: 0,
  makeupChances: 0,
  nextReward: 10,
  lastCheckinDate: null as string | null,
})

// 本月签到记录（来自 /api/checkin/history）
const monthRecords = ref<CheckinRecord[]>([])

// 今日可获得积分（来自 status.nextReward，已签到则展示上次奖励）
const todayPoints = computed(() => status.nextReward)

const calendarDays = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const todayNum = now.getDate()

  const checkedDates = new Set(
    monthRecords.value.map(r => {
      const d = new Date(r.checkin_date)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
  )

  // 计算最近7天内漏签且可补签的日期集合
  const missedSet = new Set<string>()
  if (status.makeupChances > 0) {
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!checkedDates.has(key)) {
        missedSet.add(key)
      }
    }
  }

  const days = []
  for (let i = 0; i < firstDay; i++) {
    days.push({ day: '', date: `empty-${i}`, inMonth: false, checked: false, isToday: false, isMissed: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({
      day: d,
      date: dateStr,
      inMonth: true,
      checked: checkedDates.has(dateStr),
      isToday: d === todayNum,
      isMissed: missedSet.has(dateStr),
    })
  }
  return days
})

onMounted(async () => {
  await loadAll()
})

async function loadAll() {
  await Promise.all([loadStatus(), loadHistory()])
}

async function loadStatus() {
  try {
    const res = await getCheckinStatus()
    status.canCheckin = res.canCheckin
    status.isMissed = res.isMissed
    status.consecutiveDays = res.consecutiveDays
    status.makeupChances = res.makeupChances
    status.nextReward = res.nextReward
    status.lastCheckinDate = res.lastCheckinDate
  } catch (err) {
    console.error('加载签到状态失败', err)
  }
}

async function loadHistory() {
  try {
    const now = new Date()
    const res = await getCheckinHistory(now.getFullYear(), now.getMonth() + 1)
    monthRecords.value = res.records
  } catch (err) {
    console.error('加载签到历史失败', err)
  }
}

async function doCheckin() {
  // 前端防重：已签到则不允许再次点击
  if (!status.canCheckin) {
    uni.showToast({ title: '今日已签到', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const res = await apiCheckin()
    const { pointsEarned, consecutiveDays, bonusPoints, milestoneMessage } = res.data
    status.canCheckin = false
    status.consecutiveDays = consecutiveDays
    // 同步 userStore
    userStore.updateUserInfo({
      consecutive_days: consecutiveDays,
      points: (userStore.userInfo?.points || 0) + pointsEarned + bonusPoints,
    })
    let toastMsg = `签到成功！+${pointsEarned} 积分`
    if (bonusPoints > 0) toastMsg += `\n🎉 ${milestoneMessage}+${bonusPoints}`
    uni.showToast({ title: toastMsg, icon: 'success', duration: 2500 })
    await loadAll()
  } catch (err: any) {
    uni.showToast({ title: err.message || '签到失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function doMakeup(date: string) {
  if (makeupLoading.value) return
  makeupLoading.value = date
  try {
    const res = await makeupCheckin(date)
    const { pointsEarned, remainingMakeupChances, newConsecutiveDays } = res.data
    status.makeupChances = remainingMakeupChances
    status.consecutiveDays = newConsecutiveDays
    userStore.updateUserInfo({
      consecutive_days: newConsecutiveDays,
      points: (userStore.userInfo?.points || 0) + pointsEarned,
    })
    uni.showToast({ title: `补签成功！+${pointsEarned} 积分`, icon: 'success' })
    await loadAll()
  } catch (err: any) {
    uni.showToast({ title: err.message || '补签失败', icon: 'none' })
  } finally {
    makeupLoading.value = null
  }
}
</script>

<style lang="scss" scoped>
.checkin-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  overflow-x: hidden;
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
  width: 100%;
  padding: 0 24rpx;
  box-sizing: border-box;
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
    line-height: 96rpx;
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

  .calendar-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;
    flex-wrap: wrap;
    gap: 8rpx;
  }

  .calendar-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #ffffff;
    display: block;
  }

  .makeup-hint {
    font-size: 22rpx;
    color: #f59e0b;
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

      // 可补签的漏签格子：琥珀色边框，点击态更明显
      &.missed {
        border: 2rpx dashed rgba(245, 158, 11, 0.6);
        background: rgba(245, 158, 11, 0.08);

        .day-num { color: #f59e0b; }
        .day-makeup-icon { font-size: 20rpx; color: #f59e0b; font-weight: 700; }
      }

      // 补签进行中
      &.making-up {
        opacity: 0.5;
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

