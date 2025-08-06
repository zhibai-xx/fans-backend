/**
 * 创建测试日志数据
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestLogs() {
  console.log('🚀 开始创建测试日志数据...');

  try {
    // 获取管理员用户
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminUser) {
      console.error('❌ 未找到管理员用户，请先创建管理员账户');
      return;
    }

    console.log(`✅ 找到管理员用户: ${adminUser.username}`);

    // 创建操作日志
    const operationLogs = [
      {
        user_id: adminUser.id,
        operation_type: 'ADMIN_ACTION',
        module: 'media',
        action: 'approve',
        target_type: 'media',
        target_id: 'media_123',
        target_name: '演唱会精彩瞬间',
        description: '管理员审核通过图片内容',
        result: 'SUCCESS',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2小时前
      },
      {
        user_id: adminUser.id,
        operation_type: 'ADMIN_ACTION',
        module: 'tags',
        action: 'create',
        target_type: 'tag',
        target_id: 'tag_001',
        target_name: '演唱会',
        description: '管理员创建新标签: 演唱会',
        result: 'SUCCESS',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3小时前
      },
      {
        user_id: adminUser.id,
        operation_type: 'ADMIN_ACTION',
        module: 'categories',
        action: 'update',
        target_type: 'category',
        target_id: 'cat_001',
        target_name: '图片分类',
        description: '管理员更新分类: 图片分类',
        result: 'SUCCESS',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4小时前
      },
      {
        user_id: adminUser.id,
        operation_type: 'ADMIN_ACTION',
        module: 'media',
        action: 'batch_delete',
        target_type: 'media',
        description: '管理员批量删除违规内容',
        result: 'SUCCESS',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000) // 5小时前
      },
      {
        user_id: adminUser.id,
        operation_type: 'SYSTEM_ACTION',
        module: 'backup',
        action: 'auto_backup',
        target_type: 'database',
        description: '系统自动备份数据库',
        result: 'FAILED',
        error_message: '磁盘空间不足',
        ip_address: '127.0.0.1',
        user_agent: 'System/1.0',
        created_at: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6小时前
      }
    ];

    console.log('📝 正在创建操作日志...');
    for (const logData of operationLogs) {
      await prisma.operationLog.create({
        data: logData
      });
    }

    // 创建登录日志
    const loginLogs = [
      {
        user_id: adminUser.id,
        login_type: 'PASSWORD',
        result: 'SUCCESS',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        created_at: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1小时前
      },
      {
        user_id: adminUser.id,
        login_type: 'PASSWORD',
        result: 'FAILED',
        fail_reason: '密码错误',
        ip_address: '192.168.1.101',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        created_at: new Date(Date.now() - 7 * 60 * 60 * 1000) // 7小时前
      },
      {
        user_id: adminUser.id,
        login_type: 'PASSWORD',
        result: 'SUCCESS',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        created_at: new Date(Date.now() - 8 * 60 * 60 * 1000) // 8小时前
      },
      {
        user_id: null, // 未知用户登录失败
        login_type: 'PASSWORD',
        result: 'FAILED',
        fail_reason: '用户不存在',
        ip_address: '192.168.1.200',
        user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12小时前
      }
    ];

    console.log('🔐 正在创建登录日志...');
    for (const logData of loginLogs) {
      await prisma.loginLog.create({
        data: logData
      });
    }

    // 统计创建的数据
    const operationLogCount = await prisma.operationLog.count();
    const loginLogCount = await prisma.loginLog.count();

    console.log(`✅ 操作日志创建完成！共 ${operationLogCount} 条记录`);
    console.log(`✅ 登录日志创建完成！共 ${loginLogCount} 条记录`);
    console.log('🎉 测试日志数据创建完成！');

  } catch (error) {
    console.error('❌ 创建测试日志失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
createTestLogs();