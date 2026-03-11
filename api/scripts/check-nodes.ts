import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRecentNodes() {
  console.log('=== 最近创建的节点检查 ===');
  
  const nodes = await prisma.nodes.findMany({
    orderBy: { created_at: 'desc' },
    take: 10,
    include: {
      story: { select: { title: true } },
      author: { select: { username: true } }
    }
  });
  
  console.log('最近10个节点:');
  nodes.forEach(node => {
    console.log(`#${node.id}: ${node.title} | AI: ${node.ai_generated ? '是' : '否'} | ${node.created_at.toLocaleString('zh-CN')}`);
    console.log(`   故事: ${node.story.title} | 作者: ${node.author.username}`);
    console.log(`   路径: ${node.path} | 父节点: ${node.parent_id || '无'}`);
    console.log('');
  });
  
  await prisma.$disconnect();
}

checkRecentNodes();
