const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('🔧 开始创建测试用户数据...');

    // 检查是否已有测试用户
    const existingUsers = await prisma.user.findMany({
      where: {
        username: {
          in: ['test_user1', 'test_user2', 'test_user3', 'suspended_user']
        }
      }
    });

    if (existingUsers.length > 0) {
      console.log('⚠️  测试用户已存在，跳过创建');
      return;
    }

    // 创建测试用户数据
    const testUsers = [
      {
        username: 'test_user1',
        email: 'user1@test.com',
        password: await bcrypt.hash('123456', 10),
        nickname: '测试用户1',
        role: 'USER',
        status: 'ACTIVE',
        phoneNumber: '13800138001',
        created_at: new Date('2024-01-10T08:00:00Z'),
      },
      {
        username: 'test_user2',
        email: 'user2@test.com',
        password: await bcrypt.hash('123456', 10),
        nickname: '测试用户2',
        role: 'USER',
        status: 'ACTIVE',
        phoneNumber: '13800138002',
        created_at: new Date('2024-01-15T10:30:00Z'),
      },
      {
        username: 'test_user3',
        email: 'user3@test.com',
        password: await bcrypt.hash('123456', 10),
        nickname: '测试用户3',
        role: 'USER',
        status: 'ACTIVE',
        phoneNumber: null,
        created_at: new Date('2024-01-20T14:15:00Z'),
      },
      {
        username: 'suspended_user',
        email: 'suspended@test.com',
        password: await bcrypt.hash('123456', 10),
        nickname: '暂停用户',
        role: 'USER',
        status: 'SUSPENDED',
        phoneNumber: '13800138003',
        created_at: new Date('2024-01-05T16:20:00Z'),
      }
    ];

    // 批量创建用户
    for (const userData of testUsers) {
      await prisma.user.create({
        data: userData
      });
      console.log(`✅ 创建用户: ${userData.username} (${userData.nickname})`);
    }

    console.log('🎉 测试用户创建完成！');
    console.log('📊 创建的用户列表:');
    console.log('  - test_user1 (测试用户1) - ACTIVE');
    console.log('  - test_user2 (测试用户2) - ACTIVE');
    console.log('  - test_user3 (测试用户3) - ACTIVE');
    console.log('  - suspended_user (暂停用户) - SUSPENDED');

  } catch (error) {
    console.error('❌ 创建测试用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();