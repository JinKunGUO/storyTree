/**
 * 页面注册表
 *
 * 驱动冒烟测试和爬虫的页面清单。
 * 新增页面只需加一行，冒烟测试和爬虫自动覆盖。
 */

export interface PageEntry {
  /** URL 路径 */
  path: string;
  /** 页面标题关键词（用于验证加载正确） */
  titleKeyword: string;
  /** 是否需要登录 */
  auth: boolean;
  /** 是否需要管理员权限 */
  admin?: boolean;
  /** URL 参数占位符，$STORY_ID / $NODE_ID 会被替换为实际值 */
  params?: Record<string, string>;
  /** 分类 */
  category: 'public' | 'auth-flow' | 'user' | 'creation' | 'content' | 'commerce' | 'admin' | 'static';
}

export const PAGE_REGISTRY: PageEntry[] = [
  // === 公开页面（无需登录） ===
  { path: '/index.html', titleKeyword: 'StoryTree', auth: false, category: 'public' },
  { path: '/landing.html', titleKeyword: '故事', auth: false, category: 'public' },
  { path: '/discover.html', titleKeyword: '发现', auth: false, category: 'public' },
  { path: '/about.html', titleKeyword: '关于', auth: false, category: 'static' },
  { path: '/privacy.html', titleKeyword: '隐私', auth: false, category: 'static' },
  { path: '/user-agreement.html', titleKeyword: '用户协议', auth: false, category: 'static' },

  // === 认证流程页面 ===
  { path: '/login.html', titleKeyword: '登录', auth: false, category: 'auth-flow' },
  { path: '/register.html', titleKeyword: '注册', auth: false, category: 'auth-flow' },
  { path: '/forgot-password.html', titleKeyword: '忘记密码', auth: false, category: 'auth-flow' },
  { path: '/reset-password.html', titleKeyword: '重置密码', auth: false, category: 'auth-flow' },
  { path: '/verify-email.html', titleKeyword: '邮箱验证', auth: false, category: 'auth-flow' },
  { path: '/wx-callback.html', titleKeyword: '微信', auth: false, category: 'auth-flow' },

  // === 用户中心（需登录） ===
  { path: '/profile.html', titleKeyword: '个人', auth: true, category: 'user' },
  { path: '/my-stories.html', titleKeyword: '我的故事', auth: true, category: 'user' },
  { path: '/notifications.html', titleKeyword: '通知', auth: true, category: 'user' },
  { path: '/ai-tasks.html', titleKeyword: 'AI', auth: true, category: 'user' },

  // === 创作页面（需登录 + 参数） ===
  { path: '/create.html', titleKeyword: '创作', auth: true, category: 'creation' },
  { path: '/create-ai.html', titleKeyword: 'AI', auth: true, category: 'creation' },
  { path: '/write.html', titleKeyword: '撰写', auth: true, params: { id: '$STORY_ID' }, category: 'creation' },
  { path: '/story-settings.html', titleKeyword: '设置', auth: true, params: { id: '$STORY_ID' }, category: 'creation' },

  // === 内容页面（部分需参数） ===
  { path: '/story.html', titleKeyword: '故事', auth: false, params: { id: '$STORY_ID' }, category: 'content' },
  { path: '/story-tree.html', titleKeyword: '故事', auth: false, params: { id: '$STORY_ID' }, category: 'content' },
  { path: '/chapter.html', titleKeyword: '章节', auth: false, params: { id: '$NODE_ID' }, category: 'content' },

  // === 商业化页面 ===
  { path: '/membership.html', titleKeyword: '会员', auth: false, category: 'commerce' },
  { path: '/payment.html', titleKeyword: '支付', auth: true, category: 'commerce' },
  { path: '/points-mall.html', titleKeyword: '积分', auth: false, category: 'commerce' },

  // === 管理后台 ===
  { path: '/admin.html', titleKeyword: '管理', auth: true, admin: true, category: 'admin' },

  // === 测试页面 ===
  { path: '/milestone-test.html', titleKeyword: '里程碑', auth: false, category: 'static' },
];

/**
 * 获取公开页面（不需要登录的页面）
 */
export function getPublicPages(): PageEntry[] {
  return PAGE_REGISTRY.filter(p => !p.auth);
}

/**
 * 获取需要认证的页面
 */
export function getAuthPages(): PageEntry[] {
  return PAGE_REGISTRY.filter(p => p.auth && !p.admin);
}

/**
 * 获取管理员页面
 */
export function getAdminPages(): PageEntry[] {
  return PAGE_REGISTRY.filter(p => p.admin);
}

/**
 * 获取不需要参数的页面（可直接访问）
 */
export function getDirectPages(): PageEntry[] {
  return PAGE_REGISTRY.filter(p => !p.params);
}

/**
 * 将页面路径中的参数占位符替换为实际值
 */
export function resolvePageUrl(entry: PageEntry, data: { storyId?: number | null; nodeId?: number | null }): string {
  if (!entry.params) return entry.path;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entry.params)) {
    let resolved = value;
    if (value === '$STORY_ID') resolved = String(data.storyId || 1);
    if (value === '$NODE_ID') resolved = String(data.nodeId || 1);
    params.set(key, resolved);
  }
  return `${entry.path}?${params.toString()}`;
}
