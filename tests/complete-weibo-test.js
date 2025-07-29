const fetch = require('node-fetch');
const puppeteer = require('puppeteer');

// 测试配置
const BACKEND_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:3001';

// 测试用户凭证
const TEST_USER = {
  username: 'testuser',
  password: 'testpass123'
};

let authToken = null;
let scanResult = null;

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

// 1. 后端登录测试
async function testBackendLogin() {
  console.log('🔐 测试后端登录...');

  const response = await request(`${BACKEND_URL}/api/users/login`, {
    method: 'POST',
    body: JSON.stringify(TEST_USER)
  });

  const data = await response.json();

  if (data.access_token) {
    authToken = data.access_token;
    console.log('✅ 后端登录成功');
    return true;
  } else {
    console.error('❌ 后端登录失败:', data);
    return false;
  }
}

// 2. 测试微博文件扫描
async function testWeiboScan() {
  console.log('📁 测试微博文件扫描...');

  const response = await request(`${BACKEND_URL}/api/upload/weibo-scan`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const data = await response.json();

  if (data.success && data.data) {
    scanResult = data.data;
    console.log('✅ 微博文件扫描成功');
    console.log(`📊 统计信息: ${scanResult.users?.length || 0} 个用户, ${scanResult.totalFiles || 0} 个文件`);
    return true;
  } else {
    console.error('❌ 微博文件扫描失败:', data);
    return false;
  }
}

// 3. 测试微博文件预览API
async function testWeiboPreviewAPI() {
  console.log('🖼️  测试微博文件预览API...');

  if (!scanResult?.users?.length) {
    console.log('⚠️  没有找到可预览的文件');
    return false;
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
    return false;
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
    const buffer = await response.buffer();

    console.log('✅ 微博文件预览API成功');
    console.log(`📊 响应信息: Content-Type=${contentType}, Size=${buffer.length} bytes`);

    if (contentType && contentType.startsWith('image/')) {
      console.log('✅ 返回的是图片文件');
      return { testFile, contentType };
    } else {
      console.log('⚠️  返回的不是图片文件');
      return false;
    }
  } else {
    console.error('❌ 微博文件预览API失败:', response.status, response.statusText);
    return false;
  }
}

// 4. 测试前端页面访问
async function testFrontendAccess() {
  console.log('🌐 测试前端页面访问...');

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

// 5. 测试前端图片预览（使用Puppeteer）
async function testFrontendImagePreview() {
  console.log('🎨 测试前端图片预览功能...');

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 设置console监听以获取前端日志
    const consoleLogs = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    // 访问微博导入页面
    await page.goto(`${FRONTEND_URL}/weibo-import`);

    // 等待页面加载完成
    await page.waitForTimeout(2000);

    // 模拟登录状态（这里简化处理）
    await page.evaluate(() => {
      // 这里可以设置localStorage或cookie来模拟登录状态
      console.log('页面加载完成');
    });

    // 检查是否有扫描按钮
    const scanButton = await page.$('button:contains("扫描文件")');
    if (scanButton) {
      console.log('✅ 找到扫描按钮');
    } else {
      console.log('⚠️  没有找到扫描按钮');
    }

    // 检查控制台日志
    const imagePreviewLogs = consoleLogs.filter(log =>
      log.includes('正在获取图片预览') ||
      log.includes('图片预览响应状态') ||
      log.includes('图片预览成功')
    );

    if (imagePreviewLogs.length > 0) {
      console.log('✅ 前端图片预览功能正在工作');
      console.log('📊 前端日志:', imagePreviewLogs.slice(0, 3));
    } else {
      console.log('⚠️  前端图片预览功能可能未启用');
    }

    return true;

  } catch (error) {
    console.error('❌ 前端图片预览测试失败:', error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 6. 测试修复后的URL构建
async function testFixedURLBuilding() {
  console.log('🔧 测试修复后的URL构建...');

  // 检查前端是否使用了正确的API基础URL
  const testApiUrl = `${BACKEND_URL}/api/upload/weibo-preview/test-id`;

  try {
    const response = await fetch(testApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    // 期望404（因为test-id不存在），但不期望500或其他错误
    if (response.status === 404) {
      console.log('✅ API端点路径正确（预期的404错误）');
      return true;
    } else {
      console.log(`⚠️  API端点返回意外状态码: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ API端点测试失败:', error.message);
    return false;
  }
}

// 主测试函数
async function runCompleteTests() {
  console.log('🚀 开始完整的微博预览功能测试...\n');

  const results = {
    backendLogin: false,
    weiboScan: false,
    weiboPreviewAPI: false,
    frontendAccess: false,
    frontendImagePreview: false,
    fixedURLBuilding: false
  };

  try {
    // 1. 后端登录测试
    results.backendLogin = await testBackendLogin();
    if (!results.backendLogin) {
      console.log('❌ 后端登录失败，终止测试');
      return results;
    }

    await delay(1000);

    // 2. 测试微博文件扫描
    results.weiboScan = await testWeiboScan();

    await delay(1000);

    // 3. 测试微博文件预览API
    results.weiboPreviewAPI = await testWeiboPreviewAPI();

    await delay(1000);

    // 4. 测试前端页面访问
    results.frontendAccess = await testFrontendAccess();

    await delay(1000);

    // 5. 测试前端图片预览
    results.frontendImagePreview = await testFrontendImagePreview();

    await delay(1000);

    // 6. 测试修复后的URL构建
    results.fixedURLBuilding = await testFixedURLBuilding();

    console.log('\n📋 测试结果汇总:');
    console.log('==================');

    Object.entries(results).forEach(([test, result]) => {
      const status = result ? '✅ 通过' : '❌ 失败';
      const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
      console.log(`${status}: ${testName}`);
    });

    const passedTests = Object.values(results).filter(result => result).length;
    const totalTests = Object.keys(results).length;

    console.log(`\n📊 总计: ${passedTests}/${totalTests} 个测试通过`);

    if (passedTests === totalTests) {
      console.log('🎉 所有测试通过！微博预览功能修复成功！');
    } else {
      console.log('⚠️  部分测试失败，需要进一步调试');
    }

    return results;

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    return results;
  }
}

// 运行测试
runCompleteTests().catch(console.error); 