/**
 * CORS和Video.js调试测试
 * 
 * 从多个角度分析视频播放失败的原因：
 * 1. 跨域请求测试
 * 2. Video.js特殊头测试
 * 3. Range请求测试
 * 4. 前端环境模拟
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:3000';
const FRONTEND_ORIGIN = 'http://localhost:3001';
const TEST_VIDEO_URL = `${BACKEND_URL}/api/upload/file/video/addc35814a082680503c81b99f236055.mp4`;

console.log('🔍 开始CORS和Video.js调试测试...\n');

// 测试1: 模拟前端跨域请求
async function testCrossOriginRequest() {
  console.log('🌐 测试1: 模拟前端跨域请求');

  try {
    const response = await axios.get(TEST_VIDEO_URL, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
      },
      timeout: 5000,
      validateStatus: () => true // 允许所有状态码
    });

    console.log(`   状态码: ${response.status}`);
    console.log(`   CORS Allow-Origin: ${response.headers['access-control-allow-origin']}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);
    console.log(`   Content-Length: ${response.headers['content-length']}`);
    console.log(`   Accept-Ranges: ${response.headers['accept-ranges']}`);

    if (response.status >= 400) {
      console.log(`   ❌ 请求失败: ${response.status} ${response.statusText}`);
      console.log(`   错误数据:`, response.data);
      return false;
    }

    console.log(`   ✅ 跨域请求成功`);
    return true;
  } catch (error) {
    console.log(`   ❌ 请求异常: ${error.message}`);
    if (error.response) {
      console.log(`   响应状态: ${error.response.status}`);
      console.log(`   响应数据:`, error.response.data);
    }
    return false;
  }
}

// 测试2: 模拟Video.js的Range请求
async function testVideoJSRangeRequest() {
  console.log('\n📹 测试2: 模拟Video.js的Range请求');

  try {
    const response = await axios.get(TEST_VIDEO_URL, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
        'Range': 'bytes=0-1023',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity;q=1, *;q=0',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'video'
      },
      timeout: 5000,
      validateStatus: () => true
    });

    console.log(`   状态码: ${response.status}`);
    console.log(`   Content-Range: ${response.headers['content-range']}`);
    console.log(`   Content-Length: ${response.headers['content-length']}`);
    console.log(`   CORS Headers:`);
    console.log(`     Allow-Origin: ${response.headers['access-control-allow-origin']}`);
    console.log(`     Expose-Headers: ${response.headers['access-control-expose-headers']}`);

    const isValidRange = response.status === 206 && response.headers['content-range'];
    console.log(`   ✅ Range请求: ${isValidRange ? '成功' : '失败'}`);

    return isValidRange;
  } catch (error) {
    console.log(`   ❌ Range请求异常: ${error.message}`);
    return false;
  }
}

// 测试3: 检查CORS预检请求
async function testCORSPreflight() {
  console.log('\n🚀 测试3: CORS预检请求');

  try {
    const response = await axios.options(TEST_VIDEO_URL, {
      headers: {
        'Origin': FRONTEND_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'range,accept,accept-language,accept-encoding'
      },
      timeout: 5000,
      validateStatus: () => true
    });

    console.log(`   状态码: ${response.status}`);
    console.log(`   Allow-Origin: ${response.headers['access-control-allow-origin']}`);
    console.log(`   Allow-Methods: ${response.headers['access-control-allow-methods']}`);
    console.log(`   Allow-Headers: ${response.headers['access-control-allow-headers']}`);
    console.log(`   Max-Age: ${response.headers['access-control-max-age']}`);

    const hasValidCORS = response.status < 300 &&
      response.headers['access-control-allow-origin'] === FRONTEND_ORIGIN;

    console.log(`   ✅ CORS预检: ${hasValidCORS ? '通过' : '失败'}`);
    return hasValidCORS;
  } catch (error) {
    console.log(`   ❌ CORS预检异常: ${error.message}`);
    return false;
  }
}

// 测试4: 检查后端服务状态
async function testBackendHealth() {
  console.log('\n💗 测试4: 后端服务健康检查');

  try {
    // 测试基础API
    const response = await axios.get(`${BACKEND_URL}/api`, {
      timeout: 3000,
      validateStatus: () => true
    });

    console.log(`   后端API状态: ${response.status}`);

    // 测试文件控制器
    const fileResponse = await axios.head(TEST_VIDEO_URL, {
      timeout: 3000,
      validateStatus: () => true
    });

    console.log(`   文件服务状态: ${fileResponse.status}`);
    console.log(`   文件大小: ${fileResponse.headers['content-length']} bytes`);

    const isHealthy = response.status < 500 && fileResponse.status === 200;
    console.log(`   ✅ 后端健康: ${isHealthy ? '正常' : '异常'}`);

    return isHealthy;
  } catch (error) {
    console.log(`   ❌ 后端检查失败: ${error.message}`);
    return false;
  }
}

// 测试5: 分析可能的问题原因
function analyzeIssues(results) {
  console.log('\n🔍 问题分析:');
  console.log('==============');

  const [crossOrigin, rangeRequest, corsPreflight, backendHealth] = results;

  if (!backendHealth) {
    console.log('❌ 后端服务异常 - 这是根本问题');
    return;
  }

  if (!corsPreflight) {
    console.log('❌ CORS预检失败 - Video.js无法进行跨域请求');
    console.log('💡 建议检查后端CORS配置');
    return;
  }

  if (!crossOrigin) {
    console.log('❌ 跨域请求失败 - 前端无法访问后端资源');
    console.log('💡 建议检查CORS Allow-Origin配置');
    return;
  }

  if (!rangeRequest) {
    console.log('❌ Range请求失败 - Video.js无法进行视频流播放');
    console.log('💡 建议检查后端Range请求支持');
    return;
  }

  console.log('✅ 所有测试通过，问题可能在于:');
  console.log('   1. Video.js库加载问题');
  console.log('   2. 前端组件初始化问题');
  console.log('   3. 浏览器安全策略限制');
  console.log('   4. 网络延迟或超时问题');
}

// 运行所有测试
async function runAllTests() {
  const results = [];

  results.push(await testCrossOriginRequest());
  results.push(await testVideoJSRangeRequest());
  results.push(await testCORSPreflight());
  results.push(await testBackendHealth());

  console.log('\n📊 测试结果汇总:');
  console.log('================');

  const testNames = [
    '跨域请求',
    'Range请求',
    'CORS预检',
    '后端健康'
  ];

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${testNames[index]}: ${result ? '✅ 通过' : '❌ 失败'}`);
  });

  const passedCount = results.filter(r => r).length;
  console.log(`\n🎯 总体结果: ${passedCount}/${results.length} 测试通过`);

  analyzeIssues(results);
}

// 执行测试
runAllTests().catch(error => {
  console.error('❌ 测试执行失败:', error.message);
  process.exit(1);
});
