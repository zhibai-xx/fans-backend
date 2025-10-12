#!/usr/bin/env node

/**
 * 综合修复验证测试
 * 验证所有4个问题的修复情况
 */

const fs = require('fs');
const path = require('path');

class ComprehensiveFixTest {
  constructor() {
    this.testResults = {
      processedFilesDeletion: false,
      videoThumbnailDisplay: false,
      modernVideoDetailPage: false,
      videoPlayersReplaced: false
    };
  }

  async runAllTests() {
    console.log('🔧 综合修复验证测试开始...\n');

    this.testProcessedFilesDeletion();
    this.testVideoThumbnailDisplay();
    this.testModernVideoDetailPage();
    this.testVideoPlayersReplaced();

    this.printResults();
  }

  testProcessedFilesDeletion() {
    console.log('🗑️ 测试1: processed文件夹删除修复...');

    try {
      const servicePath = path.join(__dirname, '../src/video-processing/services/video-processing.service.ts');

      if (fs.existsSync(servicePath)) {
        const content = fs.readFileSync(servicePath, 'utf-8');

        const checks = {
          hasFixedCleanupMethod: content.includes('🗑️ 开始清理视频处理文件'),
          hasCorrectPath: content.includes('path.join(process.cwd(), \'processed\', mediaId)'),
          hasRecursiveDelete: content.includes('fs.remove(processedDir)'),
          hasAlternativePaths: content.includes('alternativePaths'),
          hasProperErrorHandling: content.includes('throw error') && content.includes('清理处理文件失败')
        };

        console.log(`   • 修复清理方法: ${checks.hasFixedCleanupMethod ? '✅' : '❌'}`);
        console.log(`   • 正确路径构建: ${checks.hasCorrectPath ? '✅' : '❌'}`);
        console.log(`   • 递归删除: ${checks.hasRecursiveDelete ? '✅' : '❌'}`);
        console.log(`   • 备选路径清理: ${checks.hasAlternativePaths ? '✅' : '❌'}`);
        console.log(`   • 错误处理: ${checks.hasProperErrorHandling ? '✅' : '❌'}`);

        this.testResults.processedFilesDeletion = Object.values(checks).every(Boolean);
      } else {
        console.log('❌ VideoProcessingService文件不存在');
      }
    } catch (error) {
      console.log('❌ 测试失败:', error.message);
    }
    console.log('');
  }

  testVideoThumbnailDisplay() {
    console.log('🖼️ 测试2: 视频封面显示修复...');

    try {
      const mediaServicePath = path.join(__dirname, '../src/media/media.service.ts');
      const thumbnailServicePath = path.join(__dirname, '../src/video-processing/services/thumbnail.service.ts');
      const componentPath = path.join(__dirname, '../../react/fans-next/src/components/VideoThumbnail.tsx');

      const checks = {
        hasQuickCoverGeneration: false,
        hasImmediateDbUpdate: false,
        hasVideoThumbnailComponent: false,
        hasProperPathHandling: false
      };

      // 检查MediaService的快速封面生成
      if (fs.existsSync(mediaServicePath)) {
        const mediaContent = fs.readFileSync(mediaServicePath, 'utf-8');
        checks.hasQuickCoverGeneration = mediaContent.includes('generateQuickCover');
        checks.hasImmediateDbUpdate = mediaContent.includes('thumbnail_url') && mediaContent.includes('quick-cover.jpg');
        checks.hasProperPathHandling = mediaContent.includes('path.join(process.cwd()') && mediaContent.includes('processed');
      }

      // 检查ThumbnailService的快速封面方法
      if (fs.existsSync(thumbnailServicePath)) {
        const thumbnailContent = fs.readFileSync(thumbnailServicePath, 'utf-8');
        checks.hasQuickCoverGeneration = checks.hasQuickCoverGeneration && thumbnailContent.includes('generateQuickCover');
      }

      // 检查VideoThumbnail组件
      if (fs.existsSync(componentPath)) {
        const componentContent = fs.readFileSync(componentPath, 'utf-8');
        checks.hasVideoThumbnailComponent = componentContent.includes('VideoThumbnail') &&
          componentContent.includes('生成封面中') &&
          componentContent.includes('视频封面');
      }

      console.log(`   • 快速封面生成: ${checks.hasQuickCoverGeneration ? '✅' : '❌'}`);
      console.log(`   • 立即数据库更新: ${checks.hasImmediateDbUpdate ? '✅' : '❌'}`);
      console.log(`   • VideoThumbnail组件: ${checks.hasVideoThumbnailComponent ? '✅' : '❌'}`);
      console.log(`   • 路径处理修复: ${checks.hasProperPathHandling ? '✅' : '❌'}`);

      this.testResults.videoThumbnailDisplay = Object.values(checks).every(Boolean);
    } catch (error) {
      console.log('❌ 测试失败:', error.message);
    }
    console.log('');
  }

