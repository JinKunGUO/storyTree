import { describe, it, expect } from 'vitest'
import { buildSubTree, type Node } from '../nodes'

function makeNode(overrides: Partial<Node> & { id: number; parent_id?: number }): Node {
  return {
    story_id: 1,
    author_id: 1,
    title: '',
    content: '',
    path: '',
    ai_generated: false,
    is_published: true,
    rating_avg: 0,
    rating_count: 0,
    read_count: 0,
    created_at: '',
    updated_at: '',
    author: { id: 1, username: 'test', level: 1 },
    ...overrides,
  }
}

describe('buildSubTree', () => {
  it('returns null for an empty nodes array', () => {
    expect(buildSubTree([], 1)).toBeNull()
  })

  it('returns null when rootId is not found in the nodes array', () => {
    const nodes = [makeNode({ id: 1, parent_id: undefined })]
    expect(buildSubTree(nodes, 999)).toBeNull()
  })

  it('builds a single-node tree (flat, no children)', () => {
    const nodes = [makeNode({ id: 1, parent_id: undefined })]
    const tree = buildSubTree(nodes, 1)!
    expect(tree.id).toBe(1)
    expect(tree.children).toEqual([])
  })

  it('builds a flat tree with root and direct children', () => {
    const nodes = [
      makeNode({ id: 1, parent_id: undefined }),
      makeNode({ id: 2, parent_id: 1 }),
      makeNode({ id: 3, parent_id: 1 }),
    ]
    const tree = buildSubTree(nodes, 1)!
    expect(tree.id).toBe(1)
    expect(tree.children).toHaveLength(2)
    expect(tree.children!.map((c) => c.id)).toEqual([2, 3])
  })

  it('builds a multi-level nested tree', () => {
    const nodes = [
      makeNode({ id: 1, parent_id: undefined }),
      makeNode({ id: 2, parent_id: 1 }),
      makeNode({ id: 3, parent_id: 1 }),
      makeNode({ id: 4, parent_id: 2 }),
      makeNode({ id: 5, parent_id: 2 }),
      makeNode({ id: 6, parent_id: 3 }),
    ]
    const tree = buildSubTree(nodes, 1)!
    expect(tree.id).toBe(1)
    expect(tree.children).toHaveLength(2)

    const child2 = tree.children!.find((c) => c.id === 2)!
    expect(child2.children).toHaveLength(2)
    expect(child2.children!.map((c) => c.id)).toEqual([4, 5])

    const child3 = tree.children!.find((c) => c.id === 3)!
    expect(child3.children).toHaveLength(1)
    expect(child3.children![0].id).toBe(6)
  })

  it('does not mutate the original node objects', () => {
    const nodes = [
      makeNode({ id: 1, parent_id: undefined }),
      makeNode({ id: 2, parent_id: 1 }),
    ]
    const originalFirst = nodes[0]
    buildSubTree(nodes, 1)
    // The original node should not have a children array injected
    expect(originalFirst.children).toBeUndefined()
  })

  it('only includes nodes that are descendants of rootId', () => {
    const nodes = [
      makeNode({ id: 1, parent_id: undefined }),
      makeNode({ id: 2, parent_id: 1 }),
      makeNode({ id: 3, parent_id: undefined }),
      makeNode({ id: 4, parent_id: 3 }),
    ]
    const tree = buildSubTree(nodes, 1)!
    expect(tree.id).toBe(1)
    expect(tree.children).toHaveLength(1)
    expect(tree.children![0].id).toBe(2)
  })

  it('builds a subtree starting from a non-root node', () => {
    const nodes = [
      makeNode({ id: 1, parent_id: undefined }),
      makeNode({ id: 2, parent_id: 1 }),
      makeNode({ id: 3, parent_id: 2 }),
      makeNode({ id: 4, parent_id: 2 }),
    ]
    const tree = buildSubTree(nodes, 2)!
    expect(tree.id).toBe(2)
    expect(tree.children).toHaveLength(2)
    expect(tree.children!.map((c) => c.id)).toEqual([3, 4])
  })
})