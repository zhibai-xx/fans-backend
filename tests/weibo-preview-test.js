const fetch = require('node-fetch');

// 测试配置
const BACKEND_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:3001';

// 测试用户凭证 - 使用正确的测试用户
const TEST_USER = {
  username: 'testuser',
  password: 'testpass123'
};

let authToken = null;

// 工具函数：延迟
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 工具函数：HTTP请求
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

// 1. 用户登录
async function login() {
  console.log('🔐 正在登录...');

  const response = await request(`${BACKEND_URL}/api/users/login`, {
    method: 'POST',
    body: JSON.stringify(TEST_USER)
  });

  const data = await response.json();

  if (data.access_token) {
    authToken = data.access_token;
    console.log('✅ 登录成功');
    return true;
  } else {
    console.error('❌ 登录失败:', data);
    return false;
  }
}

// 2. 测试微博文件扫描
async function testWeiboScan() {
  console.log('\n📁 测试微博文件扫描...');

  const response = await request(`${BACKEND_URL}/api/upload/weibo-scan`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const data = await response.json();

  if (data.success && data.data) {
    console.log('✅ 微博文件扫描成功');
    console.log(`📊 统计信息: ${data.data.users?.length || 0} 个用户, ${data.data.totalFiles || 0} 个文件`);
    return data.data;
  } else {
    console.error('❌ 微博文件扫描失败:', data);
    return null;
  }
}

// 3. 测试微博文件预览
async function testWeiboPreview(scanResult) {
  console.log('\n🖼️  测试微博文件预览...');

  if (!scanResult?.users?.length) {
    console.log('⚠️  没有找到可预览的文件');
    return;
  }

  // 找到第一个图片文件
  let testFile = null;
  for (const user of scanResult.users) {
    for (const file of user.files) {
      if (file.type === 'image') {
        testFile = file;
        break;
      }
    }
    if (testFile) break;
  }

  if (!testFile) {
    console.log('⚠️  没有找到图片文件进行预览测试');
    return;
  }

  console.log(`📸 测试预览文件: ${testFile.name} (${testFile.id})`);

  // 测试预览API
  const response = await request(`${BACKEND_URL}/api/upload/weibo-preview/${testFile.id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  if (response.ok) {
    const contentType = response.headers.get('content-type');
    console.log('✅ 微博文件预览成功');
    console.log(`📊 响应信息: Content-Type=${contentType}`);

    // 检查响应是否为图片
    if (contentType && contentType.startsWith('image/')) {
      console.log('✅ 返回的是图片文件');
      return true;
    } else {
      console.log('⚠️  返回的不是图片文件');
      return false;
    }
  } else {
    console.error('❌ 微博文件预览失败:', response.status, response.statusText);
    return false;
  }
}

// 4. 测试前端页面访问
async function testFrontendAccess() {
  console.log('\n🌐 测试前端页面访问...');

  try {
    const response = await fetch(`${FRONTEND_URL}/weibo-import`);

    if (response.ok) {
      console.log('✅ 前端微博导入页面可访问');
      return true;
    } else {
      console.log('❌ 前端微博导入页面访问失败:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ 前端页面访问错误:', error.message);
    return false;
  }
}

// 5. 测试NextAuth会话
async function testNextAuthSession() {
  console.log('\n🔑 测试NextAuth会话...');

  try {
    const response = await fetch(`${FRONTEND_URL}/api/auth/session`);

    if (response.ok) {
      const session = await response.json();
      console.log('✅ NextAuth会话API正常');
      console.log(`📊 会话状态: ${session.user ? '已登录' : '未登录'}`);
      return true;
    } else {
      console.log('❌ NextAuth会话API失败:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ NextAuth会话测试错误:', error.message);
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始微博预览功能测试...\n');

  try {
    // 1. 登录
    const loginSuccess = await login();
    if (!loginSuccess) {
      console.log('❌ 登录失败，测试终止');
      return;
    }

    await delay(1000);

    // 2. 测试微博文件扫描
    const scanResult = await testWeiboScan();
    if (!scanResult) {
      console.log('❌ 微博文件扫描失败，跳过预览测试');
    } else {
      await delay(1000);

      // 3. 测试微博文件预览
      await testWeiboPreview(scanResult);
    }

    await delay(1000);

    // 4. 测试前端页面访问
    await testFrontendAccess();

    await delay(1000);

    // 5. 测试NextAuth会话
    await testNextAuthSession();

    console.log('\n✅ 所有测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
runTests().catch(console.error); 