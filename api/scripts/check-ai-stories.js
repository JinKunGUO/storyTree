const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // 查所有故事总数
  const total = await prisma.stories.count();
  console.log('Total stories:', total);

  // 查AI创建的故事
  const aiStories = await prisma.stories.findMany({
    where: { ai_assisted_created: true },
    orderBy: { id: 'desc' },
    take: 5,
    select: { id: true, title: true, project_brief: true }
  });
  console.log('AI-assisted stories:', aiStories.length);
  for (const s of aiStories) {
    console.log('  Story:', s.id, s.title, 'has brief:', !!s.project_brief);
    const outlines = await prisma.story_outlines.findMany({
      where: { story_id: s.id }
    });
    console.log('    outlines:', outlines.length);
    const nodes = await prisma.nodes.findMany({
      where: { story_id: s.id },
      take: 3,
      select: { title: true }
    });
    console.log('    nodes:', nodes.length, nodes.map(n => n.title));
  }

  // 查最近5个故事（不限AI创建）
  const recentStories = await prisma.stories.findMany({
    orderBy: { id: 'desc' },
    take: 5,
    select: { id: true, title: true, ai_assisted_created: true, project_brief: true }
  });
  console.log('\nRecent stories:');
  for (const s of recentStories) {
    console.log('  Story:', s.id, s.title, 'ai:', s.ai_assisted_created, 'brief:', !!s.project_brief);
    const outlines = await prisma.story_outlines.findMany({
      where: { story_id: s.id }
    });
    console.log('    outlines:', outlines.length);
  }

  await prisma.$disconnect();
}

check();
