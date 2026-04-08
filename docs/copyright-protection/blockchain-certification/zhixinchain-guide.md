# 至信链版权存证接入指南

> 版本：v1.0 | 更新日期：2026-04-07
>
> 本文档介绍如何将 StoryTree 平台接入至信链（ZhiXin Chain）版权存证服务。

---

## 一、至信链简介

至信链是腾讯公司推出的区块链服务平台，专注于司法、版权、金融等领域的可信数据存证。其特点：

- **司法直连**：与多地法院、司法机构直接对接，存证数据可直接在线调取
- **公信力强**：依托腾讯的品牌背书，被广泛认可
- **内容平台友好**：专为内容创作平台设计，支持文字、图片、视频等多种格式
- **微信生态整合**：可与微信公众号、小程序深度整合

---

## 二、产品选择与申请

### 2.1 至信链产品矩阵

| 产品 | 特点 | 适用场景 |
|------|------|---------|
| **至信链·版权存证** | 内容哈希上链，生成存证证书 | 文章、故事版权保护 |
| 至信链·司法存证 | 与法院系统直连 | 需要直接作为诉讼证据 |
| 至信链·电子合同 | 合同签署与存证 | 用户协议、创作协议签署 |
| 至信链·数字藏品 | NFT铸造与交易 | 优质内容数字化变现 |

### 2.2 申请入口

- 官网：https://zxchain.qq.com/
- 开发者平台：https://open.zxchain.qq.com/
- 申请条件：企业主体（个人开发者不可申请）

### 2.3 申请流程

```
1. 注册腾讯云账号并完成企业认证
2. 访问至信链开放平台申请接入
3. 填写应用信息（平台名称、业务描述、预计月存证量）
4. 提交营业执照、法人信息等资质材料
5. 等待审核（约5-7个工作日）
6. 审核通过后获取 AppID、AppSecret
```

---

## 三、技术接入

### 3.1 API 鉴权

至信链使用 OAuth 2.0 方式进行鉴权：

```javascript
// services/zhixinchain-auth.js
const axios = require('axios');

class ZhiXinChainAuth {
  constructor(appId, appSecret) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.accessToken = null;
    this.tokenExpireAt = null;
    this.baseUrl = 'https://open.zxchain.qq.com';
  }

  /**
   * 获取访问令牌（自动缓存和刷新）
   */
  async getAccessToken() {
    // 令牌有效则直接返回
    if (this.accessToken && Date.now() < this.tokenExpireAt) {
      return this.accessToken;
    }

    const response = await axios.post(`${this.baseUrl}/oauth/token`, {
      grant_type: 'client_credentials',
      app_id: this.appId,
      app_secret: this.appSecret,
    });

    this.accessToken = response.data.access_token;
    // 提前5分钟刷新
    this.tokenExpireAt = Date.now() + (response.data.expires_in - 300) * 1000;

    return this.accessToken;
  }
}
```

### 3.2 版权存证实现

```javascript
// services/zhixinchain-certification.js
const crypto = require('crypto');
const axios = require('axios');
const ZhiXinChainAuth = require('./zhixinchain-auth');

class ZhiXinChainCertification {
  constructor(config) {
    this.config = config;
    this.auth = new ZhiXinChainAuth(config.appId, config.appSecret);
    this.baseUrl = 'https://open.zxchain.qq.com';
  }

  /**
   * 提交内容存证
   * @param {Object} data - 存证数据
   */
  async certify(data) {
    const token = await this.auth.getAccessToken();
    
    // 计算内容哈希
    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data.content), 'utf8')
      .digest('hex');

    const payload = {
      // 业务唯一ID（用于幂等性保证）
      out_biz_id: data.bizId,
      // 内容哈希
      content_hash: contentHash,
      // 存证类型：1-文字 2-图片 3-视频 4-音频
      content_type: 1,
      // 内容摘要（不超过200字）
      content_summary: data.summary,
      // 权利人信息
      right_owner: {
        name: data.authorName,
        id_type: 'platform_user', // 平台用户标识
        id_no: data.authorId,
      },
      // 作品信息
      work_info: {
        title: data.title,
        create_time: data.createTime,
        platform: 'StoryTree',
        work_url: `https://storytree.com/story/${data.storyId}/chapter/${data.chapterId}`,
      },
    };

    const response = await axios.post(
      `${this.baseUrl}/v1/copyright/certify`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.ret_code !== 0) {
      throw new Error(`至信链存证失败: ${response.data.ret_msg}`);
    }

    return {
      certNo: response.data.data.cert_no,        // 存证编号
      txId: response.data.data.tx_id,            // 链上交易ID
      blockTime: response.data.data.block_time,  // 上链时间
      verifyUrl: response.data.data.verify_url,  // 验证链接
    };
  }

  /**
   * 查询存证详情
   */
  async query(certNo) {
    const token = await this.auth.getAccessToken();
    
    const response = await axios.get(
      `${this.baseUrl}/v1/copyright/query`,
      {
        params: { cert_no: certNo },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data.data;
  }

  /**
   * 下载存证证书（PDF）
   */
  async downloadCertificate(certNo) {
    const token = await this.auth.getAccessToken();
    
    const response = await axios.get(
      `${this.baseUrl}/v1/copyright/certificate`,
      {
        params: { cert_no: certNo },
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'arraybuffer',
      }
    );

    return Buffer.from(response.data);
  }
}

module.exports = ZhiXinChainCertification;
```

---

## 四、至信链与蚂蚁链的对比选择

### 4.1 综合对比

| 维度 | 蚂蚁链 | 至信链 |
|------|-------|-------|
| 背景 | 蚂蚁集团 | 腾讯 |
| 司法认可 | 广泛认可 | 广泛认可 |
| API 成熟度 | ★★★★★ | ★★★★☆ |
| 文档质量 | ★★★★★ | ★★★★☆ |
| 价格 | ~0.1元/次 | ~0.1元/次 |
| 微信整合 | 一般 | 优秀 |
| 支付宝整合 | 优秀 | 一般 |
| 技术支持 | 好 | 好 |

### 4.2 选择建议

**推荐策略：双链并行**

- **主链**：蚂蚁链（技术文档更完善，与支付宝生态整合更好）
- **备链**：至信链（司法直连优势，微信生态用户更熟悉）

双链存证可以：
1. 提高存证可靠性（两条链同时存证，互为备份）
2. 应对不同场景（支付宝用户 vs 微信用户）
3. 降低单一供应商依赖风险

---

## 五、微信小程序集成（至信链特色）

至信链与微信生态深度整合，可在微信小程序中直接展示存证信息：

```javascript
// 微信小程序端：展示存证信息
wx.request({
  url: 'https://api.storytree.com/certification/verify',
  data: { chapterId: this.data.chapterId },
  success: (res) => {
    this.setData({
      certInfo: res.data,
      showCertBadge: true,
    });
  }
});
```

```html
<!-- 存证徽章组件 -->
<view class="cert-badge" wx:if="{{showCertBadge}}" bindtap="showCertDetail">
  <image src="/assets/cert-icon.png" />
  <text>已存证</text>
</view>
```

---

## 六、参考资源

- [至信链官网](https://zxchain.qq.com/)
- [至信链开放平台](https://open.zxchain.qq.com/)
- [至信链 API 文档](https://open.zxchain.qq.com/docs)
- [腾讯云区块链服务](https://cloud.tencent.com/product/tbaas)

