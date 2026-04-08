# StoryTree 智能合约设计方案

> 版本：v1.0 | 更新日期：2026-04-07
>
> 本文档描述 StoryTree 平台基于区块链智能合约的版权管理和收益分配方案。

---

## 一、智能合约的价值与适用场景

### 1.1 为什么需要智能合约？

传统的收益分配依赖平台中心化管理，存在以下问题：
- 平台可随时修改分配规则
- 分配过程不透明，创作者无法验证
- 平台倒闭或跑路风险

智能合约可以解决：
- **规则透明**：合约代码公开，规则不可随意修改
- **自动执行**：满足条件自动触发分配，无需人工干预
- **去信任化**：创作者无需信任平台，只需信任代码

### 1.2 适用场景

| 场景 | 适合智能合约 | 说明 |
|------|------------|------|
| 版权存证 | ✓ | 已实现（见技术实现文档） |
| 收益自动分配 | ✓ | 本文档核心内容 |
| 协作权益记录 | ✓ | 记录各作者贡献比例 |
| 版权授权交易 | ✓ | 未来可探索 |
| 内容审核 | ✗ | 需要人工判断 |
| 用户认证 | ✗ | 隐私考虑 |

---

## 二、技术选型

### 2.1 区块链平台选择

**推荐：蚂蚁链（联盟链）**

| 选项 | 优点 | 缺点 |
|------|------|------|
| 蚂蚁链（联盟链） | 合规、低成本、高性能 | 一定程度中心化 |
| 以太坊（公链） | 完全去中心化 | Gas费高、监管风险 |
| BSC/Polygon | 低Gas费 | 监管不确定性 |

**结论**：在中国运营的平台，推荐使用蚂蚁链联盟链，合规风险最低。

### 2.2 智能合约语言

蚂蚁链支持 Solidity 语法（兼容以太坊），以下示例使用 Solidity 编写。

---

## 三、核心合约设计

### 3.1 版权注册合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title StoryTreeCopyright
 * @dev 故事版权注册与管理合约
 */
