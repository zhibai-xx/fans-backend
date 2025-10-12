/**
 * 检查数据库中的media记录
 * 验证URL字段和media_type字段是否正确
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMediaData() {
  console.log('🔍 检查数据库中的media记录...\n');

  try {
    // 查找包含addc35814a082680503c81b99f236055的视频记录
    const mediaRecord = await prisma.media.findFirst({
      where: {
        url: {
          contains: 'addc35814a082680503c81b99f236055'
        }
      },
      include: {
        video_qualities: true,
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    if (!mediaRecord) {
      console.log('❌ 没有找到对应的media记录');
      return;
    }

    console.log('📊 Media记录详情:');
    console.log('================');
    console.log(`ID: ${mediaRecord.id}`);
    console.log(`标题: ${mediaRecord.title || '无标题'}`);
    console.log(`媒体类型: ${mediaRecord.media_type}`);
    console.log(`状态: ${mediaRecord.status}`);
    console.log(`URL: ${mediaRecord.url}`);
    console.log(`缩略图URL: ${mediaRecord.thumbnail_url || '无'}`);
    console.log(`文件大小: ${(mediaRecord.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`尺寸: ${mediaRecord.width} × ${mediaRecord.height}`);
    console.log(`时长: ${mediaRecord.duration ? `${Math.floor(mediaRecord.duration / 60)}:${(mediaRecord.duration % 60).toString().padStart(2, '0')}` : '无'}`);
    console.log(`上传者: ${mediaRecord.user.username} (ID: ${mediaRecord.user.id})`);
    console.log(`创建时间: ${mediaRecord.created_at}`);

    console.log('\n📹 视频质量信息:');
    if (mediaRecord.video_qualities && mediaRecord.video_qualities.length > 0) {
      mediaRecord.video_qualities.forEach((quality, index) => {
        console.log(`  ${index + 1}. ${quality.quality || `${quality.height}p`}:`);
        console.log(`     URL: ${quality.url}`);
        console.log(`     尺寸: ${quality.width} × ${quality.height}`);
        console.log(`     比特率: ${quality.bitrate || '未知'}`);
      });
    } else {
      console.log('  无视频质量记录');
    }

    console.log('\n🔍 问题诊断:');
    console.log('============');

    // 检查media_type
    if (mediaRecord.media_type !== 'VIDEO') {
      console.log(`❌ media_type错误: 应该是'VIDEO'，实际是'${mediaRecord.media_type}'`);
    } else {
      console.log(`✅ media_type正确: ${mediaRecord.media_type}`);
    }

    // 检查URL格式
    if (!mediaRecord.url || !mediaRecord.url.includes('.mp4')) {
      console.log(`❌ URL格式异常: ${mediaRecord.url}`);
    } else {
      console.log(`✅ URL格式正确: ${mediaRecord.url}`);
    }

    // 检查缩略图
    if (!mediaRecord.thumbnail_url) {
      console.log(`⚠️  缺少缩略图URL`);
    } else {
      console.log(`✅ 缩略图URL: ${mediaRecord.thumbnail_url}`);
    }

    // 检查视频处理状态
    if (!mediaRecord.video_qualities || mediaRecord.video_qualities.length === 0) {
      console.log(`⚠️  视频尚未处理或处理失败`);
    } else {
      console.log(`✅ 视频已处理，共${mediaRecord.video_qualities.length}个质量版本`);
    }

    console.log('\n💡 建议:');
    if (mediaRecord.media_type !== 'VIDEO') {
      console.log('   - 需要修复media_type字段');
    }
    if (!mediaRecord.thumbnail_url) {
      console.log('   - 需要生成视频缩略图');
    }
    if (!mediaRecord.video_qualities || mediaRecord.video_qualities.length === 0) {
      console.log('   - 需要重新处理视频文件');
    }

  } catch (error) {
    console.error('❌ 数据库查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMediaData();
