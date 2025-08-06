const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

// 测试用户凭据（管理员）
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123456'
};

let authToken = null;

async function login() {
  try {
    console.log('🔐 正在登录管理员账户...');
    const response = await axios.post(`${API_BASE_URL}/users/login`, ADMIN_CREDENTIALS);
    authToken = response.data.access_token;
    console.log('✅ 登录成功');
    return authToken;
  } catch (error) {
    console.error('❌ 登录失败:', error.response?.data?.message || error.message);
    return null;
  }
}

function getAuthHeaders() {
  return {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  };
}

async function testOperationLogsAPI() {
  console.log('\n📋 测试操作日志API...');

  try {
    // 测试获取操作日志列表
    console.log('📝 测试获取操作日志列表...');
    const response = await axios.get(`${API_BASE_URL}/admin/logs/operations?page=1&limit=10`, getAuthHeaders());
    console.log('✅ 获取操作日志成功:', {
      total: response.data.pagination?.total || 0,
      count: response.data.data?.length || 0
    });

    // 测试获取操作日志统计
    console.log('📊 测试获取操作日志统计...');
    const statsResponse = await axios.get(`${API_BASE_URL}/admin/logs/operations/stats?days=30`, getAuthHeaders());
    console.log('✅ 获取操作日志统计成功:', {
      totalCount: statsResponse.data.data?.totalCount || 0,
      successRate: statsResponse.data.data?.successRate || 0
    });

  } catch (error) {
    console.error('❌ 操作日志API测试失败:', error.response?.data?.message || error.message);
  }
}

async function testLoginLogsAPI() {
  console.log('\n🔑 测试登录日志API...');

  try {
    // 测试获取登录日志列表
    console.log('📝 测试获取登录日志列表...');
    const response = await axios.get(`${API_BASE_URL}/admin/logs/logins?page=1&limit=10`, getAuthHeaders());
    console.log('✅ 获取登录日志成功:', {
      total: response.data.pagination?.total || 0,
      count: response.data.data?.length || 0
    });

    // 测试获取登录日志统计
    console.log('📊 测试获取登录日志统计...');
    const statsResponse = await axios.get(`${API_BASE_URL}/admin/logs/logins/stats?days=30`, getAuthHeaders());
    console.log('✅ 获取登录日志统计成功:', {
      totalCount: statsResponse.data.data?.totalCount || 0,
      successRate: statsResponse.data.data?.successRate || 0
    });

  } catch (error) {
    console.error('❌ 登录日志API测试失败:', error.response?.data?.message || error.message);
  }
}

async function testUserActivityAPI() {
  console.log('\n👤 测试用户活跃度API...');

  try {
    const response = await axios.get(`${API_BASE_URL}/admin/logs/users/activity?page=1&limit=10&days=7`, getAuthHeaders());
    console.log('✅ 获取用户活跃度成功:', {
      total: response.data.pagination?.total || 0,
      count: response.data.data?.length || 0
    });
  } catch (error) {
    console.error('❌ 用户活跃度API测试失败:', error.response?.data?.message || error.message);
  }
}

async function runTests() {
  console.log('🚀 开始测试日志管理API...\n');

  // 先登录获取token
  const token = await login();
  if (!token) {
    console.error('❌ 无法获取认证token，测试终止');
    return;
  }

  // 等待一秒让登录日志被记录
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 运行所有测试
  await testOperationLogsAPI();
  await testLoginLogsAPI();
  await testUserActivityAPI();

  console.log('\n✨ 日志管理API测试完成！');
}

// 运行测试
runTests().catch(console.error);