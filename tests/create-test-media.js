const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const testMediaData = [
  {
    id: 'media-test-001',
    title: '演唱会现场精彩瞬间',
    description: '2024年世界巡回演唱会北京站现场高清图片，记录了最震撼的舞台瞬间',
    url: '/uploads/images/concert-moment-1.jpg',
    thumbnail_url: '/uploads/thumbnails/concert-moment-1_thumb.jpg',
    media_type: 'IMAGE',
    status: 'PENDING',
    size: 3145728, // 3MB
    views: 1250,
    likes_count: 89,
    user_id: 1, // 假设用户ID为1
    category_id: null, // 可以设置为null或实际的分类ID
    created_at: new Date('2024-01-15T10:00:00Z'),
    updated_at: new Date('2024-01-15T10:00:00Z')
  },
  {
    id: 'media-test-002',
    title: '独家幕后花絮视频',
    description: '拍摄现场的珍贵幕后花絮，展现了台前幕后的精彩故事',
    url: '/uploads/videos/behind-scenes-1.mp4',
    thumbnail_url: '/uploads/thumbnails/behind-scenes-1_thumb.jpg',
    media_type: 'VIDEO',
    status: 'APPROVED',
    size: 52428800, // 50MB
    duration: 180, // 3分钟
    views: 5670,
    likes_count: 234,
    user_id: 2, // 假设用户ID为2
    category_id: null,
    created_at: new Date('2024-01-16T14:30:00Z'),
    updated_at: new Date('2024-01-16T15:00:00Z')
  },
  {
    id: 'media-test-003',
    title: '时尚大片写真',
    description: '专业摄影师掌镜的高端时尚写真，展现独特魅力',
    url: '/uploads/images/fashion-shoot-1.jpg',
    thumbnail_url: '/uploads/thumbnails/fashion-shoot-1_thumb.jpg',
    media_type: 'IMAGE',
    status: 'APPROVED',
    size: 4194304, // 4MB
    views: 3456,
    likes_count: 156,
    user_id: 3, // 假设用户ID为3
    category_id: null,
    created_at: new Date('2024-01-17T09:15:00Z'),
    updated_at: new Date('2024-01-17T09:15:00Z')
  },
  {
    id: 'media-test-004',
    title: '音乐MV预告片',
    description: '最新单曲MV的30秒预告片，抢先感受音乐魅力',
    url: '/uploads/videos/mv-preview-1.mp4',
    thumbnail_url: '/uploads/thumbnails/mv-preview-1_thumb.jpg',
    media_type: 'VIDEO',
    status: 'PENDING',
    size: 31457280, // 30MB
    duration: 30, // 30秒
    views: 890,
    likes_count: 67,
    user_id: 1,
    category_id: null,
    created_at: new Date('2024-01-18T16:45:00Z'),
    updated_at: new Date('2024-01-18T16:45:00Z')
  },
  {
    id: 'media-test-005',
    title: '日常生活瞬间',
    description: '生活中的美好瞬间分享，感受真实的日常温暖',
    url: '/uploads/images/daily-life-1.jpg',
    thumbnail_url: '/uploads/thumbnails/daily-life-1_thumb.jpg',
    media_type: 'IMAGE',
    status: 'REJECTED',
    size: 2097152, // 2MB
    views: 234,
    likes_count: 23,
    user_id: 2,
    category_id: null,
    review_comment: '图片质量不够清晰，建议重新上传',
    created_at: new Date('2024-01-19T11:20:00Z'),
    updated_at: new Date('2024-01-19T12:30:00Z')
  },
  {
    id: 'media-test-006',
    title: '专属私人视频',
    description: '仅限粉丝的专属内容，记录特殊时刻',
    url: '/uploads/videos/private-content-1.mp4',
    thumbnail_url: '/uploads/thumbnails/private-content-1_thumb.jpg',
    media_type: 'VIDEO',
    status: 'PRIVATE',
    size: 41943040, // 40MB
    duration: 120, // 2分钟
    views: 156,
    likes_count: 45,
    user_id: 3,
    category_id: null,
    created_at: new Date('2024-01-20T08:30:00Z'),
    updated_at: new Date('2024-01-20T08:30:00Z')
  }
];

async function createTestMedia() {
  console.log('🎬 开始创建测试媒体数据...');

  try {
    // 检查并创建测试用户（如果不存在）
    const users = await prisma.user.findMany({
      where: {
        id: { in: [1, 2, 3] }
      }
    });

    console.log(`📊 找到 ${users.length} 个现有用户`);

    // 如果用户不存在，创建测试用户
    if (users.length === 0) {
      console.log('👤 创建测试用户...');
      await prisma.user.createMany({
        data: [
          {
            id: 1,
            username: 'test_user_1',
            email: 'test1@example.com',
            password: 'hashed_password_1',
            role: 'USER',
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 2,
            username: 'test_user_2',
            email: 'test2@example.com',
            password: 'hashed_password_2',
            role: 'USER',
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 3,
            username: 'test_user_3',
            email: 'test3@example.com',
            password: 'hashed_password_3',
            role: 'USER',
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date()
          }
        ],
        skipDuplicates: true
      });
      console.log('✅ 测试用户创建完成');
    }

    // 删除现有的测试媒体数据
    const deleteResult = await prisma.media.deleteMany({
      where: {
        id: { startsWith: 'media-test-' }
      }
    });
    console.log(`🗑️ 删除了 ${deleteResult.count} 条现有测试数据`);

    // 创建新的测试媒体数据
    const createResult = await prisma.media.createMany({
      data: testMediaData,
      skipDuplicates: true
    });

    console.log(`✅ 成功创建 ${createResult.count} 条测试媒体数据`);

    // 显示创建的数据统计
    const stats = await prisma.media.groupBy({
      by: ['status', 'media_type'],
      _count: true,
      where: {
        id: { startsWith: 'media-test-' }
      }
    });

    console.log('\n📊 测试数据统计:');
    stats.forEach(stat => {
      console.log(`  ${stat.status} ${stat.media_type}: ${stat._count} 个`);
    });

    // 验证数据创建
    const totalTestMedia = await prisma.media.count({
      where: {
        id: { startsWith: 'media-test-' }
      }
    });

    console.log(`\n🎯 总计创建了 ${totalTestMedia} 个测试媒体文件`);
    console.log('🎉 测试媒体数据创建完成！');

  } catch (error) {
    console.error('❌ 创建测试媒体数据失败:', error);
    console.error('详细错误:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createTestMedia();
}

module.exports = { createTestMedia, testMediaData };