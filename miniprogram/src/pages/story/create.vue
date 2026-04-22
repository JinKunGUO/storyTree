<template>
  <view class="create-story-page" :style="{ '--status-bar-height': statusBarHeight + 'px' }">
    <!-- 顶部导航栏 -->
    <view class="toolbar">
      <view class="toolbar-left">
        <view class="back-btn" @tap="handleBack">
          <text class="back-icon">←</text>
        </view>
        <text class="toolbar-title">新建故事</text>
      </view>
    </view>

    <scroll-view scroll-y class="form-scroll">
      <!-- 封面上传 -->
      <view class="form-section">
        <text class="section-label">故事封面</text>
        <view class="cover-picker" @tap="pickCover">
          <image
            v-if="form.cover_image"
            class="cover-preview"
            :src="form.cover_image"
            mode="aspectFill"
          />
          <view v-else class="cover-placeholder">
            <text class="cover-icon">🖼</text>
            <text class="cover-hint">点击上传封面（可选）</text>
          </view>
        </view>
      </view>

      <!-- 故事标题 -->
      <view class="form-section">
        <text class="section-label">故事标题 <text class="required">*</text></text>
        <input
          v-model="form.title"
          class="form-input"
          placeholder="给你的故事起一个吸引人的名字"
          maxlength="50"
        />
        <text class="input-count">{{ form.title.length }}/50</text>
      </view>

      <!-- 故事简介 -->
      <view class="form-section">
        <text class="section-label">故事简介</text>
        <textarea
          v-model="form.description"
          class="form-textarea"
          placeholder="简单介绍一下这个故事（可选）"
          maxlength="500"
          :auto-height="true"
        />
        <text class="input-count">{{ form.description.length }}/500</text>
      </view>

      <!-- 故事标签 -->
      <view class="form-section">
        <text class="section-label">故事标签</text>
        <view class="tag-input-row">
          <input
            v-model="tagInput"
            class="tag-input"
            placeholder="输入标签后按回车添加"
            maxlength="10"
            @confirm="addTag"
          />
          <view class="tag-add-btn" @tap="addTag">
            <text>+ 添加</text>
          </view>
        </view>
        <view class="tag-list">
          <view
            v-for="(tag, i) in parsedTags"
            :key="i"
            class="tag-item"
          >
            <text class="tag-text">{{ tag }}</text>
            <text class="tag-remove" @tap="removeTag(i)">×</text>
          </view>
        </view>
        <text class="form-hint">最多 5 个标签，每个标签不超过 10 个字</text>
      </view>

      <!-- 设置 -->
      <view class="form-section">
        <text class="section-label">故事设置</text>

        <view class="setting-row">
          <view class="setting-info">
            <text class="setting-title">开放协作续写</text>
            <text class="setting-desc">允许其他创作者在你的章节后续写分支</text>
          </view>
          <switch
            :checked="form.allow_branch"
            color="#7c6af7"
            @change="form.allow_branch = ($event as any).detail.value"
          />
        </view>

        <view class="setting-row">
          <view class="setting-info">
            <text class="setting-title">允许评论</text>
            <text class="setting-desc">读者可以在章节下发表评论</text>
          </view>
          <switch
            :checked="form.allow_comment"
            color="#7c6af7"
            @change="form.allow_comment = ($event as any).detail.value"
          />
        </view>
      </view>

      <view class="bottom-placeholder" />
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="footer-bar">
      <button
        class="create-btn"
        :disabled="!canCreate || creating"
        :loading="creating"
        @tap="handleCreate"
      >
        {{ creating ? '创建中...' : '创建故事，开始写作 →' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createStory } from '@/api/stories'
import { http } from '@/utils/request'

const statusBarHeight = ref(0)

onLoad(() => {
  const info = uni.getSystemInfoSync()
  statusBarHeight.value = info.statusBarHeight || 0
})

const form = reactive({
  title: '',
  description: '',
  cover_image: '',
  allow_branch: true,
  allow_comment: true,
})

const tagInput = ref('')
const parsedTags = ref<string[]>([])
const creating = ref(false)

const canCreate = computed(() => form.title.trim().length > 0)

function addTag() {
  const t = tagInput.value.trim()
  if (!t) return
  if (parsedTags.value.length >= 5) {
    uni.showToast({ title: '最多添加 5 个标签', icon: 'none' })
    return
  }
  if (parsedTags.value.includes(t)) {
    uni.showToast({ title: '标签已存在', icon: 'none' })
    return
  }
  parsedTags.value.push(t)
  tagInput.value = ''
}

function removeTag(index: number) {
  parsedTags.value.splice(index, 1)
}

function pickCover() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempPath = res.tempFilePaths[0]
      uni.showLoading({ title: '上传中...' })
      try {
        const uploadRes = await http.upload({
          url: '/api/upload/image',
          filePath: tempPath,
          name: 'image',
        })
        form.cover_image = uploadRes.url
      } catch {
        uni.showToast({ title: '图片上传失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
  })
}

async function handleCreate() {
  if (!canCreate.value || creating.value) return
  creating.value = true
  try {
    const tagsJson = parsedTags.value.length > 0
      ? JSON.stringify(parsedTags.value)
      : undefined

    const res = await createStory({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      cover_image: form.cover_image || undefined,
      tags: tagsJson,
      allow_branch: form.allow_branch,
      allow_comment: form.allow_comment,
      visibility: 'public',
    })

    const story = res.story
    // 创建成功后直接进入写作编辑器写第一章
    uni.navigateTo({
      url: `/pages/write/editor?storyId=${story.id}&storyTitle=${encodeURIComponent(story.title)}`,
    })
  } catch (err: any) {
    uni.showToast({
      title: err?.message || '创建失败，请重试',
      icon: 'none',
    })
  } finally {
    creating.value = false
  }
}

function handleBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.create-story-page {
  min-height: 100vh;
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
}

.toolbar {
  position: sticky;
  top: 0;
  z-index: 100;
  padding-top: calc(var(--status-bar-height) * 1px);
  background: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 24rpx;
  padding-right: 24rpx;
  padding-bottom: 20rpx;
  min-height: 88rpx;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 16rpx;
  }

  .back-btn {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;

    .back-icon {
      color: #ffffff;
      font-size: 32rpx;
    }
  }

  .toolbar-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #ffffff;
  }
}

