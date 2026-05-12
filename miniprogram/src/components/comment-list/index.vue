<template>
  <view class="comment-list">
    <!-- 评论输入区 -->
    <view v-if="showInput && userStore.isLoggedIn" class="input-row" @tap="$emit('input-tap')">
      <image
        class="user-avatar"
        :src="userStore.avatarUrl"
        mode="aspectFill"
      />
      <view class="input-placeholder">
        <text>说点什么...</text>
      </view>
    </view>

    <!-- 评论列表 -->
    <view class="list">
      <view
        v-for="comment in comments"
        :key="comment.id"
        class="comment-item"
      >
        <image
          class="comment-avatar"
          :src="comment.user.avatar || '/static/images/default-avatar.svg'"
          mode="aspectFill"
        />
        <view class="comment-body">
          <text class="comment-username">{{ comment.user.username }}</text>
          <text class="comment-text">{{ comment.content }}</text>
          <view class="comment-actions">
            <text class="comment-time">{{ formatTime(comment.created_at) }}</text>
            <view class="vote-btn" @tap="$emit('vote', comment.id, 'up')">
              <text>👍 {{ comment._count?.votes || 0 }}</text>
            </view>
            <text class="reply-btn" @tap="$emit('reply', comment.id, comment.user.username)">
              回复
            </text>
          </view>

          <!-- 回复列表 -->
          <view v-if="comment.replies && comment.replies.length > 0" class="replies">
            <view
              v-for="reply in comment.replies"
              :key="reply.id"
              class="reply-item"
            >
              <text class="reply-username">{{ reply.user.username }}</text>
              <text class="reply-text">{{ reply.content }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="comments.length === 0" class="empty-comments">
      <text class="empty-text">暂无评论，来说第一句话吧</text>
    </view>

    <!-- 加载更多 -->
    <view v-if="hasMore" class="load-more" @tap="$emit('load-more')">
      <text>查看更多评论</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useUserStore } from '@/store/user'
import { formatRelativeTime } from '@/utils/helpers'
import type { Comment } from '@/api/comments'

const userStore = useUserStore()

defineProps<{
  comments: Comment[]
  hasMore?: boolean
  showInput?: boolean
}>()

defineEmits<{
  (e: 'input-tap'): void
  (e: 'vote', commentId: number, type: 'up' | 'down'): void
  (e: 'reply', commentId: number, username: string): void
  (e: 'load-more'): void
}>()

function formatTime(date: string) {
  return formatRelativeTime(date)
}
</script>

<style lang="scss" scoped>
.comment-list {
  .input-row {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 16rpx 0 24rpx;

    .user-avatar {
      width: 64rpx;
      height: 64rpx;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .input-placeholder {
      flex: 1;
      background: #f8fafc;
      border-radius: 40rpx;
      padding: 18rpx 24rpx;

      text {
        font-size: 26rpx;
        color: #94a3b8;
      }
    }
  }

  .list {
    .comment-item {
      display: flex;
      gap: 16rpx;
      margin-bottom: 28rpx;

      .comment-avatar {
        width: 64rpx;
        height: 64rpx;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .comment-body {
        flex: 1;

        .comment-username {
          font-size: 24rpx;
          font-weight: 600;
          color: #475569;
          display: block;
          margin-bottom: 8rpx;
        }

        .comment-text {
          font-size: 26rpx;
          color: #1e293b;
          line-height: 1.6;
          display: block;
          margin-bottom: 10rpx;
        }

        .comment-actions {
          display: flex;
          align-items: center;
          gap: 20rpx;

          .comment-time {
            font-size: 22rpx;
            color: #94a3b8;
          }

          .vote-btn,
          .reply-btn {
            font-size: 22rpx;
            color: #94a3b8;
          }
        }

        .replies {
          margin-top: 16rpx;
          padding: 16rpx;
          background: #f8fafc;
          border-radius: 12rpx;

          .reply-item {
            margin-bottom: 10rpx;

            &:last-child {
              margin-bottom: 0;
            }

            .reply-username {
              font-size: 22rpx;
              font-weight: 600;
              color: #7c6af7;
              margin-right: 8rpx;
            }

            .reply-text {
              font-size: 24rpx;
              color: #475569;
            }
          }
        }
      }
    }
  }

  .empty-comments {
    text-align: center;
    padding: 40rpx 0;

    .empty-text {
      font-size: 24rpx;
      color: #94a3b8;
    }
  }

  .load-more {
    text-align: center;
    padding: 20rpx;

    text {
      font-size: 26rpx;
      color: #7c6af7;
    }
  }
}
</style>

