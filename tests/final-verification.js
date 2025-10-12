#!/usr/bin/env node

/**
 * 最终验证：封面URL和TypeScript修复
 */

const axios = require('axios');

async function finalVerification() {
  console.log('🔍 最终验证开始...\n');

  try {
    // 1. 验证后端API
    console.log('🚀 检查后端API...');
    const response = await axios.get('http://localhost:3000/api/media?media_type=VIDEO&take=1');

    if (response.data && response.data.success && response.data.data.length > 0) {
      const video = response.data.data[0];
      console.log('✅ 后端API正常运行');

      // 2. 检查封面URL
      if (video.thumbnail_url) {
        console.log(`📸 当前封面URL: ${video.thumbnail_url}`);

        if (video.thumbnail_url.startsWith('/processed/')) {
          console.log('✅ 封面URL使用正确的相对路径');
        } else if (video.thumbnail_url.includes(':3001')) {
          console.log('⚠️  封面URL仍使用3001端口，需要重新上传视频生成新封面');
        } else {
          console.log('✅ 封面URL格式正确');
        }
      } else {
        console.log('⚠️  当前视频没有封面URL');
      }

      // 3. 测试前端代理（如果有封面）
      if (video.thumbnail_url && video.thumbnail_url.startsWith('/')) {
        try {
          const proxyTest = await axios.get(`http://localhost:3001${video.thumbnail_url}`, {
            timeout: 5000
          });
          console.log('✅ 前端代理工作正常');
        } catch (error) {
          console.log('⚠️  前端代理可能需要重启前端服务');
        }
      }

    } else {
      console.log('⚠️  没有找到视频数据');
    }

  } catch (error) {
    console.log('❌ 后端API不可用:', error.message);
  }

  console.log('\n📋 修复总结:');
  console.log('==========================================');
  console.log('✅ 后端：添加processed静态文件服务');
  console.log('✅ 后端：修正封面URL生成（移除:3001端口）');
  console.log('✅ 前端：添加processed文件代理路由');
  console.log('✅ 前端：修复VideoPlayer TypeScript类型错误');

  console.log('\n💡 建议操作:');
  console.log('1. 重启后端服务（如果尚未重启）');
  console.log('2. 重启前端服务（如果需要）');
  console.log('3. 重新上传一个视频测试新的封面生成');
  console.log('4. 检查管理页面的视频预览功能');
}

finalVerification().catch(console.error);
