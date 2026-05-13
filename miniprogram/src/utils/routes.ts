/**
 * 路由常量 — 集中管理所有页面路径，避免硬编码
 * 分包后路径带子包前缀，修改时只需改此文件
 */

// 主包
export const ROUTES = {
  HOME: '/pages/index/index',
  DISCOVER: '/pages/discover/index',
  WRITE: '/pages/write/index',
  PROFILE: '/pages/profile/index',
  SEARCH: '/pages/search/index',
  NOTIFICATIONS: '/pages/notifications/index',

  // pkgStory
  STORY_DETAIL: '/pkgStory/pages/story/index',
  STORY_CREATE: '/pkgStory/pages/story/create',
  STORY_MANAGE: '/pkgStory/pages/story/manage',
  CHAPTER: '/pkgStory/pages/chapter/index',

  // pkgWrite
  CREATE: '/pkgWrite/pages/create/index',
  EDITOR: '/pkgWrite/pages/write/editor',

  // pkgProfile
  PROFILE_STORIES: '/pkgProfile/pages/profile/stories',
  PROFILE_NODES: '/pkgProfile/pages/profile/nodes',
  PROFILE_BOOKMARKS: '/pkgProfile/pages/profile/bookmarks',
  PROFILE_FOLLOWING: '/pkgProfile/pages/profile/following',
  PROFILE_FOLLOWED_AUTHORS: '/pkgProfile/pages/profile/followed-authors',
  PROFILE_EDIT: '/pkgProfile/pages/profile/edit',

  // pkgAuth
  LOGIN: '/pkgAuth/pages/auth/login/index',
  REGISTER: '/pkgAuth/pages/auth/register/index',

  // pkgMisc
  MEMBERSHIP: '/pkgMisc/pages/membership/index',
  POINTS: '/pkgMisc/pages/points/index',
  CHECKIN: '/pkgMisc/pages/checkin/index',
  INVITE: '/pkgMisc/pages/invite/index',
  ABOUT: '/pkgMisc/pages/about/index',
  PRIVACY: '/pkgMisc/pages/about/privacy',
  USER_AGREEMENT: '/pkgMisc/pages/about/user-agreement',
} as const

/** 旧路径 → 分包路径映射，用于处理 API 返回的旧格式路径 */
const SUBPACKAGE_PATH_MAP: Record<string, string> = {
  '/pages/story/index': ROUTES.STORY_DETAIL,
  '/pages/story/create': ROUTES.STORY_CREATE,
  '/pages/story/manage': ROUTES.STORY_MANAGE,
  '/pages/chapter/index': ROUTES.CHAPTER,
  '/pages/create/index': ROUTES.CREATE,
  '/pages/write/editor': ROUTES.EDITOR,
  '/pages/profile/stories': ROUTES.PROFILE_STORIES,
  '/pages/profile/nodes': ROUTES.PROFILE_NODES,
  '/pages/profile/bookmarks': ROUTES.PROFILE_BOOKMARKS,
  '/pages/profile/following': ROUTES.PROFILE_FOLLOWING,
  '/pages/profile/followed-authors': ROUTES.PROFILE_FOLLOWED_AUTHORS,
  '/pages/profile/edit': ROUTES.PROFILE_EDIT,
  '/pages/auth/login/index': ROUTES.LOGIN,
  '/pages/auth/register/index': ROUTES.REGISTER,
  '/pages/membership/index': ROUTES.MEMBERSHIP,
  '/pages/points/index': ROUTES.POINTS,
  '/pages/checkin/index': ROUTES.CHECKIN,
  '/pages/invite/index': ROUTES.INVITE,
  '/pages/about/index': ROUTES.ABOUT,
  '/pages/about/privacy': ROUTES.PRIVACY,
  '/pages/about/user-agreement': ROUTES.USER_AGREEMENT,
}

/** 将旧路径转换为分包路径，保留 query 参数 */
export function resolveSubpackagePath(path: string): string {
  for (const [oldPath, newPath] of Object.entries(SUBPACKAGE_PATH_MAP)) {
    if (path.startsWith(oldPath)) {
      return newPath + path.slice(oldPath.length)
    }
  }
  return path
}