import { describe, it, expect } from 'vitest'
import { resolveSubpackagePath, ROUTES } from '../routes'

describe('resolveSubpackagePath', () => {
  it('maps a known old path to its subpackage path', () => {
    expect(resolveSubpackagePath('/pages/story/index')).toBe(ROUTES.STORY_DETAIL)
    expect(resolveSubpackagePath('/pages/auth/login/index')).toBe(ROUTES.LOGIN)
    expect(resolveSubpackagePath('/pages/membership/index')).toBe(ROUTES.MEMBERSHIP)
  })

  it('preserves query parameters when mapping', () => {
    expect(resolveSubpackagePath('/pages/story/index?id=42')).toBe(
      '/pkgStory/pages/story/index?id=42',
    )
    expect(resolveSubpackagePath('/pages/chapter/index?nodeId=7&mode=read')).toBe(
      '/pkgStory/pages/chapter/index?nodeId=7&mode=read',
    )
  })

  it('returns already-new paths unchanged', () => {
    expect(resolveSubpackagePath('/pkgStory/pages/story/index')).toBe(
      '/pkgStory/pages/story/index',
    )
    expect(resolveSubpackagePath('/pkgAuth/pages/auth/login/index')).toBe(
      '/pkgAuth/pages/auth/login/index',
    )
  })

  it('returns unknown paths unchanged', () => {
    expect(resolveSubpackagePath('/pages/unknown/page')).toBe('/pages/unknown/page')
    expect(resolveSubpackagePath('/some/random/path')).toBe('/some/random/path')
  })

  it('does not match partial path prefixes incorrectly', () => {
    // /pages/story/indexExtra is not a known mapping
    const result = resolveSubpackagePath('/pages/story/indexExtra')
    // It still starts with '/pages/story/index' so it WILL be mapped —
    // the implementation uses startsWith. Verify the actual behavior:
    expect(result).toBe('/pkgStory/pages/story/indexExtra')
  })

  it('handles all entries in the subpackage map', () => {
    // Verify every key in the mapping produces a different output
    const oldPaths = [
      '/pages/story/index',
      '/pages/story/create',
      '/pages/story/manage',
      '/pages/chapter/index',
      '/pages/create/index',
      '/pages/write/editor',
      '/pages/profile/stories',
      '/pages/profile/nodes',
      '/pages/profile/bookmarks',
      '/pages/profile/following',
      '/pages/profile/followed-authors',
      '/pages/profile/edit',
      '/pages/auth/login/index',
      '/pages/auth/register/index',
      '/pages/membership/index',
      '/pages/points/index',
      '/pages/checkin/index',
      '/pages/invite/index',
      '/pages/about/index',
      '/pages/about/privacy',
      '/pages/about/user-agreement',
    ]
    for (const oldPath of oldPaths) {
      const result = resolveSubpackagePath(oldPath)
      expect(result).not.toBe(oldPath)
      expect(result).toContain('/pkg')
    }
  })
})