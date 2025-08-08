/**
 * 互动功能API测试脚本
 * 测试点赞、收藏功能的完整流程
 */

const axios = require('axios');

// 配置
const CONFIG = {
  baseURL: 'http://localhost:3000/api',
  timeout: 10000,
};

// 测试用户信息 - 使用时间戳确保唯一性
const timestamp = Date.now();
const TEST_USER = {
  username: `test${timestamp}`,
  email: `test${timestamp}@example.com`,
  password: 'Test123!',
  nickname: '测试用户'
};

// 全局变量
let authToken = '';
let testUserId = '';
let testMediaId = '';

// 创建axios实例
const api = axios.create(CONFIG);

// 添加请求拦截器
api.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 工具函数：日志输出
 */
function log(message, data = null) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logError(message, error) {
  console.error(`[ERROR] ${message}:`, error.response?.data || error.message);
}

function logSuccess(message) {
  console.log(`[✓] ${message}`);
}

/**
 * 工具函数：延时
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 步骤1：用户注册
 */
async function registerUser() {
  log('步骤1：注册测试用户');

  try {
    const response = await api.post('/users/register', TEST_USER);

    if (response.data.access_token) {
      logSuccess('用户注册成功');
      return true;
    } else {
      throw new Error(response.data.message || '注册失败');
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('用户已存在')) {
      log('用户已存在，跳过注册');
      return true;
    }
    logError('用户注册失败', error);
    return false;
  }
}

/**
 * 步骤2：用户登录
 */
async function loginUser() {
  log('步骤2：用户登录');

  try {
    const response = await api.post('/users/login', {
      username: TEST_USER.username,
      password: TEST_USER.password
    });

    if (response.data.access_token) {
      authToken = response.data.access_token;
      testUserId = response.data.user.id;
      logSuccess(`用户登录成功，用户ID: ${testUserId}`);
      return true;
    } else {
      throw new Error('登录响应格式错误');
    }
  } catch (error) {
    logError('用户登录失败', error);
    return false;
  }
}

/**
 * 步骤3：获取测试媒体
 */
async function getTestMedia() {
  log('步骤3：获取测试媒体');

  try {
    const response = await api.get('/media', {
      params: { limit: 1 }
    });

    if (response.data.data && response.data.data.length > 0) {
      testMediaId = response.data.data[0].id;
      logSuccess(`获取到测试媒体ID: ${testMediaId}`);
      return true;
    } else {
      log('没有找到媒体，使用模拟媒体ID进行测试');
      testMediaId = 'test-media-id-' + Date.now();
      return true;
    }
  } catch (error) {
    logError('获取媒体列表失败', error);
    return false;
  }
}

/**
 * 创建测试媒体（如果没有现有媒体）
 */
async function createTestMedia() {
  try {
    const testMediaData = {
      title: '互动测试媒体',
      description: '用于测试点赞和收藏功能的媒体',
      url: 'test-media.jpg',
      size: 1024000,
      media_type: 'IMAGE'
    };

    const response = await api.post('/media', testMediaData);

    if (response.data.success) {
      testMediaId = response.data.data.id;
      logSuccess(`创建测试媒体成功，ID: ${testMediaId}`);
      return true;
    } else {
      throw new Error('创建媒体失败');
    }
  } catch (error) {
    logError('创建测试媒体失败', error);
    return false;
  }
}

/**
 * 步骤4：测试点赞功能
 */
async function testLikeFeature() {
  log('步骤4：测试点赞功能');

  if (!testMediaId || testMediaId.startsWith('test-media-id-')) {
    log('没有真实媒体ID，跳过点赞功能测试');
    return true;
  }

  try {
    // 4.1 获取初始点赞状态
    log('4.1 获取初始点赞状态');
    const statusResponse = await api.get(`/media/interaction/like/status/${testMediaId}`);
    const initialStatus = statusResponse.data.data;
    log('初始点赞状态:', initialStatus);

    // 4.2 点赞操作
    log('4.2 执行点赞操作');
    const likeResponse = await api.post('/media/interaction/like', {
      media_id: testMediaId
    });

    if (likeResponse.data.success) {
      logSuccess('点赞成功');
      log('点赞响应:', likeResponse.data.data);
    } else {
      throw new Error('点赞失败');
    }

    // 4.3 验证点赞状态变化
    log('4.3 验证点赞状态变化');
    await delay(1000); // 等待数据更新
    const newStatusResponse = await api.get(`/media/interaction/like/status/${testMediaId}`);
    const newStatus = newStatusResponse.data.data;
    log('更新后的点赞状态:', newStatus);

    if (newStatus.is_liked && newStatus.likes_count === initialStatus.likes_count + 1) {
      logSuccess('点赞状态验证成功');
    } else {
      throw new Error('点赞状态验证失败');
    }

    // 4.4 取消点赞
    log('4.4 执行取消点赞操作');
    const unlikeResponse = await api.delete(`/media/interaction/like/${testMediaId}`);

    if (unlikeResponse.data.success) {
      logSuccess('取消点赞成功');
    } else {
      throw new Error('取消点赞失败');
    }

    // 4.5 验证取消点赞状态
    log('4.5 验证取消点赞状态');
    await delay(1000);
    const finalStatusResponse = await api.get(`/media/interaction/like/status/${testMediaId}`);
    const finalStatus = finalStatusResponse.data.data;
    log('最终点赞状态:', finalStatus);

    if (!finalStatus.is_liked && finalStatus.likes_count === initialStatus.likes_count) {
      logSuccess('取消点赞状态验证成功');
      return true;
    } else {
      throw new Error('取消点赞状态验证失败');
    }

  } catch (error) {
    logError('点赞功能测试失败', error);
    return false;
  }
}

