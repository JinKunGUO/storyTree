<template>
  <view class="page">
    <!-- 骨架屏 -->
    <view v-if="loading" class="skeleton-list">
      <view v-for="i in 6" :key="i" class="skeleton-item">
        <view class="skeleton-avatar" />
        <view class="skeleton-info">
          <view class="skeleton-name" />
          <view class="skeleton-meta" />
        </view>
        <view class="skeleton-btn" />
      </view>
    </view>

    <scroll-view v-else class="scroll" scroll-y @scrolltolower="onLoadMore">
      <!-- 空状态 -->
      <view v-if="authors.length === 0" class="empty-state">
        <text class="empty-icon">✍️</text>
        <text class="empty-text">还没有关注的作者</text>
        <text class="empty-sub">去发现页找到喜欢的故事，关注作者获取最新动态</text>
        <button class="btn-discover" @tap="goDiscover">去发现</button>
      </view>

      <view v-else>
        <!-- 关注数量提示 -->
        <view class="count-bar">
          <text class="count-text">共关注了 {{ totalCount }} 位作者</text>
        </view>

        <view class="author-list">
          <view
            v-for="author in authors"
            :key="author.id"
            class="author-item"
            @tap="goProfile(author.id)"
          >
            <image
              class="author-avatar"
              :src="getImageUrl(author.avatar) || '/static/images/default-avatar.png'"
              mode="aspectFill"
            />
            <view class="author-info">
              <text class="author-name">{{ author.username }}</text>
              <view class="author-meta">
                <text class="meta-item">{{ author._count?.followers || 0 }} 粉丝</text>
                <text class="meta-dot">·</text>
                <text class="meta-item">{{ author._count?.authored_stories || 0 }} 故事</text>
              </view>
              <text v-if="author.bio" class="author-bio">{{ author.bio }}</text>
            </view>
            <view class="follow-btn" @tap.stop="toggleFollow(author)">
              <text class="follow-btn-text">已关注</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="loadingMore" class="loading-more">加载中...</view>
      <view v-if="noMore && authors.length > 0" class="no-more">没有更多了</view>
      <view class="bottom-placeholder" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { getImageUrl, http } from '@/utils/request'

const userStore = useUserStore()
const loading = ref(true)
const loadingMore = ref(false)
const noMore = ref(false)
const authors = ref<any[]>([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = 20

onMounted(() => {
  loadFollowing()
})

async function loadFollowing(reset = true) {
  if (reset) {
    loading.value = true
    page.value = 1
    noMore.value = false
  }
  try {
    const userId = userStore.userInfo?.id
    if (!userId) return
    const res = await http.get<{ following: any[] }>(
      `/api/users/${userId}/following`
    )
    const items = res.following || []
    if (reset) {
      authors.value = items
      totalCount.value = items.length
    } else {
      authors.value.push(...items)
    }
    noMore.value = items.length < pageSize
  } catch (err) {
    console.error('加载关注作者失败', err)
    authors.value = []
  } finally {
    loading.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  page.value++
  await loadFollowing(false)
  loadingMore.value = false
}

async function toggleFollow(author: any) {
  try {
    await http.delete(`/api/users/${author.id}/follow`)
    // 取消关注后从列表移除
    authors.value = authors.value.filter(a => a.id !== author.id)
    totalCount.value = Math.max(0, totalCount.value - 1)
    uni.showToast({ title: '已取消关注', icon: 'none' })
  } catch {
    uni.showToast({ title: '操作失败，请重试', icon: 'none' })
  }
}

function goProfile(userId: number) {
  uni.navigateTo({ url: `/pkgProfile/pages/profile/stories?userId=${userId}` })
}

function goDiscover() {
  uni.switchTab({ url: '/pages/discover/index' })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f0f2f5;
}

.scroll {
  height: 100vh;
}

/* 数量提示条 */
.count-bar {
  padding: 20rpx 32rpx 8rpx;

  .count-text {
    font-size: 24rpx;
    color: #94a3b8;
  }
}

/* 作者列表 */
.author-list {
  padding: 8rpx 24rpx 0;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.author-item {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;

  .author-avatar {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    flex-shrink: 0;
    background: #f0f2f5;
  }

  .author-info {
    flex: 1;
    min-width: 0;

    .author-name {
      font-size: 30rpx;
      font-weight: 700;
      color: #1e293b;
      display: block;
      margin-bottom: 8rpx;
    }

    .author-meta {
      display: flex;
      align-items: center;
      gap: 8rpx;
      margin-bottom: 8rpx;

      .meta-item {
        font-size: 22rpx;
        color: #94a3b8;
      }

      .meta-dot {
        font-size: 22rpx;
        color: #e2e8f0;
      }
    }

    .author-bio {
      font-size: 22rpx;
      color: #64748b;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .follow-btn {
    flex-shrink: 0;
    background: #f1f5f9;
    border: 1rpx solid #e2e8f0;
    border-radius: 32rpx;
    padding: 12rpx 28rpx;

    .follow-btn-text {
      font-size: 24rpx;
      color: #64748b;
      font-weight: 600;
    }
  }
}

/* 骨架屏 */
.skeleton-list {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.skeleton-item {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;

  .skeleton-avatar {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    flex-shrink: 0;
  }

  .skeleton-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12rpx;

    .skeleton-name {
      height: 30rpx;
      width: 160rpx;
      border-radius: 6rpx;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-meta {
      height: 22rpx;
      width: 240rpx;
      border-radius: 6rpx;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
  }

  .skeleton-btn {
    width: 100rpx;
    height: 52rpx;
    border-radius: 32rpx;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    flex-shrink: 0;
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 48rpx;

  .empty-icon {
    font-size: 100rpx;
    margin-bottom: 24rpx;
  }

  .empty-text {
    font-size: 32rpx;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 12rpx;
  }

  .empty-sub {
    font-size: 26rpx;
    color: #94a3b8;
    text-align: center;
    margin-bottom: 48rpx;
  }

  .btn-discover {
    background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
    color: #ffffff;
    padding: 20rpx 80rpx;
    border-radius: 40rpx;
    font-size: 30rpx;
    font-weight: 600;
    border: none;
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

