<template>
  <scroll-view class="agreement-page" scroll-y>
    <view class="header">
      <text class="title">用户协议</text>
      <text class="update-time">最后更新：2024年1月1日</text>
    </view>

    <view class="content">
      <view v-for="section in sections" :key="section.title" class="section-block">
        <text class="section-title">{{ section.title }}</text>
        <text class="section-body">{{ section.body }}</text>
      </view>
    </view>

    <view class="footer">
      <text class="footer-text">感谢您使用 StoryTree</text>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
const sections = [
  {
    title: '一、服务说明',
    body: 'StoryTree（以下简称"本平台"）是一个协作式故事创作平台，为用户提供故事创作、阅读、互动等服务。使用本平台前，请仔细阅读本协议。注册或使用本平台即表示您同意本协议的全部条款。',
  },
  {
    title: '二、账号注册与安全',
    body: '1. 您需要注册账号才能使用完整功能。\n2. 您应提供真实、准确的注册信息，并及时更新。\n3. 您的账号和密码由您负责保管，因账号泄露造成的损失由您自行承担。\n4. 每人只能注册一个账号，不得转让、出售账号。\n5. 发现账号被盗用请立即联系我们。',
  },
  {
    title: '三、内容规范',
    body: '您在本平台发布的内容必须遵守以下规定：\n\n禁止发布：\n• 违反法律法规的内容\n• 色情、暴力、赌博等违禁内容\n• 侵犯他人知识产权的内容\n• 虚假信息和诈骗内容\n• 侮辱、诽谤他人的内容\n• 政治敏感内容\n\n您对发布的内容承担全部法律责任。',
  },
  {
    title: '四、知识产权',
    body: '1. 您保留对自己创作内容的著作权。\n2. 您授权本平台在全球范围内免费使用、复制、修改、展示您发布的内容，用于提供和改进服务。\n3. 本平台的界面设计、代码、商标等知识产权归本平台所有。\n4. 如您认为平台上的内容侵犯了您的权利，请通过官方渠道举报。',
  },
  {
    title: '五、积分与会员',
    body: '1. 积分是平台虚拟货币，不可兑换为人民币。\n2. 积分可通过签到、创作、邀请等方式获得，可用于解锁付费内容。\n3. 会员服务为订阅制，到期后自动失效，不退款。\n4. 如因平台原因导致服务中断，我们将酌情补偿会员时长。\n5. 积分和会员不可转让。',
  },
  {
    title: '六、免责声明',
    body: '1. 本平台不对用户发布内容的真实性、合法性负责。\n2. 本平台不保证服务不中断，因不可抗力（如服务器故障、网络问题）导致的损失，本平台不承担责任。\n3. 本平台有权在不通知用户的情况下修改、暂停或终止部分功能。',
  },
  {
    title: '七、违规处理',
    body: '如您违反本协议，我们有权采取以下措施：\n• 警告提示\n• 删除违规内容\n• 限制账号功能\n• 封禁账号\n• 向相关部门举报\n\n如您对处理结果有异议，可通过客服渠道申诉。',
  },
  {
    title: '八、协议修改',
    body: '我们保留修改本协议的权利。重大修改将通过应用内通知提前告知。继续使用本平台即表示您接受修改后的协议。',
  },
  {
    title: '九、适用法律',
    body: '本协议适用中华人民共和国法律。如发生争议，双方应友好协商解决；协商不成，提交本平台注册地有管辖权的法院解决。',
  },
]
</script>

<style lang="scss">
.agreement-page {
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

