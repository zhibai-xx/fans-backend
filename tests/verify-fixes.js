/**
 * 验证修复效果的测试脚本
 * 运行方式：node tests/verify-fixes.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyFixes() {
  console.log('🔍 开始验证修复效果...\n');

  try {
    // 1. 检查最近的媒体记录的标签和尺寸数据
    console.log('📊 检查最近的媒体记录...');
    const recentMedia = await prisma.media.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        media_tags: {
          include: {
            tag: true
          }
        },
        user: {
          select: {
            username: true
          }
        }
      }
    });

    if (recentMedia.length === 0) {
      console.log('❌ 没有找到媒体记录');
      return;
    }

    console.log(`\n✅ 找到 ${recentMedia.length} 条最近的媒体记录:\n`);

    recentMedia.forEach((media, index) => {
      console.log(`--- 媒体 ${index + 1} ---`);
      console.log(`ID: ${media.id}`);
      console.log(`标题: ${media.title}`);
      console.log(`类型: ${media.media_type}`);
      console.log(`上传者: ${media.user.username}`);
      console.log(`文件大小: ${media.size} bytes`);
      
      // 检查尺寸数据
      if (media.media_type === 'IMAGE') {
        if (media.width && media.height) {
          console.log(`✅ 尺寸: ${media.width} × ${media.height} 像素`);
        } else {
          console.log(`❌ 尺寸数据缺失: width=${media.width}, height=${media.height}`);
        }
      }
      
      // 检查标签数据
      if (media.media_tags && media.media_tags.length > 0) {
        const tagNames = media.media_tags.map(mt => mt.tag.name).join(', ');
        console.log(`✅ 标签: ${tagNames}`);
      } else {
        console.log(`ℹ️  无标签`);
      }
      
      console.log(`创建时间: ${media.created_at}\n`);
    });

    // 2. 统计标签使用情况
    console.log('🏷️  检查标签统计...');
    const tagStats = await prisma.tag.findMany({
      include: {
        media_tags: true,
        _count: {
          select: {
            media_tags: true
          }
        }
      },
      orderBy: {
        media_tags: {
          _count: 'desc'
        }
      },
      take: 10
    });

    if (tagStats.length > 0) {
      console.log('\n📈 使用频率最高的标签:');
      tagStats.forEach((tag, index) => {
        console.log(`${index + 1}. "${tag.name}" - 使用 ${tag._count.media_tags} 次`);
      });
    }

    // 3. 检查尺寸数据统计
    console.log('\n📏 检查尺寸数据统计...');
    const imageStats = await prisma.media.groupBy({
      by: ['media_type'],
      where: {
        media_type: 'IMAGE'
      },
      _count: {
        _all: true
      },
      _avg: {
        width: true,
        height: true
      }
    });

    if (imageStats.length > 0) {
      const stats = imageStats[0];
      console.log(`图片总数: ${stats._count._all}`);
      console.log(`平均宽度: ${stats._avg.width?.toFixed(0) || '无数据'} 像素`);
      console.log(`平均高度: ${stats._avg.height?.toFixed(0) || '无数据'} 像素`);
    }

    // 4. 检查有尺寸数据的图片比例
    const totalImages = await prisma.media.count({
      where: { media_type: 'IMAGE' }
    });

    const imagesWithDimensions = await prisma.media.count({
      where: {
        media_type: 'IMAGE',
        width: { not: null },
        height: { not: null }
      }
    });

    if (totalImages > 0) {
      const percentage = ((imagesWithDimensions / totalImages) * 100).toFixed(1);
      console.log(`\n📊 尺寸数据完整性: ${imagesWithDimensions}/${totalImages} (${percentage}%)`);
      
      if (percentage === '100.0') {
        console.log('✅ 所有图片都有完整的尺寸数据');
      } else if (percentage >= '90.0') {
        console.log('⚠️  大部分图片有尺寸数据，可能有少量历史数据缺失');
      } else {
        console.log('❌ 尺寸数据缺失较多，需要进一步检查');
      }
    }

    console.log('\n🎉 验证完成!');

  } catch (error) {
    console.error('❌ 验证过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行验证
verifyFixes();
