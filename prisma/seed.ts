import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始播种数据库...');

  // 创建基础标签
  const tags = [
    { name: '演唱会' },
    { name: '舞台照' },
    { name: '生活照' },
    { name: '写真' },
    { name: '活动现场' },
    { name: '幕后花絮' },
    { name: '采访' },
    { name: '综艺' },
    { name: '电影' },
    { name: '电视剧' },
    { name: '音乐视频' },
    { name: '直播' },
  ];

  console.log('📝 创建标签...');
  for (const tag of tags) {
    try {
      await prisma.tag.upsert({
        where: { name: tag.name },
        update: {},
        create: tag,
      });
      console.log(`✅ 标签 "${tag.name}" 已创建`);
    } catch (error) {
      console.log(`❌ 标签 "${tag.name}" 创建失败:`, error.message);
    }
  }

  // 创建基础分类
  const categories = [
    {
      name: '舞台表演',
      description: '演唱会、音乐节等舞台表演的照片和视频'
    },
    {
      name: '日常生活',
      description: '日常生活、休闲时光的记录'
    },
    {
      name: '专业写真',
      description: '专业摄影师拍摄的写真作品'
    },
    {
      name: '影视作品',
      description: '电影、电视剧、综艺节目相关内容'
    },
    {
      name: '音乐作品',
      description: 'MV、音乐视频、录音室花絮等'
    },
    {
      name: '活动现场',
      description: '各种活动、发布会、见面会现场'
    },
    {
      name: '幕后花絮',
      description: '拍摄现场、排练、准备过程的记录'
    },
  ];

  console.log('📂 创建分类...');
  for (const category of categories) {
    try {
      await prisma.category.upsert({
        where: { name: category.name },
        update: {},
        create: category,
      });
      console.log(`✅ 分类 "${category.name}" 已创建`);
    } catch (error) {
      console.log(`❌ 分类 "${category.name}" 创建失败:`, error.message);
    }
  }

  console.log('🎉 数据库播种完成！');
}

main()
  .catch((e) => {
    console.error('❌ 数据库播种失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 