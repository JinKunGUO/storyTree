# 蚂蚁链版权存证接入指南

> 版本：v1.0 | 更新日期：2026-04-07
>
> 本文档介绍如何将 StoryTree 平台接入蚂蚁链（AntChain）版权存证服务。

---

## 一、蚂蚁链简介

蚂蚁链（AntChain）是蚂蚁集团旗下的区块链品牌，提供企业级区块链服务。其版权存证服务具有以下特点：

- **法律效力**：存证数据已被多地法院认可为有效证据
- **技术可靠**：基于联盟链技术，数据不可篡改
- **接入便捷**：提供标准 REST API，接入成本低
- **成本合理**：按存证次数计费，适合内容平台
- **生态完善**：与司法机构、公证机构深度合作

---

## 二、产品选择

### 2.1 蚂蚁链相关产品对比

| 产品 | 适用场景 | 费用参考 | 推荐指数 |
|------|---------|---------|---------|
| **蚂蚁链·版权存证** | 内容版权固证 | ~0.1元/次 | ★★★★★ |
| 蚂蚁链·司法存证 | 法律纠纷证据 | ~0.5元/次 | ★★★★☆ |
| 蚂蚁链·电子合同 | 用户协议签署 | 按合同数计费 | ★★★☆☆ |

**推荐方案**：优先接入「蚂蚁链·版权存证」，后续可升级至「司法存证」。

### 2.2 申请入口

- 官网：https://antchain.antgroup.com/
- 产品页：https://antchain.antgroup.com/products/copyright
- 开发者文档：https://antchain.antgroup.com/docs

---

## 三、接入流程

### 3.1 企业资质申请

```
步骤一：企业注册
  - 准备材料：营业执照、法人身份证、联系人信息
  - 提交渠道：蚂蚁链官网 → 立即入驻
  - 审核时间：3-5个工作日

步骤二：产品开通
  - 登录蚂蚁链控制台
  - 选择「版权存证」产品
  - 签署服务协议
  - 充值预付费金额（建议初始充值 1000 元）

步骤三：获取 API 凭证
  - 在控制台创建应用
  - 获取 AppId、AppKey、AppSecret
  - 下载 SDK 或查看 API 文档
```

### 3.2 技术接入步骤

**Step 1：安装 SDK**

```bash
# Node.js SDK
npm install @antchain/sdk

# 或直接使用 REST API（推荐，无需 SDK）
```

**Step 2：配置认证信息**

```javascript
// config/antchain.js
module.exports = {
  endpoint: 'https://rest.antchain.antgroup.com',
  appId: process.env.ANTCHAIN_APP_ID,
  appKey: process.env.ANTCHAIN_APP_KEY,
  appSecret: process.env.ANTCHAIN_APP_SECRET,
  bizId: 'storytree-copyright', // 业务标识
};
```

**Step 3：实现存证接口**

```javascript
// services/antchain-certification.js
const crypto = require('crypto');
const axios = require('axios');

class AntChainCertification {
  constructor(config) {
    this.config = config;
  }

  /**
   * 计算内容哈希
   * @param {string} content - 原始内容
   * @returns {string} SHA256 哈希值
   */
  computeHash(content) {
    return crypto
      .createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
  }

  /**
   * 生成请求签名
   */
  generateSignature(params, timestamp) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const signStr = `${this.config.appKey}&${timestamp}&${sortedParams}`;
    
    return crypto
      .createHmac('sha256', this.config.appSecret)
      .update(signStr)
      .digest('hex')
      .toUpperCase();
  }

  /**
   * 提交版权存证
   * @param {Object} certData - 存证数据
   * @returns {Promise<Object>} 存证结果（含交易哈希）
   */
  async submitCertification(certData) {
    const timestamp = Date.now().toString();
    
    const params = {
      app_id: this.config.appId,
      biz_id: this.config.bizId,
      timestamp,
      content_hash: certData.contentHash,
      content_type: certData.contentType || 'text',
      author_id: certData.authorId,
      title: certData.title,
      create_time: certData.createTime,
    };

    const signature = this.generateSignature(params, timestamp);

    const response = await axios.post(
      `${this.config.endpoint}/api/copyright/certify`,
      { ...params, sign: signature },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (response.data.code !== '200') {
      throw new Error(`存证失败: ${response.data.message}`);
    }

    return {
      txHash: response.data.data.tx_hash,      // 区块链交易哈希
      certId: response.data.data.cert_id,      // 存证ID
      blockHeight: response.data.data.block_height, // 区块高度
      timestamp: response.data.data.timestamp, // 上链时间戳
    };
  }

  /**
   * 查询存证结果
   * @param {string} certId - 存证ID
   * @returns {Promise<Object>} 存证详情
   */
  async queryCertification(certId) {
    const timestamp = Date.now().toString();
    const params = {
      app_id: this.config.appId,
      cert_id: certId,
      timestamp,
    };
    
    const signature = this.generateSignature(params, timestamp);
    
    const response = await axios.get(
      `${this.config.endpoint}/api/copyright/query`,
      { params: { ...params, sign: signature } }
    );

    return response.data.data;
  }
}

module.exports = AntChainCertification;
```

