const fs = require('fs');

const file = '/Users/jinkun/storytree/web/index.html';
let content = fs.readFileSync(file, 'utf-8');

const lines = content.split('\n');
let foundLine = -1;

// 查找包含 ICP 备案的行
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('beian.miit.gov.cn') && lines[i].includes('2026023946')) {
        foundLine = i;
        console.log(`找到 ICP 备案在第 ${i + 1} 行`);
        break;
    }
}

if (foundLine >= 0) {
    // 读取原始行的内容
    const originalLine = lines[foundLine];
    console.log(`原始内容：${originalLine}`);

    // 提取缩进
    const indent = originalLine.match(/^\s*/)[0];

    // 构建新的内容
    const newLines = [
        `${indent}<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">浙ICP 备 2026023946 号 -2</a>`,
        `${indent}<span style="margin: 0 8px;">|</span>`,
        `${indent}<a href="https://beian.mps.gov.cn/#/query/webSearch?code=33011002019543" rel="noreferrer" target="_blank" style="color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">`,
        `${indent}    <img src="/assets/beian-icon.png" alt="公安备案图标" style="width: 14px; height: 14px; vertical-align: middle;">`,
        `${indent}    浙公网安备 33011002019543 号`,
        `${indent}</a>`
    ];

    // 替换原来的单行
    lines.splice(foundLine, 1, ...newLines);

    // 修改父元素 p 的样式（在 foundLine - 1）
    if (lines[foundLine - 1] && lines[foundLine - 1].includes('margin-top: 10px')) {
        lines[foundLine - 1] = lines[foundLine - 1].replace('margin-top: 10px;', 'margin-top: 10px; font-size: 12px; color: #666;');
        console.log('已修改父元素 p 的样式');
    }

    fs.writeFileSync(file, lines.join('\n'), 'utf-8');
    console.log('✅ index.html 修改成功');
} else {
    console.log('❌ 未找到 ICP 备案');
}