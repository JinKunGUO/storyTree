#!/usr/bin/env node

// 千问API Key 诊断脚本
const fs = require('fs');
const path = require('path');

// 读取.env文件
const envPath = path.join(__dirname, 'api', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// 解析QWEN_API_KEY
const apiKeyMatch = envContent.match(/QWEN_API_KEY="?([^"\n]+)"?/);
const apiKey = apiKeyMatch ? apiKeyMatch[1] : null;

// 解析QWEN_MODEL
const modelMatch = envContent.match(/QWEN_MODEL="?([^"\n]+)"?/);
const model = modelMatch ? modelMatch[1] : 'qwen-plus';

console.log('🔍 阿里云千问API诊断工具\n');
console.log('='.repeat(60));

console.log('\n1️⃣ 检查环境变量');
console.log('   QWEN_API_KEY:', apiKey ? '存在' : '❌ 未设置');
console.log('   QWEN_MODEL:', model);

if (apiKey && apiKey !== 'your-qwen-api-key-here') {
    console.log('\n2️⃣ 检查API Key格式');
    console.log('   长度:', apiKey.length, '字符');
    console.log('   前缀:', apiKey.substring(0, 10) + '...');
    
    if (apiKey.startsWith('sk-')) {
        console.log('   ✅ 格式正确 (以 sk- 开头)');
    } else {
        console.log('   ⚠️  千问API Key通常以 "sk-" 开头');
        console.log('   如果您的Key格式不同，这可能是正常的');
    }
    
    console.log('\n3️⃣ 测试API连接');
    console.log('   正在调用阿里云千问API...');
    console.log('   模型:', model);
    console.log('   端点: https://dashscope.aliyuncs.com/compatible-mode/v1');
    
    // 从api目录导入openai包
    let OpenAI;
    try {
        OpenAI = require('./api/node_modules/openai');
    } catch (e) {
        console.log('   ❌ 未找到openai包，正在安装...');
        const { execSync } = require('child_process');
        try {
            execSync('cd api && npm install openai', { stdio: 'inherit' });
            OpenAI = require('./api/node_modules/openai');
        } catch (installError) {
            console.log('   ❌ 安装失败，请手动运行: cd api && npm install openai');
            process.exit(1);
        }
    }
    
    const client = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    });
    
    client.chat.completions.create({
        model: model,
        messages: [{
            role: 'user',
            content: '请说"测试成功"'
        }],
        max_tokens: 50
    }).then(response => {
        console.log('   ✅ API调用成功！');
        console.log('   响应:', response.choices[0]?.message?.content || '');
        console.log('   Token使用:', 
            response.usage?.prompt_tokens || 0, '输入 +', 
            response.usage?.completion_tokens || 0, '输出 =',
            response.usage?.total_tokens || 0, '总计'
        );
        console.log('   模型:', response.model);
        console.log('\n🎉 您的千问API配置正确，可以正常使用AI功能！');
        
        // 估算成本
        const totalTokens = response.usage?.total_tokens || 0;
        let costPerKToken = 0.002; // 默认千问-plus价格（元/千tokens）
        
        if (model.includes('turbo')) {
            costPerKToken = 0.0008;
        } else if (model.includes('max')) {
            costPerKToken = 0.02;
        }
        
        const estimatedCost = (totalTokens / 1000) * costPerKToken;
        console.log(`   💰 本次调用成本约: ¥${estimatedCost.toFixed(4)} 元`);
        
        process.exit(0);
    }).catch(error => {
        console.log('   ❌ API调用失败');
        console.log('   错误类型:', error.constructor.name);
        console.log('   错误信息:', error.message);
        
        if (error.message.includes('Invalid API key')) {
            console.log('\n❌ API Key无效');
            console.log('   请检查：');
            console.log('   1. API Key是否正确复制');
            console.log('   2. API Key是否已在阿里云DashScope控制台中激活');
            console.log('   3. 账户是否有可用额度');
        } else if (error.message.includes('model')) {
            console.log('\n❌ 模型配置错误');
            console.log('   当前配置的模型:', model);
            console.log('   可用模型: qwen-turbo, qwen-plus, qwen-max, qwen-max-longcontext');
        } else if (error.message.includes('quota') || error.message.includes('limit')) {
            console.log('\n⚠️  配额不足或请求频率超限');
            console.log('   请检查账户余额和调用频率限制');
        }
        
        console.log('\n📖 获取API Key: https://dashscope.console.aliyun.com/apiKey');
        console.log('📖 千问文档: https://help.aliyun.com/zh/dashscope/');
        process.exit(1);
    });
} else {
    console.log('\n❌ 未配置有效的API Key');
    console.log('   请在 api/.env 文件中配置：');
    console.log('   QWEN_API_KEY="sk-xxx..."');
    console.log('\n📖 获取步骤：');
    console.log('   1. 访问: https://dashscope.console.aliyun.com/');
    console.log('   2. 登录阿里云账号');
    console.log('   3. 进入 API Key 管理页面');
    console.log('   4. 创建新的API Key');
    console.log('   5. 复制API Key并粘贴到 .env 文件中');
    console.log('\n💡 千问模型对比：');
    console.log('   - qwen-turbo: 快速响应，适合简单任务 (¥0.0008/千tokens)');
    console.log('   - qwen-plus: 平衡性能和成本 (¥0.002/千tokens) 推荐');
    console.log('   - qwen-max: 最强性能 (¥0.02/千tokens)');
    process.exit(1);
}