contract StoryTreeCopyright {
    
    // 版权记录结构
    struct CopyrightRecord {
        string contentId;        // 内容ID（如 chapter_001）
        string contentHash;      // 内容SHA256哈希
        address authorAddress;   // 作者区块链地址
        string authorId;         // 平台用户ID
        uint256 timestamp;       // 注册时间戳
        string metadataUri;      // 元数据URI（IPFS或中心化存储）
        bool isActive;           // 是否有效
    }
    
    // 存储：contentId => 版权记录
    mapping(string => CopyrightRecord) public copyrightRecords;
    
    // 存储：authorId => 其所有内容ID列表
    mapping(string => string[]) public authorContents;
    
    // 平台管理员地址
    address public platformAdmin;
    
    // 事件
    event CopyrightRegistered(
        string indexed contentId,
        string contentHash,
        string authorId,
        uint256 timestamp
    );
    
    event CopyrightRevoked(
        string indexed contentId,
        uint256 timestamp
    );
    
    constructor() {
        platformAdmin = msg.sender;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == platformAdmin, "Only admin can call this");
        _;
    }
    
    /**
     * @dev 注册版权
     * @param contentId 内容唯一标识
     * @param contentHash 内容哈希
     * @param authorId 作者平台ID
     * @param metadataUri 元数据URI
     */
    function registerCopyright(
        string memory contentId,
        string memory contentHash,
        string memory authorId,
        string memory metadataUri
    ) external onlyAdmin {
        require(
            !copyrightRecords[contentId].isActive,
            "Copyright already registered"
        );
        
        copyrightRecords[contentId] = CopyrightRecord({
            contentId: contentId,
            contentHash: contentHash,
            authorAddress: msg.sender,
            authorId: authorId,
            timestamp: block.timestamp,
            metadataUri: metadataUri,
            isActive: true
        });
        
        authorContents[authorId].push(contentId);
        
        emit CopyrightRegistered(contentId, contentHash, authorId, block.timestamp);
    }
    
    /**
     * @dev 查询版权信息
     */
    function getCopyright(string memory contentId) 
        external view returns (CopyrightRecord memory) {
        return copyrightRecords[contentId];
    }
    
    /**
     * @dev 验证内容哈希是否匹配
     */
    function verifyCopyright(
        string memory contentId,
        string memory contentHash
    ) external view returns (bool) {
        CopyrightRecord memory record = copyrightRecords[contentId];
        return record.isActive && 
               keccak256(bytes(record.contentHash)) == keccak256(bytes(contentHash));
    }
    
    /**
     * @dev 获取作者的所有内容
     */
    function getAuthorContents(string memory authorId) 
        external view returns (string[] memory) {
        return authorContents[authorId];
    }
}
```

### 3.2 收益分配合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title StoryTreeRevenue
 * @dev 故事收益自动分配合约
 * 
 * 收益分配规则：
 * - 平台服务费：30%
 * - 主创作者：20%（可配置，最高50%）
 * - 各章节作者：50%（按阅读量加权）
 */
contract StoryTreeRevenue {
    
    // 故事收益配置
    struct StoryRevenueConfig {
        string storyId;
        string mainAuthorId;
        uint256 mainAuthorShare;    // 主创作者分成比例（基点，10000=100%）
        uint256 platformShare;      // 平台分成比例（基点）
        bool isActive;
        uint256 createdAt;
    }
    
    // 章节贡献记录
    struct ChapterContribution {
        string chapterId;
        string authorId;
        uint256 wordCount;          // 字数
        uint256 readCount;          // 阅读量（由平台定期更新）
        uint256 weight;             // 权重（综合计算后）
    }
    
    // 收益分配记录
    struct RevenueDistribution {
        string storyId;
        uint256 totalRevenue;       // 总收益（单位：分）
        uint256 distributedAt;      // 分配时间
        string[] authorIds;         // 参与分配的作者
        uint256[] amounts;          // 各作者分配金额
    }
    
    mapping(string => StoryRevenueConfig) public storyConfigs;
    mapping(string => ChapterContribution[]) public storyChapters;
    mapping(string => uint256) public authorBalances;  // 作者余额（单位：分）
    
    address public platformAdmin;
    uint256 public constant PLATFORM_MIN_SHARE = 2000; // 最低平台分成20%
    uint256 public constant BASIS_POINTS = 10000;      // 基点（100%）
    
    event RevenueDistributed(
        string indexed storyId,
        uint256 totalRevenue,
        uint256 timestamp
    );
    
    event AuthorWithdraw(
        string indexed authorId,
        uint256 amount,
        uint256 timestamp
    );
    
    constructor() {
        platformAdmin = msg.sender;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == platformAdmin, "Only admin");
        _;
    }
    
    /**
     * @dev 配置故事收益分配规则
     */
    function configureStoryRevenue(
        string memory storyId,
        string memory mainAuthorId,
        uint256 mainAuthorShare  // 基点值，如 2000 = 20%
    ) external onlyAdmin {
        require(mainAuthorShare <= 5000, "Main author share cannot exceed 50%");
        
        uint256 platformShare = PLATFORM_MIN_SHARE; // 平台最低30%（实际为30%，这里用20%是最低值示例）
        
        storyConfigs[storyId] = StoryRevenueConfig({
            storyId: storyId,
            mainAuthorId: mainAuthorId,
            mainAuthorShare: mainAuthorShare,
            platformShare: platformShare,
            isActive: true,
            createdAt: block.timestamp
        });
    }
    
    /**
     * @dev 更新章节贡献数据（由平台定期调用）
     */
    function updateChapterContribution(
        string memory storyId,
        string memory chapterId,
        string memory authorId,
        uint256 wordCount,
        uint256 readCount
    ) external onlyAdmin {
        // 查找是否已存在该章节记录
        ChapterContribution[] storage chapters = storyChapters[storyId];
        
        for (uint i = 0; i < chapters.length; i++) {
            if (keccak256(bytes(chapters[i].chapterId)) == keccak256(bytes(chapterId))) {
                chapters[i].readCount = readCount;
                return;
            }
        }
        
        // 新增章节记录
        chapters.push(ChapterContribution({
            chapterId: chapterId,
            authorId: authorId,
            wordCount: wordCount,
            readCount: readCount,
            weight: 0 // 将在分配时计算
        }));
    }
    
    /**
     * @dev 执行收益分配
     * @param storyId 故事ID
     * @param totalRevenue 总收益（单位：分）
     */
    function distributeRevenue(
        string memory storyId,
        uint256 totalRevenue
    ) external onlyAdmin {
        StoryRevenueConfig storage config = storyConfigs[storyId];
        require(config.isActive, "Story not configured");
        require(totalRevenue > 0, "Revenue must be positive");
        
        // 计算各部分金额
        uint256 platformAmount = (totalRevenue * config.platformShare) / BASIS_POINTS;
        uint256 mainAuthorAmount = (totalRevenue * config.mainAuthorShare) / BASIS_POINTS;
        uint256 chaptersPool = totalRevenue - platformAmount - mainAuthorAmount;
        
        // 主创作者收益
        authorBalances[config.mainAuthorId] += mainAuthorAmount;
        
        // 章节作者收益（按阅读量加权）
        ChapterContribution[] storage chapters = storyChapters[storyId];
        uint256 totalReadCount = 0;
        
        for (uint i = 0; i < chapters.length; i++) {
            totalReadCount += chapters[i].readCount;
        }
        
        if (totalReadCount > 0) {
            for (uint i = 0; i < chapters.length; i++) {
                uint256 authorShare = (chaptersPool * chapters[i].readCount) / totalReadCount;
                authorBalances[chapters[i].authorId] += authorShare;
            }
        }
        
        emit RevenueDistributed(storyId, totalRevenue, block.timestamp);
    }
    
    /**
     * @dev 查询作者余额
     */
    function getAuthorBalance(string memory authorId) 
        external view returns (uint256) {
        return authorBalances[authorId];
    }
}
```

