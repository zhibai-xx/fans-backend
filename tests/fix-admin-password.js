const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function fixAdminPassword() {
  console.log('🔐 修复管理员密码...\n');

  try {
    // 重新设置管理员密码
    const adminPassword = await bcrypt.hash('admin123', 10);

    const updatedAdmin = await prisma.user.update({
      where: { username: 'admin' },
      data: {
        password: adminPassword,
        role: 'ADMIN' // 确保角色正确
      }
    });

    console.log(`✅ 管理员密码已重置: ${updatedAdmin.username} (${updatedAdmin.role})`);

    // 验证登录
    const testAdmin = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (testAdmin) {
      const isPasswordValid = await bcrypt.compare('admin123', testAdmin.password);
      console.log(`🔍 密码验证: ${isPasswordValid ? '✅ 成功' : '❌ 失败'}`);
      console.log(`📊 用户信息: ID=${testAdmin.id}, 角色=${testAdmin.role}`);
    }

    console.log('\n🎉 管理员账户修复完成！');

  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminPassword(); 