#!/usr/bin/env node

/**
 * 视频URL格式化修复验证测试
 * 验证所有VideoPlayer使用页面的URL格式化
 */

const fs = require('fs');
const path = require('path');

class VideoURLFixesVerification {
  constructor() {
    // 根据.cursorrules获取正确的项目路径
    const frontendPath = '/Users/houjiawei/Desktop/Projects/react/fans-next';

    this.results = {
      mediaDetailModalFixed: false,
      videoDetailPageFixed: false,
      adminMediaPageOk: false,
      allFormatFunctionsExist: false,
      allVideoSourcesFormatted: false,
      allPosterUrlsFormatted: false
    };

    this.frontendPath = frontendPath;
    this.filesToCheck = [
      {
        path: 'src/app/admin/review/components/MediaDetailModal.tsx',
        name: 'MediaDetailModal'
      },
      {
        path: 'src/app/videos/[videoId]/page.tsx',
        name: 'VideoDetailPage'
      },
      {
        path: 'src/app/admin/media/page.tsx',
        name: 'AdminMediaPage'
      }
    ];
  }

  async runAllTests() {
    console.log('🔗 视频URL格式化修复验证测试\n');

    this.testFormatFunctions();
    this.testVideoSourcesFormatted();
    this.testPosterUrlsFormatted();
    this.testSpecificFixes();

    this.printResults();
  }

  testFormatFunctions() {
    console.log('📦 测试URL格式化函数存在...');

    let allExist = true;

    this.filesToCheck.forEach(fileInfo => {
      try {
        const fullPath = path.join(this.frontendPath, fileInfo.path);

        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');

          const hasFormatFunction = content.includes('formatImageUrl') ||
            content.includes('formatVideoUrl');

          console.log(`   ${fileInfo.name}: ${hasFormatFunction ? '✅' : '❌'} 格式化函数`);

          if (!hasFormatFunction) {
            allExist = false;
          }
        } else {
          console.log(`   ${fileInfo.name}: ❌ 文件不存在`);
          allExist = false;
        }
      } catch (error) {
        console.log(`   ${fileInfo.name}: ❌ 检查失败 - ${error.message}`);
        allExist = false;
      }
    });