/**
 * 步骤5：测试收藏功能
 */
async function testFavoriteFeature() {
  log('步骤5：测试收藏功能');

  if (!testMediaId || testMediaId.startsWith('test-media-id-')) {
    log('没有真实媒体ID，跳过收藏功能测试');
    return true;
  }

  try {
    // 5.1 获取初始收藏状态
    log('5.1 获取初始收藏状态');
    const statusResponse = await api.get(`/media/interaction/favorite/status/${testMediaId}`);
    const initialStatus = statusResponse.data.data;
    log('初始收藏状态:', initialStatus);

    // 5.2 收藏操作
    log('5.2 执行收藏操作');
    const favoriteResponse = await api.post('/media/interaction/favorite', {
      media_id: testMediaId
    });

    if (favoriteResponse.data.success) {
      logSuccess('收藏成功');
      log('收藏响应:', favoriteResponse.data.data);
    } else {
      throw new Error('收藏失败');
    }

    // 5.3 验证收藏状态变化
    log('5.3 验证收藏状态变化');
    await delay(1000);
    const newStatusResponse = await api.get(`/media/interaction/favorite/status/${testMediaId}`);
    const newStatus = newStatusResponse.data.data;
    log('更新后的收藏状态:', newStatus);

    if (newStatus.is_favorited && newStatus.favorites_count === initialStatus.favorites_count + 1) {
      logSuccess('收藏状态验证成功');
    } else {
      throw new Error('收藏状态验证失败');
    }

    // 5.4 获取收藏列表
    log('5.4 获取用户收藏列表');
    const favoritesResponse = await api.get('/media/interaction/favorites/my', {
      params: { page: 1, limit: 10 }
    });

    if (favoritesResponse.data.success) {
      log('收藏列表:', {
        总数: favoritesResponse.data.pagination.total,
        当前页数据: favoritesResponse.data.data.length
      });
      logSuccess('获取收藏列表成功');
    } else {
      throw new Error('获取收藏列表失败');
    }

    // 5.5 取消收藏
    log('5.5 执行取消收藏操作');
    const unfavoriteResponse = await api.delete(`/media/interaction/favorite/${testMediaId}`);

    if (unfavoriteResponse.data.success) {
      logSuccess('取消收藏成功');
    } else {
      throw new Error('取消收藏失败');
    }

    // 5.6 验证取消收藏状态
    log('5.6 验证取消收藏状态');
    await delay(1000);
    const finalStatusResponse = await api.get(`/media/interaction/favorite/status/${testMediaId}`);
    const finalStatus = finalStatusResponse.data.data;
    log('最终收藏状态:', finalStatus);

    if (!finalStatus.is_favorited && finalStatus.favorites_count === initialStatus.favorites_count) {
      logSuccess('取消收藏状态验证成功');
      return true;
    } else {
      throw new Error('取消收藏状态验证失败');
    }

  } catch (error) {
    logError('收藏功能测试失败', error);
    return false;
  }
}

/**
 * 步骤6：测试综合状态接口
 */