---

## 四、合约部署与管理

### 4.1 部署流程

```bash
# 1. 安装蚂蚁链开发工具
npm install -g @antchain/cli

# 2. 配置网络
antchain config set network testnet  # 先在测试网部署

# 3. 编译合约
antchain compile contracts/StoryTreeCopyright.sol

# 4. 部署合约
antchain deploy --contract StoryTreeCopyright --network testnet

# 5. 验证部署
antchain verify --address <contract_address>
```

### 4.2 合约升级策略

智能合约一旦部署不可修改，采用**代理模式**实现可升级性：

```
用户调用 → 代理合约（固定地址）→ 逻辑合约（可升级）
```

---

## 五、实施建议

### 5.1 分阶段实施

**阶段一（当前推荐）**：仅使用区块链存证（无智能合约）
- 成本低，技术复杂度低
- 满足版权固证需求
- 适合平台早期阶段

**阶段二（规模化后）**：引入收益分配合约
- 需要月活创作者 > 10,000
- 需要专业区块链开发人员
- 预计开发成本：50-100万元

**阶段三（生态成熟后）**：探索 NFT 版权交易
- 优质内容数字化
- 版权授权市场化
- 需要监管环境支持

### 5.2 风险提示

1. **监管风险**：国内对区块链金融应用监管严格，涉及资金流转的合约需谨慎
2. **技术风险**：智能合约漏洞可能导致资金损失，需专业审计
3. **Gas费用**：公链的Gas费波动较大，联盟链成本更可控
4. **用户教育**：普通用户对区块链概念陌生，需要简化用户体验

---

*建议在专业区块链开发团队的支持下实施本方案，并在正式上线前进行充分的安全审计。*

