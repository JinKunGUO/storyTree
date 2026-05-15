<template>
  <view class="create-story-page">
    <!-- 页面主体：内容区域 + 底部固定栏 -->
    <scroll-view
      scroll-y
      class="main-scroll"
      :style="{
        paddingTop: navAndStatusBarHeight + 'px',
        paddingBottom: footerBarHeight + 'px'
      }"
    >
      <!-- AI 辅助创作入口 -->
      <view class="ai-creation-banner" @tap="goToAiCreate">
        <view class="ai-banner-content">
          <text class="ai-banner-icon">✨</text>
          <view class="ai-banner-text">
            <text class="ai-banner-title">试试 AI 辅助创作</text>
            <text class="ai-banner-desc">智能导入立项、AI 生成大纲，多种起始方式任你选</text>
          </view>
          <text class="ai-banner-arrow">›</text>
        </view>
      </view>

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

      <!-- 故事设置 -->
      <view class="form-section">
        <text class="section-label">故事设置</text>

        <view class="setting-row">
          <view class="setting-info">
            <text class="setting-title">默认公开可见</text>
            <text class="setting-desc">故事默认对所有人可见（读者视角）</text>
          </view>
          <switch
            :checked="form.visibility === 'public'"
            color="#7c6af7"
            @change="form.visibility = ($event as any).detail.value ? 'public' : 'private'"
          />
        </view>

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
    </scroll-view>

    <!-- 顶部导航栏（浮动在内容上方） -->
    <view class="navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="navbar-inner" :style="{ height: navInnerHeight + 'px' }">
        <view class="navbar-left">
          <view class="back-btn" @tap="handleBack">
            <text class="back-icon">←</text>
          </view>
          <text class="navbar-title">新建故事</text>
        </view>
      </view>
    </view>

    <!-- 底部操作栏（固定在底部） -->
    <view class="footer-bar" :style="{ height: footerBarHeight + 'px' }">
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
import { onLoad, onShow } from '@dcloudio/uni-app'
import { createStory } from '@/api/stories'
import { http } from '@/utils/request'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

// ===== 精确布局计算 =====
// 状态栏高度（系统给定）
const statusBarHeight = ref(20)
// 胶囊按钮信息
const menuButtonInfo = ref<any>(null)
// 导航栏内部高度 = 胶囊按钮高度 + 上下间距（固定 4px + 4px）
const navInnerHeight = ref(0)
// 总导航栏高度 = 状态栏 + 导航栏内部高度
const navAndStatusBarHeight = ref(0)
// 底部操作栏高度（固定值，与 CSS 同步）
const footerBarHeight = ref(80)

onLoad(() => {
  const info = uni.getSystemInfoSync()
  statusBarHeight.value = info.statusBarHeight || 20

  // 获取胶囊按钮信息
  const menu = uni.getMenuButtonBoundingClientRect()
  menuButtonInfo.value = menu

  // 导航栏内部高度 = 胶囊高度 + 上下间距（各 4px）
  const navInner = menu.height + 8
  navInnerHeight.value = navInner

  // 总高度 = 状态栏 + 导航栏内部
  navAndStatusBarHeight.value = statusBarHeight.value + navInner

  // 底部栏高度 = padding(20) + button(48) + safe-area(~20)
  // 固定值 88rpx 适配大部分设备
  footerBarHeight.value = 88

  // 加载时检查登录状态
  userStore.checkLoginStatus()
})

// 每次页面显示时检查登录状态
onShow(() => {
  userStore.checkLoginStatus()
})

const form = reactive({
  title: '',
  description: '',
  cover_image: '',
  visibility: 'public',
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
      visibility: form.visibility,
    })

    const story = res.story
    // 创建成功后直接进入写作编辑器写第一章
    uni.navigateTo({
      url: `/pkgWrite/pages/write/editor?storyId=${story.id}&storyTitle=${encodeURIComponent(story.title)}`,
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

function goToAiCreate() {
  uni.navigateTo({
    url: '/pkgStory/pages/story/create-ai',
  })
}
</script>

<style lang="scss" scoped>
.create-story-page {
  min-height: 100vh;
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ===== 顶部导航栏（固定在顶部）===== */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: #1a1a2e;

  .navbar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 24rpx;
    padding-right: calc(220rpx + 24rpx);
  }

  .navbar-left {
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

  .navbar-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #ffffff;
  }
}

/* ===== 主内容滚动区 ===== */
.main-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  /* padding-top 和 padding-bottom 通过内联样式动态设置 */
}

/* ===== 底部操作栏（固定在底部）===== */
.footer-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: #ffffff;
  box-shadow: 0 -2rpx 16rpx rgba(0, 0, 0, 0.06);
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;

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

.ai-creation-banner {
  margin: 20rpx 24rpx 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(102, 126, 234, 0.3);

  .ai-banner-content {
    display: flex;
    align-items: center;
    gap: 16rpx;
  }

  .ai-banner-icon {
    font-size: 48rpx;
    flex-shrink: 0;
  }

  .ai-banner-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
  }

  .ai-banner-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #ffffff;
  }

  .ai-banner-desc {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.85);
  }

  .ai-banner-arrow {
    font-size: 40rpx;
    color: rgba(255, 255, 255, 0.7);
  }
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

</style>

