/**
 * 修复数据库中错误的视频URL
 * 将localhost:3001改为localhost:3000
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixVideoUrls() {
  console.log('🔧 开始修复数据库中的视频URL...\n');

  try {
    // 1. 修复media表中的thumbnail_url
    console.log('📊 修复media表中的thumbnail_url...');

    // 先查找需要修复的记录
    const mediaToFix = await prisma.media.findMany({
      where: {
        thumbnail_url: {
          contains: 'localhost:3001'
        }
      },
      select: {
        id: true,
        thumbnail_url: true
      }
    });

    let mediaUpdateCount = 0;
    for (const media of mediaToFix) {
      if (media.thumbnail_url) {
        const fixedUrl = media.thumbnail_url.replace('localhost:3001', 'localhost:3000');
        await prisma.media.update({
          where: { id: media.id },
          data: { thumbnail_url: fixedUrl }
        });
        mediaUpdateCount++;
      }
    }
    console.log(`   ✅ 已更新 ${mediaUpdateCount} 条media记录的thumbnail_url`);

    // 2. 修复video_qualities表中的url
    console.log('\n📹 修复video_qualities表中的url...');

    const qualitiesToFix = await prisma.videoQuality.findMany({
      where: {
        url: {
          contains: 'localhost:3001'
        }
      },
      select: {
        id: true,
        url: true
      }
    });

    let qualityUpdateCount = 0;
    for (const quality of qualitiesToFix) {
      const fixedUrl = quality.url.replace('localhost:3001', 'localhost:3000');
      await prisma.videoQuality.update({
        where: { id: quality.id },
        data: { url: fixedUrl }
      });
      qualityUpdateCount++;
    }
    console.log(`   ✅ 已更新 ${qualityUpdateCount} 条video_quality记录的url`);

    // 3. 验证修复结果
    console.log('\n🔍 验证修复结果...');

    // 检查是否还有错误的URL
    const remainingMediaErrors = await prisma.media.count({
      where: {
        thumbnail_url: {
          contains: 'localhost:3001'
        }
      }
    });

    const remainingQualityErrors = await prisma.videoQuality.count({
      where: {
        url: {
          contains: 'localhost:3001'
        }
      }
    });

    if (remainingMediaErrors > 0 || remainingQualityErrors > 0) {
      console.log(`   ⚠️  仍有问题记录: ${remainingMediaErrors} media, ${remainingQualityErrors} qualities`);
    } else {
      console.log('   ✅ 所有URL已修复完成！');
    }

    // 4. 显示修复后的示例记录
    console.log('\n📋 修复后的示例记录:');
    const sampleRecord = await prisma.media.findFirst({
      where: {
        media_type: 'VIDEO'
      },
      include: {
        video_qualities: true
      }
    });

    if (sampleRecord) {
      console.log(`   Media ID: ${sampleRecord.id}`);
      console.log(`   缩略图URL: ${sampleRecord.thumbnail_url || '无'}`);
      if (sampleRecord.video_qualities && sampleRecord.video_qualities.length > 0) {
        console.log('   视频质量URLs:');
        sampleRecord.video_qualities.forEach((quality, index) => {
          console.log(`     ${index + 1}. ${quality.quality}: ${quality.url}`);
        });
      }
    }

    console.log('\n🎉 URL修复完成！现在视频应该可以正常播放了。');

  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixVideoUrls();