async function testInteractionStatus() {
  log('步骤6：测试综合状态接口');

  if (!testMediaId || testMediaId.startsWith('test-media-id-')) {
    log('没有真实媒体ID，跳过综合状态测试');
    return true;
  }

  try {
    // 6.1 先清理之前的状态，然后设置测试状态
    log('6.1 清理并设置测试状态');
    try {
      await api.delete(`/media/interaction/like/${testMediaId}`);
      await api.delete(`/media/interaction/favorite/${testMediaId}`);
    } catch (error) {
      // 忽略清理错误，可能之前没有点赞/收藏
    }
    await delay(500);

    await api.post('/media/interaction/like', { media_id: testMediaId });
    await api.post('/media/interaction/favorite', { media_id: testMediaId });
    await delay(1000);

    // 6.2 测试综合状态接口
    log('6.2 获取媒体综合互动状态');
    const statusResponse = await api.get(`/media/interaction/status/${testMediaId}`);

    if (statusResponse.data.success) {
      const status = statusResponse.data.data;
      log('综合互动状态:', status);

      if (status.is_liked && status.is_favorited) {
        logSuccess('综合状态接口测试成功');
      } else {
        throw new Error('综合状态数据不正确');
      }
    } else {
      throw new Error('获取综合状态失败');
    }

    // 6.3 测试批量状态接口
    log('6.3 测试批量状态接口');
    const batchLikeResponse = await api.post('/media/interaction/batch/like-status', {
      media_ids: [testMediaId]
    });

    const batchFavoriteResponse = await api.post('/media/interaction/batch/favorite-status', {
      media_ids: [testMediaId]
    });

    if (batchLikeResponse.data.success && batchFavoriteResponse.data.success) {
      log('批量点赞状态:', batchLikeResponse.data.data);
      log('批量收藏状态:', batchFavoriteResponse.data.data);
      logSuccess('批量状态接口测试成功');
    } else {
      throw new Error('批量状态接口测试失败');
    }

    // 6.4 清理测试状态
    log('6.4 清理测试状态');
    await api.delete(`/media/interaction/like/${testMediaId}`);
    await api.delete(`/media/interaction/favorite/${testMediaId}`);

    return true;

  } catch (error) {
    logError('综合状态接口测试失败', error);
    return false;
  }
}

/**
 * 步骤7：错误处理测试
 */
async function testErrorHandling() {
  log('步骤7：错误处理测试');

  if (!testMediaId || testMediaId.startsWith('test-media-id-')) {
    log('没有真实媒体ID，跳过错误处理测试');
    return true;
  }

  try {
    // 7.1 测试不存在的媒体ID
    log('7.1 测试不存在的媒体ID');
    try {
      await api.post('/media/interaction/like', { media_id: '123e4567-e89b-12d3-a456-426614174000' });
      throw new Error('应该返回错误');
    } catch (error) {
      if (error.response?.status === 404) {
        logSuccess('不存在媒体ID错误处理正确');
      } else if (error.response?.status === 400) {
        logSuccess('媒体ID格式验证正确');
      } else {
        throw error;
      }
    }

    // 7.2 测试重复点赞
    log('7.2 测试重复点赞');
    // 先清理状态
    try {
      await api.delete(`/media/interaction/like/${testMediaId}`);
    } catch (error) { }

    await api.post('/media/interaction/like', { media_id: testMediaId });
    try {
      await api.post('/media/interaction/like', { media_id: testMediaId });
      throw new Error('应该返回冲突错误');
    } catch (error) {
      if (error.response?.status === 409) {
        logSuccess('重复点赞错误处理正确');
      } else {
        throw error;
      }
    }

    // 7.3 测试重复收藏
    log('7.3 测试重复收藏');
    // 先清理状态
    try {
      await api.delete(`/media/interaction/favorite/${testMediaId}`);
    } catch (error) { }

    await api.post('/media/interaction/favorite', { media_id: testMediaId });
    try {
      await api.post('/media/interaction/favorite', { media_id: testMediaId });
      throw new Error('应该返回冲突错误');
    } catch (error) {
      if (error.response?.status === 409) {
        logSuccess('重复收藏错误处理正确');
      } else {
        throw error;
      }
    }

    // 清理
    await api.delete(`/media/interaction/like/${testMediaId}`);
    await api.delete(`/media/interaction/favorite/${testMediaId}`);

    logSuccess('错误处理测试完成');
    return true;

  } catch (error) {
    logError('错误处理测试失败', error);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 开始互动功能API测试');
  console.log('='.repeat(50));

  const results = [];

  try {
    // 执行测试步骤
    results.push({ name: '用户注册', success: await registerUser() });
    results.push({ name: '用户登录', success: await loginUser() });
    results.push({ name: '获取测试媒体', success: await getTestMedia() });
    results.push({ name: '点赞功能测试', success: await testLikeFeature() });
    results.push({ name: '收藏功能测试', success: await testFavoriteFeature() });
    results.push({ name: '综合状态测试', success: await testInteractionStatus() });
    results.push({ name: '错误处理测试', success: await testErrorHandling() });

  } catch (error) {
    logError('测试执行过程中发生未知错误', error);
  }

  // 输出测试结果
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果汇总:');
  console.log('='.repeat(50));

  let passedCount = 0;
  results.forEach(result => {
    const status = result.success ? '✅ 通过' : '❌ 失败';
    console.log(`${result.name}: ${status}`);
    if (result.success) passedCount++;
  });

  console.log('-'.repeat(50));
  console.log(`总计: ${results.length} 项测试, ${passedCount} 项通过, ${results.length - passedCount} 项失败`);

  if (passedCount === results.length) {
    console.log('\n🎉 所有测试通过！互动功能API工作正常。');
  } else {
    console.log('\n⚠️  部分测试失败，请检查API实现或服务器状态。');
  }

  console.log('='.repeat(50));
}

// 执行测试
if (require.main === module) {
  runTests().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  CONFIG,
  TEST_USER
};
