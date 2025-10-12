/**
 * 全流程视频分析
 * 从数据库存储到前端播放的完整链路分析
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

console.log('🔍 全流程视频分析开始...\n');

// 第1步：分析数据库中的视频数据
async function step1_AnalyzeDatabaseData() {
  console.log('📊 第1步：分析数据库中的视频数据');
  console.log('=====================================');

  try {
    // 获取具体的视频记录
    const video = await prisma.media.findFirst({
      where: {
        media_type: 'VIDEO'
      },
      include: {
        video_qualities: true
      }
    });

    if (!video) {
      console.log('❌ 数据库中没有视频记录');
      return null;
    }

    console.log('✅ 视频记录详情:');
    console.log('  ID:', video.id);
    console.log('  标题:', video.title);
    console.log('  原始URL:', video.url);
    console.log('  缩略图URL:', video.thumbnail_url);
    console.log('  状态:', video.status);
    console.log('  媒体类型:', video.media_type);
    console.log('  文件大小:', video.size, 'bytes');
    console.log('  时长:', video.duration, '秒');

    console.log('\n🎬 视频质量信息:');
    if (video.video_qualities && video.video_qualities.length > 0) {
      video.video_qualities.forEach((quality, index) => {
        console.log(`  ${index + 1}. 质量: ${quality.quality}`);
        console.log(`     URL: ${quality.url}`);
        console.log(`     大小: ${quality.size} bytes`);
        console.log(`     分辨率: ${quality.width}x${quality.height}`);
        console.log('');
      });
    } else {
      console.log('  ❌ 无视频质量信息');
    }

    return video;
  } catch (error) {
    console.error('❌ 数据库查询失败:', error.message);
    return null;
  }
}

// 第2步：检查后端文件服务
async function step2_CheckBackendFileService(video) {
  console.log('\n🌐 第2步：检查后端文件服务');
  console.log('=====================================');

  if (!video) {
    console.log('❌ 没有视频数据，跳过检查');
    return;
  }

  const urlsToCheck = [];

  // 添加原始URL
  if (video.url) {
    urlsToCheck.push({
      type: '原始视频URL',
      url: video.url,
      expectedType: 'video/'
    });
  }

  // 添加缩略图URL
  if (video.thumbnail_url) {
    urlsToCheck.push({
      type: '缩略图URL',
      url: video.thumbnail_url,
      expectedType: 'image/'
    });
  }

  // 添加视频质量URL
  if (video.video_qualities) {
    video.video_qualities.forEach(quality => {
      urlsToCheck.push({
        type: `视频质量 ${quality.quality}`,
        url: quality.url,
        expectedType: 'video/'
      });
    });
  }

  for (const item of urlsToCheck) {
    console.log(`\n检查 ${item.type}:`);
    console.log(`  URL: ${item.url}`);

    try {
      // 检查URL格式
      let testUrl = item.url;
      if (!testUrl.startsWith('http')) {
        // 如果是相对路径，构造完整URL
        if (testUrl.startsWith('uploads/')) {
          testUrl = `http://localhost:3000/api/upload/file/${testUrl.replace('uploads/', '')}`;
        } else if (testUrl.startsWith('/')) {
          testUrl = `http://localhost:3000${testUrl}`;
        } else {
          testUrl = `http://localhost:3000/api/upload/file/${testUrl}`;
        }
      }

      console.log(`  测试URL: ${testUrl}`);

      const response = await axios.head(testUrl, {
        timeout: 5000,
        validateStatus: () => true
      });

      console.log(`  状态: ${response.status}`);
      console.log(`  内容类型: ${response.headers['content-type'] || 'N/A'}`);
      console.log(`  文件大小: ${response.headers['content-length'] || 'N/A'} bytes`);
      console.log(`  支持Range: ${response.headers['accept-ranges'] || 'N/A'}`);

      if (response.status === 200) {
        const contentType = response.headers['content-type'];
        if (contentType && contentType.startsWith(item.expectedType)) {
          console.log(`  ✅ 文件可访问且类型正确`);
        } else {
          console.log(`  ❌ 文件类型不匹配，期望: ${item.expectedType}，实际: ${contentType}`);
        }
      } else {
        console.log(`  ❌ 文件无法访问`);
      }

    } catch (error) {
      console.log(`  ❌ 请求失败: ${error.message}`);
    }
  }
}

// 第3步：检查前端API请求
async function step3_CheckFrontendAPI(video) {
  console.log('\n🔗 第3步：检查前端API请求');
  console.log('=====================================');

  if (!video) {
    console.log('❌ 没有视频数据，跳过检查');
    return;
  }

  try {
    // 模拟前端获取媒体数据的API请求
    const apiUrl = 'http://localhost:3001/api/admin/media';
    console.log(`测试前端API: ${apiUrl}`);

    const response = await axios.get(apiUrl, {
      params: { page: 1, limit: 5, media_type: 'VIDEO' },
      timeout: 10000,
      validateStatus: () => true
    });

    console.log(`  状态: ${response.status}`);
    console.log(`  响应类型: ${response.headers['content-type'] || 'N/A'}`);

    if (response.status === 200 && response.data) {
      console.log(`  ✅ API请求成功`);

      if (response.data.data && response.data.data.length > 0) {
        const firstVideo = response.data.data[0];
        console.log(`  📊 返回的视频数据示例:`);
        console.log(`     ID: ${firstVideo.id}`);
        console.log(`     URL: ${firstVideo.url}`);
        console.log(`     缩略图: ${firstVideo.thumbnail_url}`);
        console.log(`     视频质量数量: ${firstVideo.video_qualities?.length || 0}`);

        if (firstVideo.video_qualities && firstVideo.video_qualities.length > 0) {
          console.log(`     第一个质量URL: ${firstVideo.video_qualities[0].url}`);
        }
      } else {
        console.log(`  ⚠️ API返回空数据`);
      }
    } else if (response.status === 401) {
      console.log(`  ⚠️ API需要认证，这是正常的`);
    } else {
      console.log(`  ❌ API请求失败`);
    }

  } catch (error) {
    console.log(`  ❌ API请求异常: ${error.message}`);
  }
}

// 第4步：分析前端URL处理逻辑
function step4_AnalyzeFrontendURLProcessing(video) {
  console.log('\n🔧 第4步：分析前端URL处理逻辑');
  console.log('=====================================');

  if (!video) {
    console.log('❌ 没有视频数据，跳过分析');
    return;
  }

  // 模拟当前的formatVideoUrl函数
  function formatVideoUrl(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return '';
    }

    const cleanUrl = url.trim();

    console.log(`    输入: ${cleanUrl}`);

    // 如果是绝对URL且指向后端3000端口，转换为相对路径让Next.js代理处理
    if (cleanUrl.startsWith('http://localhost:3000/')) {
      const path = cleanUrl.replace('http://localhost:3000/', '');
      // 如果是API路径，去掉api前缀因为Next.js会自动添加
      if (path.startsWith('api/')) {
        const relativePath = `/${path}`;
        console.log(`    规则: 后端绝对URL转相对路径`);
        console.log(`    输出: ${relativePath}`);
        return relativePath;
      } else {
        // processed等静态文件路径，直接转为相对路径
        const relativePath = `/${path}`;
        console.log(`    规则: 后端静态文件转相对路径`);
        console.log(`    输出: ${relativePath}`);
        return relativePath;
      }
    }

    // 如果是其他绝对URL，直接返回
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      console.log(`    规则: 外部绝对URL`);
      console.log(`    输出: ${cleanUrl}`);
      return cleanUrl;
    }

    // 如果已经是相对路径，直接返回
    if (cleanUrl.startsWith('/')) {
      console.log(`    规则: 已是相对路径`);
      console.log(`    输出: ${cleanUrl}`);
      return cleanUrl;
    }

    // 处理数据库存储的相对路径格式（如uploads/xxx）
    if (cleanUrl.startsWith('uploads/')) {
      const pathParts = cleanUrl.replace('uploads/', '');
      const relativePath = `/api/upload/file/${pathParts}`;
      console.log(`    规则: uploads路径转API路径`);
      console.log(`    输出: ${relativePath}`);
      return relativePath;
    }

    // 其他情况，作为文件路径处理
    const relativePath = `/api/upload/file/${cleanUrl}`;
    console.log(`    规则: 默认路径转API路径`);
    console.log(`    输出: ${relativePath}`);
    return relativePath;
  }

  console.log('🔄 URL格式化测试:');

  // 测试原始URL
  if (video.url) {
    console.log(`\n  测试原始URL:`);
    formatVideoUrl(video.url);
  }

  // 测试缩略图URL
  if (video.thumbnail_url) {
    console.log(`\n  测试缩略图URL:`);
    formatVideoUrl(video.thumbnail_url);
  }

  // 测试视频质量URL
  if (video.video_qualities && video.video_qualities.length > 0) {
    video.video_qualities.forEach((quality, index) => {
      console.log(`\n  测试视频质量 ${quality.quality} URL:`);
      formatVideoUrl(quality.url);
    });
  }
}

// 第5步：检查实际的前端访问
async function step5_CheckFrontendAccess(video) {
  console.log('\n🌐 第5步：检查实际的前端访问');
  console.log('=====================================');

  if (!video) {
    console.log('❌ 没有视频数据，跳过检查');
    return;
  }

  // 模拟formatVideoUrl处理后的URL
  const testUrls = [];

  if (video.url) {
    if (video.url.startsWith('uploads/')) {
      const pathParts = video.url.replace('uploads/', '');
      testUrls.push(`/api/upload/file/${pathParts}`);
    } else if (video.url.startsWith('/')) {
      testUrls.push(video.url);
    }
  }

  if (video.video_qualities && video.video_qualities.length > 0) {
    video.video_qualities.forEach(quality => {
      if (quality.url.startsWith('http://localhost:3000/')) {
        const path = quality.url.replace('http://localhost:3000/', '');
        testUrls.push(`/${path}`);
      }
    });
  }

  for (const url of testUrls) {
    console.log(`\n测试前端访问: ${url}`);

    try {
      const frontendUrl = `http://localhost:3001${url}`;
      console.log(`  完整URL: ${frontendUrl}`);

      const response = await axios.head(frontendUrl, {
        timeout: 10000,
        validateStatus: () => true
      });

      console.log(`  状态: ${response.status}`);
      console.log(`  内容类型: ${response.headers['content-type'] || 'N/A'}`);
      console.log(`  文件大小: ${response.headers['content-length'] || 'N/A'} bytes`);

      if (response.status === 200) {
        console.log(`  ✅ 前端可以正常访问`);

        // 测试Range请求
        try {
          const rangeResponse = await axios.get(frontendUrl, {
            headers: { 'Range': 'bytes=0-1023' },
            timeout: 5000,
            responseType: 'stream',
            validateStatus: () => true
          });

          if (rangeResponse.data && rangeResponse.data.destroy) {
            rangeResponse.data.destroy();
          }

          console.log(`  Range请求: ${rangeResponse.status === 206 ? '✅' : '❌'} ${rangeResponse.status}`);
        } catch (rangeError) {
          console.log(`  Range请求: ❌ ${rangeError.message}`);
        }
      } else {
        console.log(`  ❌ 前端访问失败`);
      }

    } catch (error) {
      console.log(`  ❌ 请求异常: ${error.message}`);
    }
  }
}

// 运行完整分析
async function runFullAnalysis() {
  const video = await step1_AnalyzeDatabaseData();
  await step2_CheckBackendFileService(video);
  await step3_CheckFrontendAPI(video);
  step4_AnalyzeFrontendURLProcessing(video);
  await step5_CheckFrontendAccess(video);

  console.log('\n📊 全流程分析总结');
  console.log('=====================================');

  console.log('🔍 已检查的环节:');
  console.log('1. ✅ 数据库中的视频数据存储');
  console.log('2. ✅ 后端文件服务可访问性');
  console.log('3. ✅ 前端API请求响应');
  console.log('4. ✅ 前端URL处理逻辑');
  console.log('5. ✅ 实际的前端文件访问');

  console.log('\n💡 可能的问题点:');
  console.log('- 如果数据库URL格式不一致');
  console.log('- 如果后端文件服务配置有误');
  console.log('- 如果Next.js rewrites配置不正确');
  console.log('- 如果Video.js组件配置有问题');
  console.log('- 如果CORS或Range请求支持有问题');

  console.log('\n🚀 下一步建议:');
  console.log('根据以上分析结果，重点检查失败的环节');

  await prisma.$disconnect();
}

runFullAnalysis().catch(error => {
  console.error('❌ 全流程分析失败:', error.message);
  process.exit(1);
});
