import { PrismaClient } from '@prisma/client';

/**
 * 修复已导入故事的节点结构：从扇形改为链式
 * 
 * 用法：
 *   cd api && npx ts-node scripts/fix-chain-structure.ts
 *   cd api && npx ts-node scripts/fix-chain-structure.ts --story-id 1
 *   cd api && npx ts-node scripts/fix-chain-structure.ts --dry-run
 */

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const storyIdArg = args.indexOf('--story-id') !== -1 ? parseInt(args[args.indexOf('--story-id') + 1]) : null;

async function fixStory(storyId: number) {
  const story = await prisma.stories.findUnique({
    where: { id: storyId },
    select: { id: true, title: true, root_node_id: true }
  });

  if (!story) {
    console.log(`  Story ID ${storyId} not found`);
    return;
  }

  console.log(`\n  Fixing: "${story.title}" (ID: ${story.id})`);

  // 获取该故事的所有节点，按 id 排序（即创建顺序）
  const nodes = await prisma.nodes.findMany({
    where: { story_id: storyId },
    orderBy: { id: 'asc' },
    select: { id: true, title: true, parent_id: true, path: true }
  });

  if (nodes.length === 0) {
    console.log('  No nodes found');
    return;
  }

  console.log(`  Found ${nodes.length} nodes`);

  // 检查是否已经是链式结构
  let isAlreadyChain = true;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].parent_id !== nodes[i - 1].id) {
      isAlreadyChain = false;
      break;
    }
  }

  if (isAlreadyChain && nodes[0].parent_id === null) {
    console.log('  Already in chain structure, skipping');
    return;
  }

  // 打印当前结构
  console.log('  Current structure:');
  for (const node of nodes) {
    console.log(`    [${node.id}] parent=${node.parent_id} path="${node.path}" - ${node.title}`);
  }

  // 计算新的 parent_id 和 path
  const updates: { id: number; parent_id: number | null; path: string }[] = [];
  let currentPath = '';

  for (let i = 0; i < nodes.length; i++) {
    let newParentId: number | null;
    let newPath: string;

    if (i === 0) {
      newParentId = null;
      newPath = '1';
    } else {
      newParentId = nodes[i - 1].id;
      newPath = `${currentPath}.1`;
    }
    currentPath = newPath;

    // 只更新需要变化的
    if (nodes[i].parent_id !== newParentId || nodes[i].path !== newPath) {
      updates.push({ id: nodes[i].id, parent_id: newParentId, path: newPath });
    }
  }

  if (updates.length === 0) {
    console.log('  No updates needed');
    return;
  }

  console.log(`\n  Will update ${updates.length} nodes:`);
  for (const u of updates) {
    const node = nodes.find(n => n.id === u.id);
    console.log(`    [${u.id}] parent: ${node?.parent_id} -> ${u.parent_id}, path: "${node?.path}" -> "${u.path}"`);
  }

  if (DRY_RUN) {
    console.log('  [DRY RUN] Skipping actual update');
    return;
  }

  // 执行更新
  await prisma.$transaction(
    updates.map(u =>
      prisma.nodes.update({
        where: { id: u.id },
        data: { parent_id: u.parent_id, path: u.path }
      })
    )
  );

  console.log(`  Done! Updated ${updates.length} nodes to chain structure`);
}

async function main() {
  console.log('Fix node structure: fan-shape -> chain\n');

  if (DRY_RUN) {
    console.log('[DRY RUN MODE]\n');
  }

  if (storyIdArg) {
    await fixStory(storyIdArg);
  } else {
    // 修复所有故事
    const stories = await prisma.stories.findMany({
      select: { id: true },
      orderBy: { id: 'asc' }
    });
    for (const s of stories) {
      await fixStory(s.id);
    }
  }
}

main()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error.message || error);
    prisma.$disconnect();
    process.exit(1);
  });

