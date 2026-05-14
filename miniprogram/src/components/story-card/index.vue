<template>
  <view class="story-card" @tap="$emit('tap', story.id)">
    <image
      class="cover"
      :src="getImageUrl(story.cover_image) || '/static/images/default-cover.jpg'"
      mode="aspectFill"
    />
    <view class="info">
      <text class="title">{{ story.title }}</text>
      <text class="desc">{{ story.description || '暂无简介' }}</text>
      <view class="meta">
        <view class="author">
          <image
            class="avatar"
            :src="story.author.avatar || '/static/images/default-avatar.png'"
            mode="aspectFill"
          />
          <text class="author-name">{{ story.author.username }}</text>
        </view>
        <view class="stats">
          <text class="stat">{{ story._count?.nodes || 0 }} 章</text>
          <text class="stat">{{ story._count?.followers || 0 }} 追更</text>
        </view>
      </view>
      <view v-if="story.tags" class="tags">
        <text
          v-for="tag in parseTags(story.tags).slice(0, 3)"
          :key="tag"
          class="tag"
        >
          {{ tag }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { Story } from '@/api/stories'
import { getImageUrl } from '@/utils/request'

defineProps<{
  story: Story
}>()

defineEmits<{
  (e: 'tap', id: number): void
}>()

function parseTags(raw: string): string[] {
  if (!raw || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((t: string) => String(t).trim()).filter(Boolean)
    }
  } catch {
    // 不是 JSON，尝试逗号分割
  }
  return raw.split(',').map((t: string) => t.trim()).filter(Boolean)
}
</script>

<style lang="scss" scoped>
.story-card {
  display: flex;
  gap: 20rpx;
  padding: 24rpx;
  background: #ffffff;
  border-radius: 20rpx;

  .cover {
    width: 160rpx;
    height: 120rpx;
    border-radius: 12rpx;
    flex-shrink: 0;
    background: #f0f2f5;
  }

  .info {
    flex: 1;
    overflow: hidden;

    .title {
      font-size: 28rpx;
      font-weight: 600;
      color: #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
      margin-bottom: 8rpx;
    }

    .desc {
      font-size: 24rpx;
      color: #64748b;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 12rpx;
    }

    .meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10rpx;

      .author {
        display: flex;
        align-items: center;
        gap: 8rpx;

        .avatar {
          width: 36rpx;
          height: 36rpx;
          border-radius: 50%;
        }

        .author-name {
          font-size: 22rpx;
          color: #94a3b8;
        }
      }

      .stats {
        display: flex;
        gap: 12rpx;

        .stat {
          font-size: 22rpx;
          color: #94a3b8;
        }
      }
    }

    .tags {
      display: flex;
      gap: 8rpx;
      flex-wrap: wrap;

      .tag {
        font-size: 20rpx;
        color: #7c6af7;
        background: rgba(124, 106, 247, 0.08);
        padding: 4rpx 12rpx;
        border-radius: 20rpx;
      }
    }
  }
}
</style>

