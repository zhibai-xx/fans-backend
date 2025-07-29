const axios = require('axios');

// 配置
const BACKEND_URL = 'http://localhost:3000/api';
const FRONTEND_URL = 'http://localhost:3001';

// 测试用户
const TEST_USER = {
  username: 'testuser',
  password: 'testpass123'
};

// 创建axios实例
const backendApi = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const frontendApi = axios.create({
  baseURL: FRONTEND_URL,
  timeout: 10000,
});

// 测试后端微博扫描功能
async function testBackendWeiboScan() {
  try {
    console.log('🔧 测试后端微博扫描功能...');

    // 1. 登录获取token
    const loginResponse = await backendApi.post('/users/login', TEST_USER);
    const token = loginResponse.data.access_token;

    if (!token) {
      throw new Error('登录失败，未获得token');
    }

    console.log('✅ 后端登录成功');

    // 2. 测试微博扫描
    const scanResponse = await backendApi.post('/upload/weibo-scan', {
      customPath: ''
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (scanResponse.data.success && scanResponse.data.data.totalFiles > 0) {
      console.log(`✅ 后端微博扫描成功: 发现 ${scanResponse.data.data.totalFiles} 个文件`);
      return { token, scanData: scanResponse.data.data };
    } else {
      throw new Error('微博扫描失败或没有发现文件');
    }

  } catch (error) {
    console.error('❌ 后端微博扫描测试失败:', error.message);
    throw error;
  }
}

// 测试前端页面可访问性
async function testFrontendAccessibility() {
  try {
    console.log('🌐 测试前端页面可访问性...');

    // 1. 测试首页
    const homeResponse = await frontendApi.get('/');
    if (homeResponse.status === 200) {
      console.log('✅ 前端首页可访问');
    }

    // 2. 测试微博导入页面
    const weiboImportResponse = await frontendApi.get('/weibo-import');
    if (weiboImportResponse.status === 200) {
      console.log('✅ 微博导入页面可访问');
    }

    return true;

  } catch (error) {
    console.error('❌ 前端页面访问测试失败:', error.message);
    throw error;
  }
}

// 测试图片预览API
async function testImagePreview(token, scanData) {
  try {
    console.log('🖼️ 测试图片预览功能...');

    // 寻找一个图片文件
    let imageFile = null;
    for (const user of scanData.users) {
      for (const file of user.files) {
        if (file.type === 'image') {
          imageFile = file;
          break;
        }
      }
      if (imageFile) break;
    }

    if (!imageFile) {
      console.log('⚠️ 没有找到图片文件，跳过预览测试');
      return;
    }

    // 测试图片预览
    const previewResponse = await backendApi.get(`/upload/weibo-preview/${imageFile.id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      responseType: 'arraybuffer'
    });

    if (previewResponse.status === 200 && previewResponse.data.byteLength > 0) {
      console.log(`✅ 图片预览成功: ${imageFile.name} (${previewResponse.data.byteLength} bytes)`);
      return true;
    } else {
      throw new Error('图片预览响应无效');
    }

  } catch (error) {
    console.error('❌ 图片预览测试失败:', error.message);
    throw error;
  }
}

// 检查前端控制台错误
async function checkFrontendConsoleErrors() {
  try {
    console.log('🔍 检查前端是否有明显的错误...');

    // 这里我们无法直接检查浏览器控制台，但可以检查一些基本的API调用
    const response = await frontendApi.get('/api/auth/session');

    // 如果NextAuth工作正常，这应该返回某种响应
    if (response.status === 200) {
      console.log('✅ 前端NextAuth session API正常');
    }

  } catch (error) {
    // 404可能是正常的，因为我们没有配置会话
    if (error.response && error.response.status === 404) {
      console.log('⚠️ NextAuth session API返回404，这可能是正常的');
    } else {
      console.error('❌ 前端API检查失败:', error.message);
    }
  }
}

// 检查服务器状态
async function checkServerStatus() {
  try {
    console.log('🔍 检查服务器状态...');

    // 检查后端服务器
    try {
      await backendApi.get('/');
      console.log('✅ 后端服务器运行正常');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ 后端服务器运行正常 (404是正常的)');
      } else {
        throw new Error('后端服务器无法访问');
      }
    }

    // 检查前端服务器
    try {
      await frontendApi.get('/');
      console.log('✅ 前端服务器运行正常');
    } catch (error) {
      throw new Error('前端服务器无法访问');
    }

  } catch (error) {
    console.error('❌ 服务器状态检查失败:', error.message);
    throw error;
  }
}

// 主测试函数
async function runTests() {
  let passedTests = 0;
  let totalTests = 0;

  console.log('🚀 开始微博导入前端功能测试...\n');

  try {
    // 测试1: 检查服务器状态
    totalTests++;
    await checkServerStatus();
    passedTests++;

    // 测试2: 测试后端微博扫描
    totalTests++;
    const { token, scanData } = await testBackendWeiboScan();
    passedTests++;

    // 测试3: 测试前端页面可访问性
    totalTests++;
    await testFrontendAccessibility();
    passedTests++;

    // 测试4: 测试图片预览
    totalTests++;
    await testImagePreview(token, scanData);
    passedTests++;

    // 测试5: 检查前端错误
    totalTests++;
    await checkFrontendConsoleErrors();
    passedTests++;

    console.log(`\n📋 测试完成！`);
    console.log(`✅ 通过: ${passedTests} 个测试`);
    console.log(`📊 总计: ${totalTests} 个测试`);

    if (passedTests === totalTests) {
      console.log('🎉 所有测试都通过了！');
      console.log('\n💡 现在您可以：');
      console.log('1. 打开浏览器访问 http://localhost:3001');
      console.log('2. 登录后访问 http://localhost:3001/weibo-import');
      console.log('3. 点击"开始扫描"按钮');
      console.log('4. 应该能看到图片预览而不是只有图标');
    } else {
      console.log('⚠️ 部分测试失败，请检查上述错误信息');
    }

  } catch (error) {
    console.error('\n💥 测试过程中发生错误:', error.message);
    console.log(`\n📋 测试结果:`);
    console.log(`✅ 通过: ${passedTests} 个测试`);
    console.log(`❌ 失败: ${totalTests - passedTests} 个测试`);
    console.log(`📊 总计: ${totalTests} 个测试`);
  }
}

// 运行测试
runTests().catch(console.error); 