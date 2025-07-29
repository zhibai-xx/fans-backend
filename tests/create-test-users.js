const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUsers() {
  console.log('🚀 开始创建/更新测试用户...\n');

  try {
    // 处理普通用户
    const existingNormalUser = await prisma.user.findUnique({
      where: { username: 'testuser' }
    });

    if (existingNormalUser) {
      // 更新现有用户为普通用户角色
      const updatedNormalUser = await prisma.user.update({
        where: { username: 'testuser' },
        data: { role: 'USER' }
      });
      console.log(`✅ 更新现有用户: ${updatedNormalUser.username} -> ${updatedNormalUser.role}`);
    } else {
      // 创建新的普通用户
      const normalUserPassword = await bcrypt.hash('testpass123', 10);
      const normalUser = await prisma.user.create({
        data: {
          username: 'testuser',
          email: 'testuser@example.com',
          password: normalUserPassword,
          nickname: '测试用户',
          role: 'USER'
        }
      });
      console.log(`✅ 创建普通用户: ${normalUser.username} (${normalUser.role})`);
    }

    // 处理管理员用户
    const existingAdminUser = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (existingAdminUser) {
      // 更新现有用户为管理员角色
      const updatedAdminUser = await prisma.user.update({
        where: { username: 'admin' },
        data: { role: 'ADMIN' }
      });
      console.log(`✅ 更新现有用户: ${updatedAdminUser.username} -> ${updatedAdminUser.role}`);
    } else {
      // 创建新的管理员用户
      const adminPassword = await bcrypt.hash('admin123', 10);
      const adminUser = await prisma.user.create({
        data: {
          username: 'admin',
          email: 'admin@example.com',
          password: adminPassword,
          nickname: '管理员',
          role: 'ADMIN'
        }
      });
      console.log(`✅ 创建管理员用户: ${adminUser.username} (${adminUser.role})`);
    }

    // 验证用户角色
    console.log('\n📋 用户验证:');
    const users = await prisma.user.findMany({
      where: {
        username: {
          in: ['testuser', 'admin']
        }
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        created_at: true
      }
    });

    users.forEach(user => {
      console.log(`   ${user.username}: ${user.role} (ID: ${user.id})`);
    });

    console.log('\n🎉 测试用户处理完成！');

  } catch (error) {
    console.error('❌ 处理测试用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers(); 