---

## 四、StoryTree 存证业务设计

### 4.1 存证触发时机

| 触发事件 | 存证内容 | 优先级 |
|---------|---------|---------|
| 章节首次发布 | 章节内容哈希 + 元数据 | P0 |
| 故事创建 | 故事设定文档哈希 | P0 |
| 章节重大修改 | 新版本内容哈希 | P1 |
| 协作关系确认 | 协作者列表 + 权益约定 | P1 |
| 版权声明变更 | 变更记录 | P2 |

### 4.2 存证数据结构

```json
{
  "contentHash": "sha256:abc123...",
  "contentType": "story_chapter",
  "metadata": {
    "storyId": "story_001",
    "chapterId": "chapter_001",
    "authorId": "user_001",
    "authorName": "张三",
    "title": "第一章：序章",
    "wordCount": 1500,
    "parentChapterId": null,
    "isAIAssisted": false,
    "platform": "StoryTree",
    "version": "1.0"
  },
  "createTime": "2026-04-07T14:30:00+08:00"
}
```

### 4.3 存证证书生成

存证成功后，为创作者生成可下载的存证证书（PDF格式），包含：
- 存证编号
- 内容哈希值
- 区块链交易哈希
- 存证时间（北京时间）
- 蚂蚁链数字签名
- 二维码（可验证存证真实性）

---

## 五、成本估算

### 5.1 按规模估算

| 月活跃创作者 | 月均新章节 | 月存证费用 | 年费用估算 |
|------------|---------|---------|---------|
| 1,000 | 5,000 | 500元 | 6,000元 |
| 10,000 | 50,000 | 5,000元 | 60,000元 |
| 100,000 | 500,000 | 50,000元 | 600,000元 |

*注：以 0.1元/次 估算，实际价格以蚂蚁链报价为准*

### 5.2 成本优化策略

- **批量存证**：将多个存证合并为一个批量请求，降低单次成本
- **选择性存证**：仅对付费内容或高价值内容进行存证
- **用户付费模式**：将存证费用作为增值服务，由用户选择性购买

---

## 六、常见问题

**Q: 存证的法律效力如何？**

蚂蚁链存证已被北京互联网法院、杭州互联网法院等多地法院认可。存证证书可作为版权纠纷的证据材料，但最终证据效力由法院认定。

**Q: 如果蚂蚁链服务中断怎么办？**

建议同时接入至信链作为备份（见《至信链接入指南》），实现双链存证，提高可靠性。

**Q: 存证后内容被修改了怎么办？**

每次重大修改应重新存证，形成版本历史。多个版本的存证记录共同构成完整的创作历程证明。

**Q: 如何向法院提交存证证明？**

1. 从平台下载存证证书（PDF）
2. 访问蚂蚁链存证验证页面，截图验证结果
3. 将上述材料提交法院，必要时申请区块链存证机构出具鉴定意见

---

## 七、参考资源

- [蚂蚁链版权存证产品页](https://antchain.antgroup.com/products/copyright)
- [蚂蚁链开发者文档](https://antchain.antgroup.com/docs)
- [蚂蚁链客服](https://antchain.antgroup.com/contact)
- [相关判例：杭州互联网法院关于区块链存证的判决](https://www.zjcourt.cn/)