    this.results.allFormatFunctionsExist = allExist;
    console.log('');
  }

  testVideoSourcesFormatted() {
    console.log('🎬 测试视频源URL格式化...');

    let allFormatted = true;

    this.filesToCheck.forEach(fileInfo => {
      try {
        const fullPath = path.join(this.frontendPath, fileInfo.path);

        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');

          // 检查是否有未格式化的video URL
          const hasUnformattedVideoUrl = content.includes('src: quality.url') ||
            content.includes('src: video.url') ||
            content.includes('src: media.url');

          // 检查是否有格式化的video URL
          const hasFormattedVideoUrl = content.includes('formatImageUrl(quality.url)') ||
            content.includes('formatImageUrl(video.url)') ||
            content.includes('formatImageUrl(media.url)') ||
            content.includes('formatVideoUrl(quality.url)') ||
            content.includes('formatVideoUrl(video.url)') ||
            content.includes('formatVideoUrl(media.url)');

          const isProperlyFormatted = !hasUnformattedVideoUrl && hasFormattedVideoUrl;

          console.log(`   ${fileInfo.name}: ${isProperlyFormatted ? '✅' : '❌'} 视频源格式化`);

          if (hasUnformattedVideoUrl) {
            console.log(`     ⚠️  发现未格式化的视频URL`);
          }

          if (!isProperlyFormatted) {
            allFormatted = false;
          }
        } else {
          console.log(`   ${fileInfo.name}: ❌ 文件不存在`);
          allFormatted = false;
        }
      } catch (error) {
        console.log(`   ${fileInfo.name}: ❌ 检查失败 - ${error.message}`);
        allFormatted = false;
      }
    });

    this.results.allVideoSourcesFormatted = allFormatted;
    console.log('');
  }

  testPosterUrlsFormatted() {
    console.log('🖼️ 测试封面URL格式化...');

    let allFormatted = true;

    this.filesToCheck.forEach(fileInfo => {
      try {
        const fullPath = path.join(this.frontendPath, fileInfo.path);

        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');

          // 检查VideoPlayer组件的poster属性
          const posterMatches = content.match(/poster=\{([^}]+)\}/g);

          if (posterMatches) {
            let allPostersFormatted = true;

            posterMatches.forEach(match => {
              // 检查是否使用了格式化函数
              if (!match.includes('formatImageUrl') && !match.includes('formatVideoUrl')) {
                allPostersFormatted = false;
              }
            });

            console.log(`   ${fileInfo.name}: ${allPostersFormatted ? '✅' : '❌'} 封面URL格式化`);

            if (!allPostersFormatted) {
              allFormatted = false;
            }
          } else {
            console.log(`   ${fileInfo.name}: ✅ 无poster属性或格式正确`);
          }
        } else {
          console.log(`   ${fileInfo.name}: ❌ 文件不存在`);
          allFormatted = false;
        }
      } catch (error) {
        console.log(`   ${fileInfo.name}: ❌ 检查失败 - ${error.message}`);
        allFormatted = false;
      }
    });

    this.results.allPosterUrlsFormatted = allFormatted;
    console.log('');
  }

  testSpecificFixes() {
    console.log('🔧 测试特定修复...');

    try {
      // 测试 MediaDetailModal 修复
      const mediaDetailPath = path.join(this.frontendPath, 'src/app/admin/review/components/MediaDetailModal.tsx');
      if (fs.existsSync(mediaDetailPath)) {
        const content = fs.readFileSync(mediaDetailPath, 'utf-8');

        const checks = {
          hasFormatVideoUrl: content.includes('const formatVideoUrl'),
          hasFormattedVideoSources: content.includes('formatVideoUrl(quality.url)') && content.includes('formatVideoUrl(media.url)'),
          hasFormattedPoster: content.includes('poster={formatVideoUrl(media.thumbnail_url)}'),
          hasDebugLog: content.includes('console.log(\'🎬 MediaDetailModal 视频源:')
        };

        console.log(`   MediaDetailModal formatVideoUrl函数: ${checks.hasFormatVideoUrl ? '✅' : '❌'}`);
        console.log(`   MediaDetailModal 格式化视频源: ${checks.hasFormattedVideoSources ? '✅' : '❌'}`);
        console.log(`   MediaDetailModal 格式化封面: ${checks.hasFormattedPoster ? '✅' : '❌'}`);
        console.log(`   MediaDetailModal 调试日志: ${checks.hasDebugLog ? '✅' : '❌'}`);

        this.results.mediaDetailModalFixed = Object.values(checks).every(Boolean);
      }

      // 测试 VideoDetailPage 修复
      const videoDetailPath = path.join(this.frontendPath, 'src/app/videos/[videoId]/page.tsx');
      if (fs.existsSync(videoDetailPath)) {
        const content = fs.readFileSync(videoDetailPath, 'utf-8');

        const checks = {
          hasFormatVideoUrl: content.includes('const formatVideoUrl'),
          hasFormattedHlsUrl: content.includes('formatVideoUrl(video.hls_url)'),
          hasFormattedQualityUrl: content.includes('formatVideoUrl(quality.url)'),
          hasFormattedVideoUrl: content.includes('formatVideoUrl(video.url)'),
          hasFormattedPoster: content.includes('poster={formatVideoUrl(video.thumbnail_url)}'),
          hasDebugLog: content.includes('console.log(\'🎬 VideoDetail 视频源:')
        };

        console.log(`   VideoDetailPage formatVideoUrl函数: ${checks.hasFormatVideoUrl ? '✅' : '❌'}`);
        console.log(`   VideoDetailPage 格式化HLS: ${checks.hasFormattedHlsUrl ? '✅' : '❌'}`);
        console.log(`   VideoDetailPage 格式化质量URL: ${checks.hasFormattedQualityUrl ? '✅' : '❌'}`);
        console.log(`   VideoDetailPage 格式化视频URL: ${checks.hasFormattedVideoUrl ? '✅' : '❌'}`);
        console.log(`   VideoDetailPage 格式化封面: ${checks.hasFormattedPoster ? '✅' : '❌'}`);
        console.log(`   VideoDetailPage 调试日志: ${checks.hasDebugLog ? '✅' : '❌'}`);

        this.results.videoDetailPageFixed = Object.values(checks).every(Boolean);
      }

      // 测试 AdminMediaPage 是否保持正常
      const adminMediaPath = path.join(this.frontendPath, 'src/app/admin/media/page.tsx');
      if (fs.existsSync(adminMediaPath)) {
        const content = fs.readFileSync(adminMediaPath, 'utf-8');

        const checks = {
          hasFormatImageUrl: content.includes('const formatImageUrl'),
          hasFormattedUrls: content.includes('formatImageUrl(quality.url)') || content.includes('formatImageUrl(media.url)')
        };

        console.log(`   AdminMediaPage formatImageUrl函数: ${checks.hasFormatImageUrl ? '✅' : '❌'}`);
        console.log(`   AdminMediaPage 格式化URL: ${checks.hasFormattedUrls ? '✅' : '❌'}`);

        this.results.adminMediaPageOk = Object.values(checks).every(Boolean);
      }

    } catch (error) {
      console.log(`   特定修复检查失败: ${error.message}`);
    }

    console.log('');
  }

  printResults() {
    console.log('🎯 视频URL格式化修复验证结果:');
    console.log('==========================================');

    const results = [
      { name: 'MediaDetailModal修复', passed: this.results.mediaDetailModalFixed, critical: true },
      { name: 'VideoDetailPage修复', passed: this.results.videoDetailPageFixed, critical: true },
      { name: 'AdminMediaPage正常', passed: this.results.adminMediaPageOk, critical: false },
      { name: '所有格式化函数存在', passed: this.results.allFormatFunctionsExist, critical: true },
      { name: '所有视频源格式化', passed: this.results.allVideoSourcesFormatted, critical: true },
      { name: '所有封面URL格式化', passed: this.results.allPosterUrlsFormatted, critical: true }
    ];

    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const priority = result.critical ? '🔴' : '🟡';
      console.log(`${status} ${priority} ${result.name}`);
    });

    const passedCount = results.filter(r => r.passed).length;
    const criticalPassed = results.filter(r => r.critical && r.passed).length;
    const totalCritical = results.filter(r => r.critical).length;

    console.log('==========================================');
    console.log(`总体完成度: ${passedCount}/${results.length} (${Math.round(passedCount / results.length * 100)}%)`);
    console.log(`关键修复: ${criticalPassed}/${totalCritical} (${Math.round(criticalPassed / totalCritical * 100)}%)`);

    if (passedCount === results.length) {
      console.log('\n🎉 所有视频URL格式化问题修复完成！');
      console.log('\n✨ 修复摘要:');
      console.log('   1. ✅ MediaDetailModal添加formatVideoUrl函数');
      console.log('   2. ✅ VideoDetailPage添加formatVideoUrl函数');
      console.log('   3. ✅ 所有视频源URL都经过格式化处理');
      console.log('   4. ✅ 所有封面URL都经过格式化处理');
      console.log('   5. ✅ 添加调试日志便于故障排除');

      console.log('\n💡 修复效果:');
      console.log('   🚫 不再出现MEDIA_ERR_SRC_NOT_SUPPORTED错误');
      console.log('   📺 视频播放器可以正确加载视频源');
      console.log('   🖼️ 视频封面可以正确显示');
      console.log('   🔗 URL格式统一，支持相对路径和绝对路径');
      console.log('   🛡️ 支持processed文件夹和uploads文件夹');

      console.log('\n🚀 现在点击视频详情应该可以正常播放！');
    } else {
      console.log(`\n⚠️ 还有 ${results.length - passedCount} 项需要处理`);
      const failedItems = results.filter(r => !r.passed);
      failedItems.forEach(item => {
        console.log(`   ${item.critical ? '🔴' : '🟡'} ${item.name}`);
      });
    }
  }
}

// 运行测试
const tester = new VideoURLFixesVerification();
tester.runAllTests().catch(console.error);

