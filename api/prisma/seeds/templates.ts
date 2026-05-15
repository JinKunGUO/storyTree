/**
 * 种子数据 - 故事模板
 * 运行：npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templates = [
  {
    name: '都市逆袭',
    description: '普通人逆袭人生，走向巅峰',
    genre: '都市',
    framework: JSON.stringify({
      presetCharacters: [
        { role: 'protagonist', type: '普通人', description: '出身平凡，但有梦想和毅力' },
        { role: 'antagonist', type: '富二代/权贵', description: '看不起主角，处处为难' },
        { role: 'supporting', type: '贵人', description: '在关键时刻帮助主角' },
        { role: 'love_interest', type: '女神/男神', description: '主角的爱慕对象' }
      ],
      plotStructure: {
        act1: '主角遭遇重大挫折（失业/分手/被羞辱），人生跌入谷底',
        act2: '主角获得机遇（系统/传承/贵人），开始逆袭之路，不断打脸反派',
        act3: '主角达到人生巅峰，收获事业和爱情，反派得到应有惩罚'
      },
      chapterFramework: {
        opening: '主角被羞辱/分手/失业，人生低谷',
        turning_point: '获得金手指/机遇',
        rising_action: '不断成长，打脸反派',
        climax: '与最大反派的终极对决',
        resolution: '圆满结局'
      }
    }),
    is_public: true,
    created_by: 1
  },
  {
    name: '玄幻修仙',
    description: '从凡人到仙帝的修行之路',
    genre: '玄幻',
    framework: JSON.stringify({
      presetCharacters: [
        { role: 'protagonist', type: '废柴少年', description: '天赋差但意志坚定' },
        { role: 'antagonist', type: '天才/恶霸', description: '欺负主角，后被反超' },
        { role: 'supporting', type: '师父/老爷爷', description: '指导主角修炼' },
        { role: 'love_interest', type: '圣女/仙子', description: '身份高贵，与主角相恋' }
      ],
      plotStructure: {
        act1: '主角天赋测试失败，被退婚/羞辱，获得金手指',
        act2: '加入宗门，修炼升级，参加比武，结识伙伴',
        act3: '对抗魔道/外敌，成为强者，拯救世界'
      },
      chapterFramework: {
        opening: '天赋测试，被羞辱',
        turning_point: '获得神秘传承/系统',
        rising_action: '修炼升级，参加各种比试',
        climax: '正邪大战/宗门危机',
        resolution: '成为强者，开创纪元'
      }
    }),
    is_public: true,
    created_by: 1
  },
  {
    name: '悬疑推理',
    description: '层层迷雾，揭开真相',
    genre: '悬疑',
    framework: JSON.stringify({
      presetCharacters: [
        { role: 'protagonist', type: '侦探/警察', description: '智商高，有正义感' },
        { role: 'antagonist', type: '真凶', description: '隐藏在所有人身后' },
        { role: 'supporting', type: '助手', description: '帮助主角查案' },
        { role: 'love_interest', type: '同事/记者', description: '与主角一起查案' }
      ],
      plotStructure: {
        act1: '发生离奇案件，主角接手调查',
        act2: '抽丝剥茧，发现多个嫌疑人，案情反转',
        act3: '真相大白，真凶落网，但有隐情'
      },
      chapterFramework: {
        opening: '发现尸体/离奇事件',
        turning_point: '找到第一个关键线索',
        rising_action: '调查多个嫌疑人，案情反复反转',
        climax: '与真凶的对峙',
        resolution: '真相揭晓，案件告破'
      }
    }),
    is_public: true,
    created_by: 1
  },
  {
    name: '甜宠言情',
    description: '甜蜜爱情，温馨日常',
    genre: '言情',
    framework: JSON.stringify({
      presetCharacters: [
        { role: 'protagonist', type: '平凡女孩', description: '善良可爱，运气不错' },
        { role: 'love_interest', type: '高冷总裁/校草', description: '外表冷漠，内心温柔' },
        { role: 'antagonist', type: '绿茶/情敌', description: '想方设法破坏感情' },
        { role: 'supporting', type: '闺蜜/兄弟', description: '帮助主角出谋划策' }
      ],
      plotStructure: {
        act1: '男女主意外相遇，产生误会',
        act2: '逐渐了解，互生情愫，但有阻碍',
        act3: '误会解除，甜蜜在一起，举办婚礼'
      },
      chapterFramework: {
        opening: '意外相遇，产生误会',
        turning_point: '再次相遇，不得不合作',
        rising_action: '日常互动，暗生情愫',
        climax: '误会爆发，短暂分离',
        resolution: '误会解除，甜蜜复合'
      }
    }),
    is_public: true,
    created_by: 1
  },
  {
    name: '科幻末世',
    description: '末日来临，人类求生',
    genre: '科幻',
    framework: JSON.stringify({
      presetCharacters: [
        { role: 'protagonist', type: '普通人', description: '意外获得生存技能' },
        { role: 'antagonist', type: '变异生物/其他幸存者', description: '威胁主角生存' },
        { role: 'supporting', type: '队友', description: '与主角一起求生' },
        { role: 'love_interest', type: '队友/医生', description: '与主角并肩作战' }
      ],
      plotStructure: {
        act1: '末日爆发，主角艰难求生',
        act2: '组建团队，建立基地，对抗威胁',
        act3: '找到 cure/新家园，人类重建文明'
      },
      chapterFramework: {
        opening: '末日爆发，秩序崩溃',
        turning_point: '获得重要物资/技能',
        rising_action: '组建团队，建立基地',
        climax: '最大危机，生死存亡',
        resolution: '找到希望，重建文明'
      }
    }),
    is_public: true,
    created_by: 1
  },
  {
    name: '历史穿越',
    description: '现代人穿越古代，改变历史',
    genre: '历史',
    framework: JSON.stringify({
      presetCharacters: [
        { role: 'protagonist', type: '现代人', description: '利用现代知识改变古代' },
        { role: 'antagonist', type: '奸臣/敌国', description: '阻碍主角改革' },
        { role: 'supporting', type: '明君/忠臣', description: '支持主角改革' },
        { role: 'love_interest', type: '公主/才女', description: '欣赏主角才华' }
      ],
      plotStructure: {
        act1: '主角穿越到古代，适应环境',
        act2: '展现才华，得到重用，推行改革',
        act3: '改变历史，国家强盛，名垂青史'
      },
      chapterFramework: {
        opening: '穿越到古代，身份低微',
        turning_point: '展现才华，被人赏识',
        rising_action: '推行改革，遇到阻力',
        climax: '重大危机（战争/政变）',
        resolution: '化解危机，名垂青史'
      }
    }),
    is_public: true,
    created_by: 1
  }
];

async function seed() {
  console.log('开始插入故事模板...');

  for (const template of templates) {
    await prisma.story_templates.upsert({
      where: { id: template.created_by === 1 ? templates.indexOf(template) + 1 : 0 },
      update: {},
      create: template
    });
  }

  console.log(`✅ 已插入 ${templates.length} 个故事模板`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });