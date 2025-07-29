const axios = require('axios');

// 配置
const BASE_URL = 'http://localhost:3000/api';
const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
  email: 'test@example.com'
};

// 创建axios实例
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 全局变量
let authToken = null;
let scanResults = null;

// 获取JWT Token
async function getAuthToken() {
  try {
    console.log('🔐 正在获取认证令牌...');

    // 尝试登录
    try {
      const loginResponse = await api.post('/users/login', {
        username: TEST_USER.username,
        password: TEST_USER.password,
      });

      if (loginResponse.data && loginResponse.data.access_token) {
        authToken = loginResponse.data.access_token;
        console.log('✅ 登录成功，获得认证令牌');
        return authToken;
      }
    } catch (loginError) {
      console.log('📝 登录失败，尝试注册新用户...');

      // 如果登录失败，尝试注册
      try {
        const registerResponse = await api.post('/users/register', {
          username: TEST_USER.username,
          password: TEST_USER.password,
          email: TEST_USER.email,
        });

        if (registerResponse.data && registerResponse.data.access_token) {
          authToken = registerResponse.data.access_token;
          console.log('✅ 注册成功，获得认证令牌');
          return authToken;
        }
      } catch (registerError) {
        console.log('❌ 注册也失败了:', registerError.response?.data?.message || registerError.message);
      }
    }

    throw new Error('无法获得认证令牌');
  } catch (error) {
    console.error('❌ 认证失败:', error.response?.data?.message || error.message);
    throw error;
  }
}

// 设置认证头
function setAuthHeader(token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// 测试微博文件扫描
async function testWeiboScan() {
  try {
    console.log('📁 开始测试微博文件扫描...');

    const response = await api.post('/upload/weibo-scan', {
      customPath: '' // 使用默认路径
    });

    if (response.data && response.data.success) {
      scanResults = response.data.data;
      console.log('✅ 微博文件扫描成功！');
      console.log(`📊 扫描结果: 发现 ${scanResults.users.length} 个用户，${scanResults.totalFiles} 个文件`);

      // 显示详细信息
      scanResults.users.forEach((user, index) => {
        console.log(`   用户 ${index + 1}: ${user.userId} (${user.totalFiles} 个文件)`);
      });

      return scanResults;
    } else {
      throw new Error('扫描响应格式不正确');
    }
  } catch (error) {
    console.error('❌ 微博文件扫描失败:', error.response?.data?.message || error.message);
    throw error;
  }
}

// 测试文件预览
async function testFilePreview() {
  try {
    if (!scanResults || !scanResults.users || scanResults.users.length === 0) {
      console.log('⚠️ 没有扫描结果，跳过预览测试');
      return;
    }

    console.log('🖼️ 开始测试文件预览...');

    // 获取第一个用户的第一个文件
    const firstUser = scanResults.users[0];
    if (!firstUser.files || firstUser.files.length === 0) {
      console.log('⚠️ 没有可预览的文件');
      return;
    }

    const firstFile = firstUser.files[0];
    console.log(`📄 预览文件: ${firstFile.name} (ID: ${firstFile.id})`);

    const response = await api.get(`/upload/weibo-preview/${firstFile.id}`, {
      responseType: 'stream'
    });

    if (response.status === 200) {
      console.log('✅ 文件预览成功！');
      console.log(`📊 Content-Type: ${response.headers['content-type']}`);
      console.log(`📊 文件大小: ${response.headers['content-length'] || '未知'} bytes`);
      return true;
    } else {
      throw new Error(`预览失败，状态码: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ 文件预览失败:', error.response?.data?.message || error.message);
    throw error;
  }
}

// 测试批量上传
async function testBatchUpload() {
  try {
    if (!scanResults || !scanResults.users || scanResults.users.length === 0) {
      console.log('⚠️ 没有扫描结果，跳过批量上传测试');
      return;
    }

    console.log('📤 开始测试批量上传...');

    // 获取前3个文件进行测试
    const testFiles = [];
    for (const user of scanResults.users) {
      for (const file of user.files) {
        testFiles.push(file.path);
        if (testFiles.length >= 3) break;
      }
      if (testFiles.length >= 3) break;
    }

    if (testFiles.length === 0) {
      console.log('⚠️ 没有可上传的文件');
      return;
    }

    console.log(`📊 准备上传 ${testFiles.length} 个文件`);

    const response = await api.post('/upload/weibo-batch-upload', {
      selectedFiles: testFiles
    });

    if (response.data && response.data.success) {
      console.log('✅ 批量上传测试成功！');
      console.log(`📊 上传结果: ${response.data.data.length} 个文件处理完成`);
      return response.data.data;
    } else {
      throw new Error('批量上传响应格式不正确');
    }
  } catch (error) {
    console.error('❌ 批量上传失败:', error.response?.data?.message || error.message);
    throw error;
  }
}

// 主测试函数
async function runTest() {
  let passedTests = 0;
  let totalTests = 0;

  try {
    console.log('🚀 开始微博扫描功能测试...\n');

    // 测试1: 获取认证令牌
    totalTests++;
    await getAuthToken();
    setAuthHeader(authToken);
    passedTests++;

    // 测试2: 微博文件扫描
    totalTests++;
    await testWeiboScan();
    passedTests++;

    // 测试3: 文件预览
    totalTests++;
    await testFilePreview();
    passedTests++;

    // 测试4: 批量上传
    totalTests++;
    await testBatchUpload();
    passedTests++;

    console.log(`\n📋 测试完成！`);
    console.log(`✅ 通过: ${passedTests} 个测试`);
    console.log(`📊 总计: ${totalTests} 个测试`);

    if (passedTests === totalTests) {
      console.log('🎉 所有测试都通过了！');
    } else {
      console.log('⚠️ 部分测试失败，请检查问题');
    }

  } catch (error) {
    console.error('\n💥 测试过程中发生错误:', error.message);
    console.log(`\n📋 测试结果:`);
    console.log(`✅ 通过: ${passedTests} 个测试`);
    console.log(`❌ 失败: ${totalTests - passedTests} 个测试`);
    console.log(`📊 总计: ${totalTests} 个测试`);
  }
}

// 检查服务器是否运行
async function checkServer() {
  try {
    await api.get('/');
    return true;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return true; // 404是正常的，说明服务器在运行
    }
    return false;
  }
}

// 启动测试
async function main() {
  console.log('🔍 检查服务器状态...');

  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ 服务器未运行，请先启动后端服务');
    process.exit(1);
  }

  console.log('✅ 服务器运行正常\n');
  await runTest();
}

// 运行主函数
main().catch(console.error); 