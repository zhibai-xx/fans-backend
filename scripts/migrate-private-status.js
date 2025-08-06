const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migratePrivateStatus() {
  try {
    console.log('🔍 检查数据库中的PRIVATE状态媒体...');

    // 查询所有PRIVATE状态的媒体
    const privateMedia = await prisma.media.findMany({
      where: {
        status: 'PRIVATE'
      },
      select: {
        id: true,
        title: true,
        status: true,
        user: {
          select: {
            username: true
          }
        }
      }
    });

    console.log(`📊 找到 ${privateMedia.length} 个PRIVATE状态的媒体`);

    if (privateMedia.length > 0) {
      console.log('\n📋 PRIVATE状态媒体列表:');
      privateMedia.forEach((media, index) => {
        console.log(`${index + 1}. ${media.title} (用户: ${media.user.username})`);
      });

      console.log('\n🔄 开始迁移PRIVATE状态的媒体...');

      // 将所有PRIVATE状态的媒体改为PENDING状态
      // 因为这些可能是用户暂存的内容，需要重新审核
      const updateResult = await prisma.media.updateMany({
        where: {
          status: 'PRIVATE'
        },
        data: {
          status: 'PENDING'
        }
      });

      console.log(`✅ 成功更新 ${updateResult.count} 个媒体状态从PRIVATE到PENDING`);
    } else {
      console.log('✅ 没有找到PRIVATE状态的媒体，可以安全进行迁移');
    }

    console.log('\n🎉 数据迁移准备完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migratePrivateStatus();