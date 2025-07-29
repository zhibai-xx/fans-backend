const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试配置
const BASE_URL = 'http://localhost:3000';
const TEST_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwic3ViIjoyLCJ1dWlkIjoiMDQyZGFmMzYtZDYwOS00ZTkxLThmYWYtY2UzZTg1MDE5ODk4IiwiaWF0IjoxNzUxMDI1Mzk0LCJleHAiOjE3NTM2MTczOTR9.hKCIPrAYO7AHvhpm2NqwuZnMbuSoYV6o5VcqcvZP78s';

// 创建axios实例
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': TEST_TOKEN,
    'Content-Type': 'application/json'
  }
});

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// 测试工具函数
function logTest(testName, passed, message) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${testName}: ${message}`);

  testResults.tests.push({
    name: testName,
    passed,
    message
  });

  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 测试1: 数据库连接和基本API
async function testDatabaseConnection() {
  try {
    const response = await apiClient.get('/api/performance/database/query-stats');
    logTest('数据库连接测试', response.status === 200, '数据库连接正常');
    return true;
  } catch (error) {
    logTest('数据库连接测试', false, `数据库连接失败: ${error.message}`);
    return false;
  }
}

// 测试2: 微博文件扫描功能
async function testWeiboScan() {
  try {
    const response = await apiClient.post('/api/upload/weibo-scan', {
      customPath: undefined // 使用默认路径
    });

    if ((response.status === 200 || response.status === 201) && response.data) {
      const result = response.data;
      // 检查响应数据结构
      if (result.success && result.data && result.data.users && result.data.totalFiles) {
        const data = result.data;
        logTest('微博文件扫描', true, `扫描成功: 发现${data.totalFiles}个文件，${data.users.length}个用户`);
        return data;
      } else {
        logTest('微博文件扫描', false, '扫描失败: 响应格式不正确');
        return null;
      }
    } else {
      logTest('微博文件扫描', false, `扫描失败: 响应状态不正确 (${response.status})`);
      return null;
    }
  } catch (error) {
    logTest('微博文件扫描', false, `扫描失败: ${error.message}`);
    return null;
  }
}

// 测试3: 微博文件预览功能
async function testWeiboPreview(scanResult) {
  if (!scanResult || !scanResult.users || scanResult.users.length === 0) {
    logTest('微博文件预览', false, '没有扫描结果，跳过预览测试');
    return false;
  }

  try {
    // 获取第一个用户的第一个文件
    const firstUser = scanResult.users[0];
    const firstFile = firstUser.files[0];

    if (!firstFile) {
      logTest('微博文件预览', false, '没有找到可预览的文件');
      return false;
    }

    // 测试预览API
    const response = await apiClient.get(`/api/upload/weibo-preview/${firstFile.id}`, {
      responseType: 'arraybuffer'
    });

    if (response.status === 200 && response.data.byteLength > 0) {
      logTest('微博文件预览', true, `预览成功: 文件${firstFile.name}，大小${response.data.byteLength}字节`);
      return true;
    } else {
      logTest('微博文件预览', false, '预览失败: 响应为空');
      return false;
    }
  } catch (error) {
    logTest('微博文件预览', false, `预览失败: ${error.message}`);
    return false;
  }
}

// 测试4: 性能监控API
async function testPerformanceMonitoring() {
  try {
    const response = await apiClient.get('/api/performance/overview');

    if (response.status === 200 && response.data.success) {
      const data = response.data.data;
      logTest('性能监控API', true, `性能监控正常: 评分${data.performanceScore}，平均查询时间${data.database.averageQueryTime}ms`);
      return true;
    } else {
      logTest('性能监控API', false, '性能监控API响应格式不正确');
      return false;
    }
  } catch (error) {
    logTest('性能监控API', false, `性能监控API失败: ${error.message}`);
    return false;
  }
}

// 测试5: 缓存功能
async function testCacheSystem() {
  try {
    // 测试缓存统计
    const statsResponse = await apiClient.get('/api/performance/cache/stats');

    if (statsResponse.status === 200) {
      logTest('缓存统计', true, `缓存统计正常: 缓存条目${statsResponse.data.data.size}个`);

      // 测试缓存清理
      const clearResponse = await apiClient.post('/api/performance/cache/clear');

      if (clearResponse.status === 200 || clearResponse.status === 201) {
        logTest('缓存清理', true, '缓存清理成功');
        return true;
      } else {
        logTest('缓存清理', false, `缓存清理失败: 状态码 ${clearResponse.status}`);
        return false;
      }
    } else {
      logTest('缓存统计', false, '缓存统计API失败');
      return false;
    }
  } catch (error) {
    logTest('缓存功能', false, `缓存功能测试失败: ${error.message}`);
    return false;
  }
}

// 测试6: 数据库性能优化
async function testDatabaseOptimization() {
  try {
    const response = await apiClient.get('/api/performance/database/optimization');

    if (response.status === 200 && response.data.success) {
      const data = response.data.data;
      logTest('数据库优化建议', true, `优化建议获取成功: 未使用索引${data.unusedIndexes.length}个`);
      return true;
    } else {
      logTest('数据库优化建议', false, '优化建议API响应格式不正确');
      return false;
    }
  } catch (error) {
    logTest('数据库优化建议', false, `优化建议API失败: ${error.message}`);
    return false;
  }
}

// 测试7: 响应时间测试
async function testResponseTime() {
  const endpoints = [
    '/api/performance/overview',
    '/api/performance/database/query-stats',
    '/api/performance/cache/stats'
  ];

  let totalTime = 0;
  let successCount = 0;

  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      const response = await apiClient.get(endpoint);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (response.status === 200) {
        totalTime += responseTime;
        successCount++;
      }
    } catch (error) {
      // 忽略错误，继续测试其他端点
    }
  }

  if (successCount > 0) {
    const averageTime = totalTime / successCount;
    const passed = averageTime < 1000; // 1秒以内算通过
    logTest('响应时间测试', passed, `平均响应时间: ${averageTime.toFixed(2)}ms`);
    return passed;
  } else {
    logTest('响应时间测试', false, '所有端点都无法访问');
    return false;
  }
}

// 主测试函数
async function runAllTests() {
  console.log('🚀 开始运行功能测试...\n');

  // 测试数据库连接
  console.log('📊 测试数据库连接...');
  const dbConnected = await testDatabaseConnection();
  await delay(1000);

  // 测试微博扫描功能
  console.log('\n📁 测试微博文件扫描...');
  const scanResult = await testWeiboScan();
  await delay(2000);

  // 测试微博预览功能
  console.log('\n🖼️ 测试微博文件预览...');
  await testWeiboPreview(scanResult);
  await delay(1000);

  // 测试性能监控
  console.log('\n⚡ 测试性能监控...');
  await testPerformanceMonitoring();
  await delay(1000);

  // 测试缓存系统
  console.log('\n💾 测试缓存系统...');
  await testCacheSystem();
  await delay(1000);

  // 测试数据库优化
  console.log('\n🔧 测试数据库优化...');
  await testDatabaseOptimization();
  await delay(1000);

  // 测试响应时间
  console.log('\n⏱️ 测试响应时间...');
  await testResponseTime();

  // 输出测试结果
  console.log('\n📋 测试结果汇总:');
  console.log(`✅ 通过: ${testResults.passed} 个测试`);
  console.log(`❌ 失败: ${testResults.failed} 个测试`);
  console.log(`📊 总计: ${testResults.passed + testResults.failed} 个测试`);

  if (testResults.failed === 0) {
    console.log('\n🎉 所有测试通过！系统功能正常。');
  } else {
    console.log('\n⚠️ 部分测试失败，请检查以下问题:');
    testResults.tests.filter(t => !t.passed).forEach(test => {
      console.log(`  - ${test.name}: ${test.message}`);
    });
  }

  // 保存测试报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.passed + testResults.failed,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2) + '%'
    },
    details: testResults.tests
  };

  fs.writeFileSync(
    path.join(__dirname, 'test-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n📄 测试报告已保存到 test-report.json');
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests }; 