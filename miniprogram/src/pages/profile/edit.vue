<template>
  <view class="edit-page">
    <!-- 顶部导航 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-back" @tap="goBack">
        <text class="nav-back-icon">‹</text>
      </view>
      <text class="nav-title">编辑资料</text>
      <!-- 右侧占位，保持标题居中 -->
      <view class="nav-placeholder" />
    </view>

    <scroll-view class="content" scroll-y>
      <!-- 头像 -->
      <view class="avatar-section" @tap="changeAvatar">
        <image class="avatar" :src="avatarUrl" mode="aspectFill" />
        <view class="avatar-mask">
          <text class="avatar-mask-text">更换头像</text>
        </view>
      </view>

      <!-- 表单 -->
      <view class="form-section">
        <!-- 用户名 -->
        <view class="form-item">
          <text class="form-label">用户名</text>
          <view class="form-input-wrap">
            <input
              class="form-input"
              v-model="form.username"
              placeholder="请输入用户名"
              maxlength="20"
            />
            <text class="form-count">{{ form.username.length }}/20</text>
          </view>
          <text v-if="usernameError" class="form-error">{{ usernameError }}</text>
        </view>

        <!-- 个人简介 -->
        <view class="form-item">
          <text class="form-label">个人简介</text>
          <view class="form-input-wrap textarea-wrap">
            <textarea
              class="form-textarea"
              v-model="form.bio"
              placeholder="介绍一下自己吧..."
              maxlength="120"
              :auto-height="true"
            />
            <text class="form-count">{{ (form.bio || '').length }}/120</text>
          </view>
        </view>
      </view>

      <view class="bottom-placeholder" />
    </scroll-view>

    <!-- 底部保存按钮 -->
    <view v-if="dataReady" class="footer-bar">
      <button class="save-btn" :disabled="saving" @tap="handleSave">
        {{ saving ? '保存中...' : '保存修改' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { updateProfile } from '@/api/users'
import { http } from '@/utils/request'

const userStore = useUserStore()

const statusBarHeight = ref(20)
const saving = ref(false)
const usernameError = ref('')
const dataReady = ref(false)

const form = ref({
  username: '',
  bio: '',
})

const avatarUrl = computed(() => userStore.avatarUrl)

onLoad(() => {
  try {
    const info = uni.getSystemInfoSync()
    statusBarHeight.value = info.statusBarHeight || 20
  } catch { /* ignore */ }
  
  // 初始化表单数据
  initFormData()
})

function initFormData() {
  // 确保用户信息已加载
  if (userStore.userInfo) {
    form.value.username = userStore.userInfo.username || ''
    form.value.bio = userStore.userInfo.bio || ''
    dataReady.value = true
  } else {
    // 如果用户信息还未加载，等待一下再尝试
    setTimeout(() => {
      if (userStore.userInfo) {
        form.value.username = userStore.userInfo.username || ''
        form.value.bio = userStore.userInfo.bio || ''
      }
      dataReady.value = true
    }, 300)
  }
}

function goBack() {
  uni.navigateBack()
}

async function changeAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempPath = res.tempFilePaths[0]
      try {
        uni.showLoading({ title: '上传中...' })
        const uploadRes = await http.upload({ url: '/api/upload/avatar', filePath: tempPath, name: 'avatar' })
        await updateProfile({ avatar: uploadRes.url })
        userStore.updateUserInfo({ avatar: uploadRes.url })
        uni.hideLoading()
        uni.showToast({ title: '头像已更新', icon: 'success' })
      } catch {
        uni.hideLoading()
        uni.showToast({ title: '头像上传失败', icon: 'none' })
      }
    },
  })
}

async function handleSave() {
  if (saving.value) return

  usernameError.value = ''
  const username = form.value.username.trim()
  const bio = form.value.bio.trim()

  if (!username) {
    usernameError.value = '用户名不能为空'
    return
  }
  if (username.length < 2 || username.length > 20) {
    usernameError.value = '用户名长度为 2~20 个字符'
    return
  }

  saving.value = true
  try {
    // 用户名有变化才调用修改用户名接口
    if (username !== userStore.userInfo?.username) {
      await http.put('/api/users/username', { username })
      userStore.updateUserInfo({ username })
    }

    // bio 有变化才调用修改资料接口
    if (bio !== (userStore.userInfo?.bio || '')) {
      await updateProfile({ bio })
      userStore.updateUserInfo({ bio })
    }

    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
  } catch (err: any) {
    const msg = err?.data?.error || err?.message || '保存失败，请稍后重试'
    if (msg.includes('用户名')) {
      usernameError.value = msg
    } else {
      uni.showToast({ title: msg, icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.edit-page {
  min-height: 100vh;
  background: #f0f2f5;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx 16rpx;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);

  .nav-back {
    width: 72rpx;
    height: 72rpx;
    display: flex;
    align-items: center;
    justify-content: center;

    .nav-back-icon {
      font-size: 56rpx;
      color: #ffffff;
      line-height: 1;
      margin-top: -4rpx;
    }
  }

  .nav-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #ffffff;
  }

  .nav-placeholder {
    width: 72rpx;
    height: 72rpx;
  }
}

.content {
  height: calc(100vh - 220rpx);
}

.avatar-section {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx 0 40rpx;
  background: #ffffff;
  margin-bottom: 16rpx;

  .avatar {
    width: 160rpx;
    height: 160rpx;
    border-radius: 50%;
    border: 4rpx solid rgba(124, 106, 247, 0.3);
  }

  .avatar-mask {
    position: absolute;
    bottom: 40rpx;
    width: 160rpx;
    height: 56rpx;
    background: rgba(0, 0, 0, 0.45);
    border-radius: 0 0 80rpx 80rpx;
    display: flex;
    align-items: center;
    justify-content: center;

    .avatar-mask-text {
      font-size: 22rpx;
      color: #ffffff;
    }
  }
}

.form-section {
  background: #ffffff;
  border-radius: 24rpx;
  margin: 0 24rpx;
  overflow: hidden;

  .form-item {
    padding: 28rpx 28rpx 20rpx;
    border-bottom: 1rpx solid #f1f5f9;

    &:last-child {
      border-bottom: none;
    }

    .form-label {
      font-size: 24rpx;
      color: #94a3b8;
      display: block;
      margin-bottom: 12rpx;
    }

    .form-input-wrap {
      display: flex;
      align-items: center;
      gap: 12rpx;

      &.textarea-wrap {
        align-items: flex-end;
      }

      .form-input {
        flex: 1;
        font-size: 28rpx;
        color: #1e293b;
        height: 60rpx;
        line-height: 60rpx;
      }

      .form-textarea {
        flex: 1;
        font-size: 28rpx;
        color: #1e293b;
        min-height: 80rpx;
        line-height: 1.6;
      }

      .form-count {
        font-size: 22rpx;
        color: #cbd5e1;
        flex-shrink: 0;
      }
    }

    .form-error {
      font-size: 22rpx;
      color: #ef4444;
      display: block;
      margin-top: 8rpx;
    }
  }
}

.bottom-placeholder {
  height: 120rpx;
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

  .save-btn {
    width: 100%;
    height: 88rpx;
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
      opacity: 0.6;
    }
  }
}
</style>

