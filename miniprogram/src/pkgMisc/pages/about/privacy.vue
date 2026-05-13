<template>
  <scroll-view class="privacy-page" scroll-y>
    <view class="header">
      <text class="title">隐私政策</text>
      <text class="update-time">最后更新：2024年1月1日</text>
    </view>

    <view class="content">
      <view v-for="section in sections" :key="section.title" class="section-block">
        <text class="section-title">{{ section.title }}</text>
        <text class="section-body">{{ section.body }}</text>
      </view>
    </view>

    <view class="footer">
      <text class="footer-text">如有疑问，请联系 support@storytree.com</text>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
const sections = [
  {
    title: '一、信息收集',
    body: '我们收集您在使用 StoryTree 时提供的信息，包括：\n• 注册信息：用户名、邮箱地址\n• 微信登录信息：微信 openid（不含手机号、真实姓名）\n• 创作内容：您发布的故事、章节、评论\n• 使用数据：页面访问记录、功能使用频率\n\n我们不会收集您的手机号码（除非您主动提供）、身份证信息或银行卡信息。',
  },
  {
    title: '二、信息使用',
    body: '我们使用收集的信息用于：\n• 提供和改善 StoryTree 服务\n• 个性化内容推荐\n• 发送重要通知（如评论回复、系统公告）\n• 防范欺诈和滥用行为\n• 统计分析（匿名化处理）',
  },
  {
    title: '三、信息共享',
    body: '我们不会向第三方出售您的个人信息。以下情况除外：\n• 您明确同意的情况\n• 法律法规要求\n• 保护用户或公众安全的紧急情况\n\n我们使用的第三方服务（如微信登录、支付）有其独立的隐私政策，请参阅相应服务商的说明。',
  },
  {
    title: '四、数据安全',
    body: '我们采取以下措施保护您的数据安全：\n• 传输加密：所有数据通过 HTTPS 加密传输\n• 密码加密：用户密码使用 bcrypt 单向加密存储\n• 访问控制：严格限制员工访问用户数据的权限\n• 定期备份：防止数据意外丢失',
  },
  {
    title: '五、Cookie 与本地存储',
    body: '我们在小程序端使用微信提供的本地存储（Storage）保存登录状态和用户偏好设置。这些数据仅存储在您的设备上，不会上传到服务器，您可以随时通过清除小程序缓存删除这些数据。',
  },
  {
    title: '六、未成年人保护',
    body: 'StoryTree 不面向 14 岁以下未成年人提供服务。如果我们发现收集了未成年人的个人信息，将立即删除相关数据。如果您是未成年人的监护人，发现相关问题请联系我们。',
  },
  {
    title: '七、您的权利',
    body: '您对自己的个人信息拥有以下权利：\n• 访问权：查看我们持有的您的个人信息\n• 更正权：更正不准确的个人信息\n• 删除权：请求删除您的账号和相关数据\n• 撤回同意：撤回您之前给予的数据处理同意\n\n如需行使上述权利，请通过设置页面或发送邮件至 privacy@storytree.com 联系我们。',
  },
  {
    title: '八、政策更新',
    body: '我们可能不定期更新本隐私政策。重大变更时，我们会通过应用内通知或邮件告知您。继续使用我们的服务即表示您接受更新后的隐私政策。',
  },
  {
    title: '九、联系我们',
    body: '如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：\n• 邮箱：privacy@storytree.com\n• 微信公众号：StoryTree官方\n\n我们将在收到您的请求后 15 个工作日内回复。',
  },
]
</script>

<style lang="scss">
.privacy-page {
  min-height: 100vh;
  background: #f0f2f5;
}

.header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 60rpx 40rpx 40rpx;

  .title {
    display: block;
    font-size: 40rpx;
    font-weight: 700;
    color: #fff;
    margin-bottom: 12rpx;
  }

  .update-time {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.5);
  }
}

.content {
  padding: 24rpx 30rpx;

  .section-block {
    background: #fff;
    border-radius: 16rpx;
    padding: 30rpx;
    margin-bottom: 16rpx;

    .section-title {
      display: block;
      font-size: 30rpx;
      font-weight: 600;
      color: #333;
      margin-bottom: 16rpx;
    }

    .section-body {
      font-size: 26rpx;
      color: #555;
      line-height: 1.8;
      white-space: pre-wrap;
    }
  }
}

.footer {
  padding: 20rpx 30rpx 60rpx;
  text-align: center;

  .footer-text {
    font-size: 24rpx;
    color: #999;
  }
}
</style>