.form-scroll {
  flex: 1;
  padding-bottom: 160rpx;
}

.form-section {
  background: #ffffff;
  margin: 20rpx 24rpx 0;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);

  .section-label {
    font-size: 26rpx;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 16rpx;
    display: block;
    letter-spacing: 1rpx;

    .required {
      color: #ef4444;
      margin-left: 4rpx;
    }
  }
}

.cover-picker {
  width: 100%;
  height: 280rpx;
  border-radius: 16rpx;
  overflow: hidden;
  background: #f8fafc;
  border: 2rpx dashed #e2e8f0;

  .cover-preview {
    width: 100%;
    height: 100%;
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12rpx;

    .cover-icon {
      font-size: 56rpx;
    }

    .cover-hint {
      font-size: 24rpx;
      color: #94a3b8;
    }
  }
}

.form-input {
  width: 100%;
  height: 80rpx;
  font-size: 28rpx;
  color: #1e293b;
  border-bottom: 1rpx solid #e2e8f0;
  padding: 0;
  box-sizing: border-box;
}

.form-textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 28rpx;
  color: #1e293b;
  line-height: 1.6;
  padding: 0;
  box-sizing: border-box;
}

.input-count {
  display: block;
  text-align: right;
  font-size: 22rpx;
  color: #94a3b8;
  margin-top: 8rpx;
}

.tag-input-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;

  .tag-input {
    flex: 1;
    height: 72rpx;
    font-size: 26rpx;
    color: #1e293b;
    background: #f8fafc;
    border-radius: 12rpx;
    padding: 0 20rpx;
    box-sizing: border-box;
  }

  .tag-add-btn {
    height: 72rpx;
    padding: 0 24rpx;
    background: #7c6af7;
    border-radius: 12rpx;
    display: flex;
    align-items: center;

    text {
      font-size: 26rpx;
      color: #ffffff;
      font-weight: 500;
    }
  }
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 12rpx;

  .tag-item {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 8rpx 16rpx;
    background: rgba(124, 106, 247, 0.1);
    border-radius: 20rpx;

    .tag-text {
      font-size: 24rpx;
      color: #7c6af7;
    }

    .tag-remove {
      font-size: 28rpx;
      color: #7c6af7;
      line-height: 1;
    }
  }
}

.form-hint {
  font-size: 22rpx;
  color: #94a3b8;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f1f5f9;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .setting-info {
    flex: 1;
    margin-right: 24rpx;

    .setting-title {
      font-size: 28rpx;
      font-weight: 500;
      color: #1e293b;
      display: block;
      margin-bottom: 4rpx;
    }

    .setting-desc {
      font-size: 22rpx;
      color: #94a3b8;
      display: block;
    }
  }
}

.bottom-placeholder {
  height: 40rpx;
}

.footer-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  box-shadow: 0 -2rpx 16rpx rgba(0, 0, 0, 0.06);

  .create-btn {
    width: 100%;
    height: 96rpx;
    background: linear-gradient(135deg, #7c6af7, #a78bfa);
    color: #ffffff;
    font-size: 30rpx;
    font-weight: 600;
    border-radius: 24rpx;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;

    &[disabled] {
      opacity: 0.5;
    }
  }
}
</style>

