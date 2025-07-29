const fetch = require('node-fetch');

// 测试配置
const BACKEND_URL = 'http://localhost:3000';
const TEST_USER = {
  username: 'testuser',
  password: 'testpass123'
};

let authToken = null;

// 工具函数：延迟
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. 登录获取token
async function login() {
  console.log('🔐 正在登录...');

  const response = await fetch(`${BACKEND_URL}/api/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(TEST_USER)
  });

  if (!response.ok) {
    throw new Error(`登录失败: ${response.status}`);
  }

  const data = await response.json();
  authToken = data.access_token;
  console.log('✅ 登录成功');
}

// 2. 获取文件列表
async function getWeiboFiles() {
  console.log('📁 获取微博文件列表...');

  const response = await fetch(`${BACKEND_URL}/api/upload/weibo-scan`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`获取文件列表失败: ${response.status}`);
  }

  const data = await response.json();
  console.log(`✅ 获取文件列表成功: ${data.data.totalFiles} 个文件`);

  return data.data;
}

// 3. 测试分页加载（模拟前端分页行为）
async function testPaginatedLoading(scanResult) {
  console.log('📄 测试分页加载...');

  // 获取所有图片文件
  const imageFiles = [];
  scanResult.users.forEach(user => {
    user.files.forEach(file => {
      if (file.type === 'image') {
        imageFiles.push(file);
      }
    });
  });

  console.log(`📊 找到 ${imageFiles.length} 个图片文件`);

  // 模拟分页：每页24个
  const pageSize = 24;
  const totalPages = Math.ceil(imageFiles.length / pageSize);

  console.log(`📋 将测试 ${totalPages} 页，每页 ${pageSize} 个文件`);

  let successCount = 0;
  let errorCount = 0;
  let rateLimitCount = 0;

  // 测试前3页（如果有的话）
  const pagesToTest = Math.min(3, totalPages);

  for (let page = 1; page <= pagesToTest; page++) {
    console.log(`\n🔄 测试第 ${page} 页...`);

    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, imageFiles.length);
    const pageFiles = imageFiles.slice(startIndex, endIndex);

    console.log(`📱 当前页文件数: ${pageFiles.length}`);

    // 控制并发数（模拟请求队列）
    const maxConcurrent = 5;
    const delayBetweenRequests = 200;

    for (let i = 0; i < pageFiles.length; i += maxConcurrent) {
      const batch = pageFiles.slice(i, i + maxConcurrent);

      // 并发请求当前批次
      const batchPromises = batch.map(async (file, index) => {
        try {
          await delay(index * delayBetweenRequests); // 错开请求时间

          const response = await fetch(`${BACKEND_URL}/api/upload/weibo-preview/${file.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
            }
          });

          if (response.ok) {
            successCount++;
            return { success: true, file: file.name };
          } else if (response.status === 429) {
            rateLimitCount++;
            return { success: false, error: '429 Rate Limited', file: file.name };
          } else {
            errorCount++;
            return { success: false, error: `${response.status}`, file: file.name };
          }
        } catch (error) {
          errorCount++;
          return { success: false, error: error.message, file: file.name };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // 显示批次结果
      const batchSuccess = batchResults.filter(r => r.success).length;
      const batchErrors = batchResults.filter(r => !r.success).length;

      console.log(`  批次 ${Math.floor(i / maxConcurrent) + 1}: 成功 ${batchSuccess}, 失败 ${batchErrors}`);

      // 批次间延迟
      if (i + maxConcurrent < pageFiles.length) {
        await delay(500);
      }
    }

    // 页面间延迟
    if (page < pagesToTest) {
      await delay(1000);
    }
  }

  console.log('\n📊 分页测试结果:');
  console.log(`✅ 成功: ${successCount}`);
  console.log(`❌ 失败: ${errorCount}`);
  console.log(`🚦 限流: ${rateLimitCount}`);

  const totalRequests = successCount + errorCount + rateLimitCount;
  const successRate = ((successCount / totalRequests) * 100).toFixed(1);
  const rateLimitRate = ((rateLimitCount / totalRequests) * 100).toFixed(1);

  console.log(`📈 成功率: ${successRate}%`);
  console.log(`🚦 限流率: ${rateLimitRate}%`);

  if (rateLimitCount === 0) {
    console.log('🎉 太好了！没有触发API限流！');
  } else if (rateLimitCount < totalRequests * 0.1) {
    console.log('✅ 限流情况大大改善！');
  } else {
    console.log('⚠️  仍有较多限流情况，可能需要进一步优化');
  }
}

// 主测试函数
async function runPaginationTest() {
  console.log('🚀 开始分页功能测试...\n');

  try {
    // 1. 登录
    await login();
    await delay(1000);

    // 2. 获取文件列表
    const scanResult = await getWeiboFiles();
    await delay(1000);

    // 3. 测试分页加载
    await testPaginatedLoading(scanResult);

    console.log('\n✅ 分页功能测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
runPaginationTest().catch(console.error); 