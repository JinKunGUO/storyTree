const fs = require('fs');
const path = require('path');

const WEB_DIR = '/Users/jinkun/storytree/web';

const NEW_FILING = `<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">浙ICP 备 2026023946 号 -2</a>
            <span style="margin: 0 8px;">|</span>
            <a href="https://beian.mps.gov.cn/#/query/webSearch?code=33011002019543" rel="noreferrer" target="_blank" style="color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                <img src="/assets/beian-icon.png" alt="公安备案图标" style="width: 14px; height: 14px; vertical-align: middle;">
                浙公网安备 33011002019543 号
            </a>`;

// 获取所有 HTML 文件
const files = fs.readdirSync(WEB_DIR).filter(f => f.endsWith('.html'));

console.log(`📁 找到 ${files.length} 个 HTML 文件\n`);

let modifiedCount = 0;
let skippedCount = 0;

files.forEach(filename => {
    const filepath = path.join(WEB_DIR, filename);
    try {
        let content = fs.readFileSync(filepath, 'utf-8');

        // 检查是否已经包含公安备案
        if (content.includes('beian.mps.gov.cn')) {
            console.log(`⏭️  跳过 ${filename} - 已包含公安备案`);
            skippedCount++;
            return;
        }

        // 查找 '浙 I' 来定位备案号
        let idx = -1;
        for (let i = 0; i < content.length; i++) {
            if (content[i] === '浙' && content[i+1] === 'I') {
                idx = i;
                break;
            }
        }

        if (idx < 0) {
            console.log(`⚠️  跳过 ${filename} - 未找到 ICP 备案`);
            skippedCount++;
            return;
        }

        // 提取完整标签
        const start = content.lastIndexOf('<a', idx);
        const end = content.indexOf('</a>', idx) + 4;
        const tag = content.substring(start, end);

        // 替换
        const newContent = content.replace(tag, NEW_FILING);

        if (newContent !== content) {
            fs.writeFileSync(filepath, newContent, 'utf-8');
            console.log(`✅ 修改 ${filename}`);
            modifiedCount++;
        } else {
            console.log(`⚠️  跳过 ${filename} - 替换失败`);
            skippedCount++;
        }
    } catch (e) {
        console.log(`❌ 错误 ${filename}: ${e.message}`);
    }
});

console.log(`\n📊 完成：修改了 ${modifiedCount} 个文件，跳过了 ${skippedCount} 个文件`);
console.log(`\n💡 提示：请确保 /assets/beian-icon.png 文件存在`);