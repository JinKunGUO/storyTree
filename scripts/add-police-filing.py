#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量添加公安备案信息到所有 HTML 页面
使用二进制方式读取和写入，避免编码问题
"""

import os

WEB_DIR = '/Users/jinkun/storytree/web'

def modify_file(filepath):
    """修改单个文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 检查是否已经包含公安备案
    if 'beian.mps.gov.cn' in content:
        print(f'⏭️  跳过 {os.path.basename(filepath)} - 已包含公安备案')
        return False

    # 旧的备案信息 HTML（普通格式）
    old_plain = '<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">浙 ICP 备 2026023946 号 -2</a>'

    # 旧的备案信息 HTML（带样式格式，用于 login.html, register.html 等）
    old_styled = '<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style="margin-top: 6px; display: inline-block;">浙 ICP 备 2026023946 号 -2</a>'

    # 新的备案信息 HTML
    new_filing = '''<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">浙 ICP 备 2026023946 号 -2</a>
            <span style="margin: 0 8px;">|</span>
            <a href="https://beian.mps.gov.cn/#/query/webSearch?code=33011002019543" rel="noreferrer" target="_blank" style="color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                <img src="/assets/beian-icon.png" alt="公安备案图标" style="width: 14px; height: 14px; vertical-align: middle;">
                浙公网安备 33011002019543 号
            </a>'''

    modified = False

    # 尝试替换带样式的版本
    if old_styled in content:
        content = content.replace(old_styled, new_filing)
        modified = True
        print(f'✅ 修改 {os.path.basename(filepath)} (带样式)')

    # 尝试替换普通版本
    if old_plain in content:
        content = content.replace(old_plain, new_filing)
        modified = True
        print(f'✅ 修改 {os.path.basename(filepath)}')

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return modified

def main():
    # 获取所有 HTML 文件
    html_files = [f for f in os.listdir(WEB_DIR) if f.endswith('.html')]

    print(f'📁 找到 {len(html_files)} 个 HTML 文件\n')

    modified_count = 0
    skipped_count = 0

    for filename in sorted(html_files):
        filepath = os.path.join(WEB_DIR, filename)
        try:
            if modify_file(filepath):
                modified_count += 1
            else:
                skipped_count += 1
        except Exception as e:
            print(f'❌ 错误 {filename}: {e}')

    print(f'\n📊 完成：修改了 {modified_count} 个文件，跳过了 {skipped_count} 个文件')
    print(f'\n💡 提示：请确保 /assets/beian-icon.png 文件存在')

if __name__ == '__main__':
    main()