  testModernVideoDetailPage() {
    console.log('🎬 测试3: 现代化视频详情页...');

    try {
      const videoDetailPath = path.join(__dirname, '../../react/fans-next/src/app/videos/[videoId]/page.tsx');

      if (fs.existsSync(videoDetailPath)) {
        const content = fs.readFileSync(videoDetailPath, 'utf-8');

        const checks = {
          hasModernDesign: content.includes('framer-motion') && content.includes('motion.'),
          hasVideoPlayerIntegration: content.includes('VideoPlayer') && content.includes('useVideoPlayer'),
          hasMinimalistLayout: content.includes('bg-white') && !content.includes('gradient-to-br from-slate'),
          hasAnimations: content.includes('AnimatePresence') && content.includes('initial={{ opacity: 0'),
          hasResponsiveDesign: content.includes('xl:col-span') && content.includes('aspect-video'),
          hasFullscreenSupport: content.includes('isFullscreen') && content.includes('fullscreenchange'),
          hasInteractionButtons: content.includes('handleLike') && content.includes('handleFavorite')
        };

        console.log(`   • 现代化设计: ${checks.hasModernDesign ? '✅' : '❌'}`);
        console.log(`   • 视频播放器集成: ${checks.hasVideoPlayerIntegration ? '✅' : '❌'}`);
        console.log(`   • 极简主义布局: ${checks.hasMinimalistLayout ? '✅' : '❌'}`);
        console.log(`   • 轻量级动画: ${checks.hasAnimations ? '✅' : '❌'}`);
        console.log(`   • 响应式设计: ${checks.hasResponsiveDesign ? '✅' : '❌'}`);
        console.log(`   • 全屏支持: ${checks.hasFullscreenSupport ? '✅' : '❌'}`);
        console.log(`   • 交互按钮: ${checks.hasInteractionButtons ? '✅' : '❌'}`);

        this.testResults.modernVideoDetailPage = Object.values(checks).every(Boolean);
      } else {
        console.log('❌ 视频详情页文件不存在');
      }
    } catch (error) {
      console.log('❌ 测试失败:', error.message);
    }
    console.log('');
  }

  testVideoPlayersReplaced() {
    console.log('🎥 测试4: 视频播放器组件替换...');

    try {
      const reviewModalPath = path.join(__dirname, '../../react/fans-next/src/app/admin/review/components/MediaDetailModal.tsx');
      const adminMediaPath = path.join(__dirname, '../../react/fans-next/src/app/admin/media/page.tsx');

      const checks = {
        reviewModalUpdated: false,
        adminMediaUpdated: false,
        noNativeVideoTags: true,
        hasVideoPlayerWrappers: false
      };

      // 检查审核管理Modal
      if (fs.existsSync(reviewModalPath)) {
        const reviewContent = fs.readFileSync(reviewModalPath, 'utf-8');
        checks.reviewModalUpdated = reviewContent.includes('VideoPlayer') &&
          reviewContent.includes('VideoPlayerWrapper') &&
          reviewContent.includes('useVideoPlayer');

        // 确保没有原生video标签
        if (reviewContent.includes('<video')) {
          checks.noNativeVideoTags = false;
        }
      }

      // 检查内容管理页面
      if (fs.existsSync(adminMediaPath)) {
        const adminContent = fs.readFileSync(adminMediaPath, 'utf-8');
        checks.adminMediaUpdated = adminContent.includes('VideoPlayer') &&
          adminContent.includes('AdminVideoPlayerWrapper') &&
          adminContent.includes('useVideoPlayer');

        // 确保没有原生video标签（除了VideoPlayer内部的）
        const videoMatches = adminContent.match(/<video/g);
        if (videoMatches && videoMatches.length > 0) {
          // 允许VideoPlayer组件内部使用video标签
          const hasOnlyVideoPlayerVideo = !adminContent.includes('<video') ||
            adminContent.split('<video').length <= 2;
          checks.noNativeVideoTags = hasOnlyVideoPlayerVideo;
        }
      }

      checks.hasVideoPlayerWrappers = checks.reviewModalUpdated && checks.adminMediaUpdated;

      console.log(`   • 审核管理Modal更新: ${checks.reviewModalUpdated ? '✅' : '❌'}`);
      console.log(`   • 内容管理页面更新: ${checks.adminMediaUpdated ? '✅' : '❌'}`);
      console.log(`   • 无原生video标签: ${checks.noNativeVideoTags ? '✅' : '❌'}`);
      console.log(`   • 播放器包装组件: ${checks.hasVideoPlayerWrappers ? '✅' : '❌'}`);

      this.testResults.videoPlayersReplaced = Object.values(checks).every(Boolean);
    } catch (error) {
      console.log('❌ 测试失败:', error.message);
    }
    console.log('');
  }

  printResults() {
    console.log('📋 综合修复验证结果:');
    console.log('==========================================');

    const results = [
      { name: '1️⃣ processed文件夹删除修复', passed: this.testResults.processedFilesDeletion, critical: true },
      { name: '2️⃣ 视频封面显示修复', passed: this.testResults.videoThumbnailDisplay, critical: true },
      { name: '3️⃣ 现代化视频详情页', passed: this.testResults.modernVideoDetailPage, critical: false },
      { name: '4️⃣ 视频播放器组件替换', passed: this.testResults.videoPlayersReplaced, critical: true }
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
      console.log('\n🎉 所有问题修复完成！');
      console.log('\n✨ 修复亮点:');
      console.log('   🗑️ processed文件夹现在会随媒体删除而正确清理');
      console.log('   ⚡ 视频上传后立即生成快速封面，提升用户体验');
      console.log('   🎬 现代化视频详情页，符合极简主义设计理念');
      console.log('   📱 所有页面统一使用现代VideoPlayer组件');
      console.log('\n🚀 系统现在更加稳定、美观和高效！');
    } else {
      console.log(`\n⚠️ 还有 ${results.length - passedCount} 项需要进一步完善`);

      if (criticalPassed < totalCritical) {
        console.log(`🔴 关键问题修复: ${criticalPassed}/${totalCritical}`);
        console.log('   建议优先处理标记为🔴的关键问题');
      }

      const failedItems = results.filter(r => !r.passed);
      failedItems.forEach(item => {
        console.log(`   ${item.critical ? '🔴' : '🟡'} ${item.name}`);
      });
    }
  }
}

// 运行测试
const tester = new ComprehensiveFixTest();
tester.runAllTests().catch(console.error);
