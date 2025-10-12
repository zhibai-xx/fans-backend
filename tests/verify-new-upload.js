/**
 * 验证最新上传媒体的修复效果
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyNewUpload() {
  console.log('🔍 检查最新上传的媒体...\n');

  try {
    // 获取最新的媒体记录
    const latestMedia = await prisma.media.findFirst({
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

    if (!latestMedia) {
      console.log('❌ 没有找到媒体记录');
      return;
    }

    console.log('📊 最新媒体记录详情:');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🆔 ID: ${latestMedia.id}`);
    console.log(`📝 标题: ${latestMedia.title}`);
    console.log(`📁 类型: ${latestMedia.media_type}`);
    console.log(`👤 上传者: ${latestMedia.user.username}`);
    console.log(`📦 文件大小: ${latestMedia.size} bytes`);
    console.log(`⏰ 创建时间: ${latestMedia.created_at}`);
    
    // 检查尺寸数据
    console.log(`\n📏 尺寸数据检查:`);
    if (latestMedia.media_type === 'IMAGE') {
      if (latestMedia.width && latestMedia.height) {
        console.log(`✅ 宽度: ${latestMedia.width} 像素`);
        console.log(`✅ 高度: ${latestMedia.height} 像素`);
        console.log(`✅ 宽高比: ${(latestMedia.width / latestMedia.height).toFixed(2)}`);
        console.log(`🎉 尺寸数据修复成功!`);
      } else {
        console.log(`❌ 尺寸数据仍然缺失:`);
        console.log(`   - width: ${latestMedia.width}`);
        console.log(`   - height: ${latestMedia.height}`);
      }
    } else {
      console.log(`ℹ️  视频文件，暂不检查尺寸`);
    }
    
    // 检查标签数据
    console.log(`\n🏷️  标签数据检查:`);
    if (latestMedia.media_tags && latestMedia.media_tags.length > 0) {
      console.log(`✅ 找到 ${latestMedia.media_tags.length} 个标签:`);
      latestMedia.media_tags.forEach((mediaTag, index) => {
        console.log(`   ${index + 1}. "${mediaTag.tag.name}" (ID: ${mediaTag.tag.id})`);
      });
      console.log(`🎉 标签关联修复成功!`);
    } else {
      console.log(`❌ 没有找到关联的标签`);
    }

    // 检查最近5分钟创建的标签
    const recentTags = await prisma.tag.findMany({
      where: {
        created_at: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // 5分钟前
        }
      },
      orderBy: { created_at: 'desc' }
    });

    if (recentTags.length > 0) {
      console.log(`\n🆕 最近5分钟创建的标签:`);
      recentTags.forEach((tag, index) => {
        console.log(`   ${index + 1}. "${tag.name}" - ${tag.created_at}`);
      });
    }

    // 整体评估
    console.log(`\n📊 修复效果评估:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    let score = 0;
    let maxScore = 0;
    
    if (latestMedia.media_type === 'IMAGE') {
      maxScore += 2;
      if (latestMedia.width && latestMedia.height) {
        score += 2;
        console.log(`✅ 图片尺寸提取: 正常`);
      } else {
        console.log(`❌ 图片尺寸提取: 失败`);
      }
    }
    
    maxScore += 1;
    if (latestMedia.media_tags && latestMedia.media_tags.length > 0) {
      score += 1;
      console.log(`✅ 标签关联功能: 正常`);
    } else {
      console.log(`❌ 标签关联功能: 失败`);
    }
    
    const percentage = ((score / maxScore) * 100).toFixed(0);
    console.log(`\n🎯 总体评分: ${score}/${maxScore} (${percentage}%)`);
    
    if (percentage === '100') {
      console.log(`🎉 修复完全成功!`);
    } else if (percentage >= '50') {
      console.log(`⚠️  修复部分成功，需要进一步排查`);
    } else {
      console.log(`❌ 修复失败，需要检查代码`);
    }

  } catch (error) {
    console.error('❌ 验证过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyNewUpload();
