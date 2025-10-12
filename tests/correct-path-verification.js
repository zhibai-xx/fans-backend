#!/usr/bin/env node

/**
 * 基于.cursorrules文件的正确路径验证测试
 * 前端项目路径: /Users/houjiawei/Desktop/Projects/react/fans-next
 * 后端项目路径: /Users/houjiawei/Desktop/Projects/nestjs/fans-backend
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 从.cursorrules读取的正确路径
const FRONTEND_PATH = '/Users/houjiawei/Desktop/Projects/react/fans-next';
const BACKEND_PATH = '/Users/houjiawei/Desktop/Projects/nestjs/fans-backend';

class CorrectPathVerification {
  constructor() {
    this.results = {
      pathsValid: false,
      processedFilesDeletion: false,
      videoThumbnailComponents: false,
      modernVideoPage: false,
      videoPlayersReplaced: false,
      backendRunning: false
    };
  }

  async runFullVerification() {
    console.log('🔍 基于正确路径的完整验证开始...');
    console.log(`前端路径: ${FRONTEND_PATH}`);
    console.log(`后端路径: ${BACKEND_PATH}\n`);

    // 1. 验证路径存在
    this.verifyPaths();

    // 2. 检查后端是否运行
    await this.checkBackendStatus();

    // 3. 验证各项修复
    this.verifyProcessedFilesDeletion();
    this.verifyVideoThumbnailComponents();
    this.verifyModernVideoPage();
    this.verifyVideoPlayersReplaced();

    // 4. 实际功能测试（如果后端运行）
    if (this.results.backendRunning) {
      await this.testActualFunctionality();
    }

    this.printDetailedResults();
  }

  verifyPaths() {
    console.log('📁 验证项目路径...');

    const frontendExists = fs.existsSync(FRONTEND_PATH);
    const backendExists = fs.existsSync(BACKEND_PATH);

    console.log(`   前端项目存在: ${frontendExists ? '✅' : '❌'}`);
    console.log(`   后端项目存在: ${backendExists ? '✅' : '❌'}`);

    if (frontendExists && backendExists) {
      // 验证关键文件
      const frontendPackage = fs.existsSync(path.join(FRONTEND_PATH, 'package.json'));
      const backendPackage = fs.existsSync(path.join(BACKEND_PATH, 'package.json'));

      console.log(`   前端package.json: ${frontendPackage ? '✅' : '❌'}`);
      console.log(`   后端package.json: ${backendPackage ? '✅' : '❌'}`);

      this.results.pathsValid = frontendPackage && backendPackage;
    }

    console.log('');
  }

  async checkBackendStatus() {
    console.log('🚀 检查后端服务状态...');

    try {
      const response = await axios.get('http://localhost:3000/api/media?take=1', {
        timeout: 5000
      });

      if (response.data && response.data.success !== undefined) {
        console.log('   后端服务: ✅ 运行中');
        this.results.backendRunning = true;
      }
    } catch (error) {
      console.log('   后端服务: ❌ 未运行或无法访问');
      console.log(`   错误: ${error.code || error.message}`);
      this.results.backendRunning = false;
    }

    console.log('');
  }

  verifyProcessedFilesDeletion() {
    console.log('🗑️ 验证processed文件删除修复...');

    try {
      const servicePath = path.join(BACKEND_PATH, 'src/video-processing/services/video-processing.service.ts');

      if (!fs.existsSync(servicePath)) {
        console.log('   ❌ VideoProcessingService文件不存在');
        return;
      }

      const content = fs.readFileSync(servicePath, 'utf-8');

      const checks = {
        hasCleanupMethod: content.includes('cleanupProcessingFiles'),
        hasCorrectPath: content.includes('path.join(process.cwd(), \'processed\', mediaId)'),
        hasRecursiveDelete: content.includes('fs.remove'),
        hasLogging: content.includes('🗑️ 开始清理视频处理文件'),
        hasAlternativePaths: content.includes('alternativePaths')
      };

      console.log(`   清理方法存在: ${checks.hasCleanupMethod ? '✅' : '❌'}`);
      console.log(`   正确路径构建: ${checks.hasCorrectPath ? '✅' : '❌'}`);
      console.log(`   递归删除: ${checks.hasRecursiveDelete ? '✅' : '❌'}`);
      console.log(`   日志记录: ${checks.hasLogging ? '✅' : '❌'}`);
      console.log(`   备选路径: ${checks.hasAlternativePaths ? '✅' : '❌'}`);

      this.results.processedFilesDeletion = Object.values(checks).every(Boolean);

    } catch (error) {
      console.log(`   ❌ 验证失败: ${error.message}`);
    }

    console.log('');
  }

  verifyVideoThumbnailComponents() {
    console.log('🎨 验证视频缩略图组件...');

    try {
      const componentPath = path.join(FRONTEND_PATH, 'src/components/VideoThumbnail.tsx');

      if (!fs.existsSync(componentPath)) {
        console.log('   ❌ VideoThumbnail组件不存在');
        return;
      }

      const content = fs.readFileSync(componentPath, 'utf-8');

      const checks = {
        hasVideoThumbnailExport: content.includes('export function VideoThumbnail'),
        hasVideoCardThumbnailExport: content.includes('export function VideoCardThumbnail'),
        hasLoadingState: content.includes('生成封面中'),
        hasPlaceholder: content.includes('视频封面'),
        hasPlayIcon: content.includes('Play'),
        hasErrorHandling: content.includes('imageError')
      };

      console.log(`   VideoThumbnail组件: ${checks.hasVideoThumbnailExport ? '✅' : '❌'}`);
      console.log(`   VideoCardThumbnail组件: ${checks.hasVideoCardThumbnailExport ? '✅' : '❌'}`);
      console.log(`   加载状态: ${checks.hasLoadingState ? '✅' : '❌'}`);
      console.log(`   默认占位符: ${checks.hasPlaceholder ? '✅' : '❌'}`);
      console.log(`   播放图标: ${checks.hasPlayIcon ? '✅' : '❌'}`);
      console.log(`   错误处理: ${checks.hasErrorHandling ? '✅' : '❌'}`);

      this.results.videoThumbnailComponents = Object.values(checks).every(Boolean);

    } catch (error) {
      console.log(`   ❌ 验证失败: ${error.message}`);
    }

    console.log('');
  }

  verifyModernVideoPage() {
    console.log('🎬 验证现代化视频详情页...');

    try {
      const pagePath = path.join(FRONTEND_PATH, 'src/app/videos/[videoId]/page.tsx');

      if (!fs.existsSync(pagePath)) {
        console.log('   ❌ 视频详情页不存在');
        return;
      }

      const content = fs.readFileSync(pagePath, 'utf-8');

      const checks = {
        hasFramerMotion: content.includes('framer-motion') && content.includes('motion.'),
        hasVideoPlayer: content.includes('VideoPlayer') && content.includes('useVideoPlayer'),
        hasMinimalistDesign: content.includes('bg-white') && !content.includes('gradient-to-br from-slate'),
        hasAnimations: content.includes('AnimatePresence'),
        hasFullscreen: content.includes('isFullscreen'),
        hasModernInteractions: content.includes('handleLike') && content.includes('handleFavorite'),
        hasResponsiveLayout: content.includes('xl:col-span')
      };

      console.log(`   Framer Motion动画: ${checks.hasFramerMotion ? '✅' : '❌'}`);
      console.log(`   VideoPlayer集成: ${checks.hasVideoPlayer ? '✅' : '❌'}`);
      console.log(`   极简主义设计: ${checks.hasMinimalistDesign ? '✅' : '❌'}`);
      console.log(`   动画效果: ${checks.hasAnimations ? '✅' : '❌'}`);
      console.log(`   全屏支持: ${checks.hasFullscreen ? '✅' : '❌'}`);
      console.log(`   现代交互: ${checks.hasModernInteractions ? '✅' : '❌'}`);
      console.log(`   响应式布局: ${checks.hasResponsiveLayout ? '✅' : '❌'}`);

      this.results.modernVideoPage = Object.values(checks).every(Boolean);

    } catch (error) {
      console.log(`   ❌ 验证失败: ${error.message}`);
    }

    console.log('');
  }

  verifyVideoPlayersReplaced() {
    console.log('🎥 验证视频播放器替换...');

    try {
      // 检查审核管理Modal
      const modalPath = path.join(FRONTEND_PATH, 'src/app/admin/review/components/MediaDetailModal.tsx');
      let modalUpdated = false;

      if (fs.existsSync(modalPath)) {
        const modalContent = fs.readFileSync(modalPath, 'utf-8');
        modalUpdated = modalContent.includes('VideoPlayer') &&
          modalContent.includes('VideoPlayerWrapper') &&
          modalContent.includes('useVideoPlayer');
      }

      // 检查内容管理页面
      const mediaPagePath = path.join(FRONTEND_PATH, 'src/app/admin/media/page.tsx');
      let mediaPageUpdated = false;

      if (fs.existsSync(mediaPagePath)) {
        const mediaContent = fs.readFileSync(mediaPagePath, 'utf-8');
        mediaPageUpdated = mediaContent.includes('VideoPlayer') &&
          mediaContent.includes('AdminVideoPlayerWrapper') &&
          mediaContent.includes('useVideoPlayer');
      }

      console.log(`   审核管理Modal: ${modalUpdated ? '✅' : '❌'}`);
      console.log(`   内容管理页面: ${mediaPageUpdated ? '✅' : '❌'}`);

      this.results.videoPlayersReplaced = modalUpdated && mediaPageUpdated;

    } catch (error) {
      console.log(`   ❌ 验证失败: ${error.message}`);
    }

    console.log('');
  }

  async testActualFunctionality() {
    console.log('🧪 实际功能测试...');

    try {
      // 测试API响应格式
      const response = await axios.get('http://localhost:3000/api/media?take=1');
      const hasCorrectFormat = response.data &&
        response.data.success !== undefined &&
        response.data.data !== undefined &&
        response.data.pagination !== undefined;

      console.log(`   API格式正确: ${hasCorrectFormat ? '✅' : '❌'}`);

      // 测试视频数据
      if (response.data.data && response.data.data.length > 0) {
        const video = response.data.data[0];
        const hasVideoFields = video.thumbnail_url && video.media_type;
        console.log(`   视频数据完整: ${hasVideoFields ? '✅' : '❌'}`);

        // 检查缩略图URL
        if (video.thumbnail_url) {
          console.log(`   缩略图URL: ${video.thumbnail_url}`);
        }
      }

    } catch (error) {
      console.log(`   ❌ 功能测试失败: ${error.message}`);
    }

    console.log('');
  }

  printDetailedResults() {
    console.log('📊 详细验证结果:');
    console.log('==========================================');

    const results = [
      { name: '项目路径验证', passed: this.results.pathsValid, critical: true },
      { name: 'processed文件删除修复', passed: this.results.processedFilesDeletion, critical: true },
      { name: '视频缩略图组件', passed: this.results.videoThumbnailComponents, critical: true },
      { name: '现代化视频页面', passed: this.results.modernVideoPage, critical: false },
      { name: '视频播放器替换', passed: this.results.videoPlayersReplaced, critical: true },
      { name: '后端服务状态', passed: this.results.backendRunning, critical: true }
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
    console.log(`关键功能: ${criticalPassed}/${totalCritical} (${Math.round(criticalPassed / totalCritical * 100)}%)`);

    if (criticalPassed === totalCritical && passedCount === results.length) {
      console.log('\n🎉 所有功能验证通过！');
    } else {
      console.log(`\n⚠️ 有 ${results.length - passedCount} 项需要修复`);

      const failedItems = results.filter(r => !r.passed);
      failedItems.forEach(item => {
        console.log(`   ${item.critical ? '🔴' : '🟡'} ${item.name}`);
      });

      if (!this.results.backendRunning) {
        console.log('\n💡 建议先启动后端服务进行完整测试');
      }
    }

    return this.results;
  }
}

// 运行验证
const verifier = new CorrectPathVerification();
verifier.runFullVerification().then(() => {
  // 检查所有关键结果
  const allPassed = verifier.results.pathsValid &&
    verifier.results.processedFilesDeletion &&
    verifier.results.videoThumbnailComponents &&
    verifier.results.videoPlayersReplaced &&
    verifier.results.backendRunning;

  if (allPassed) {
    console.log('\n✨ 所有修复验证通过，任务真正完成！');
    process.exit(0);
  } else {
    console.log('\n❌ 部分修复未完成，需要继续工作');
    console.log('Results:', verifier.results);
    process.exit(1);
  }
}).catch(error => {
  console.error('验证过程出错:', error);
  process.exit(1);
});
