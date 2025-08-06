const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function updateUserToAdmin() {
  console.log('🔧 用户角色更新工具\n');

  try {
    // 显示当前所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true
      },
      orderBy: { created_at: 'desc' }
    });

    console.log('当前系统用户列表:');
    console.log('='.repeat(60));
    users.forEach((user, index) => {
      const roleEmoji = user.role === 'ADMIN' ? '👑' : '👤';
      const statusEmoji = user.status === 'ACTIVE' ? '✅' : '❌';
      console.log(`${index + 1}. ${roleEmoji} ${statusEmoji} ${user.username} (${user.email}) - ${user.role}`);
    });

    // 让用户选择要更新的用户
    rl.question('\n请输入要提升为管理员的用户编号 (输入用户名也可以): ', async (input) => {
      try {
        let targetUser = null;

        // 检查输入是数字还是用户名
        if (isNaN(input)) {
          // 按用户名查找
          targetUser = users.find(u => u.username === input.trim());
        } else {
          // 按编号查找
          const index = parseInt(input) - 1;
          if (index >= 0 && index < users.length) {
            targetUser = users[index];
          }
        }

        if (!targetUser) {
          console.log('❌ 未找到指定用户');
          process.exit(1);
        }

        if (targetUser.role === 'ADMIN') {
          console.log(`✅ 用户 ${targetUser.username} 已经是管理员`);
          process.exit(0);
        }

        // 更新用户角色
        const updatedUser = await prisma.user.update({
          where: { id: targetUser.id },
          data: {
            role: 'ADMIN',
            status: 'ACTIVE' // 同时确保用户状态为活跃
          }
        });

        console.log(`\n✅ 成功将用户 "${updatedUser.username}" 提升为管理员！`);
        console.log('💡 请重新登录以刷新权限');

      } catch (error) {
        console.error('❌ 更新失败:', error.message);
      } finally {
        await prisma.$disconnect();
        rl.close();
      }
    });

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    await prisma.$disconnect();
    rl.close();
  }
}

updateUserToAdmin();