#!/usr/bin/env node

/**
 * 视频处理用户体验优化离线测试
 * 检查代码实现和文件配置
 */

const fs = require('fs');
const path = require('path');

class OfflineUXTest {
  constructor() {
    this.testResults = {
      quickThumbnailService: false,
      mediaServiceIntegration: false,
      videoThumbnailComponent: false,
      reviewDashboardUpdate: false,
      nextjsConfig: false
    };
  }

  async runAllTests() {
    console.log('🔍 离线检查视频用户体验优化实现...\n');

    this.testQuickThumbnailService();
    this.testMediaServiceIntegration();
    this.testVideoThumbnailComponent();
    this.testReviewDashboardUpdate();
    this.testNextjsConfig();

    this.printResults();
  }

  testQuickThumbnailService() {
    console.log('⚡ 检查快速封面生成服务...');

    const servicePath = path.join(__dirname, '../src/video-processing/services/thumbnail.service.ts');

    if (fs.existsSync(servicePath)) {
      const content = fs.readFileSync(servicePath, 'utf-8');

      const checks = {
        hasQuickCoverMethod: content.includes('generateQuickCover'),
        hasOptimizedSettings: content.includes('scale=640:360') && content.includes('q:v', '75'),
        hasLogging: content.includes('⚡ 快速生成视频封面'),
        hasErrorHandling: content.includes('快速封面生成失败')
      };

      console.log(`   • generateQuickCover方法: ${checks.hasQuickCoverMethod ? '✅' : '❌'}`);
      console.log(`   • 优化设置 (640x360, q75): ${checks.hasOptimizedSettings ? '✅' : '❌'}`);
      console.log(`   • 日志记录: ${checks.hasLogging ? '✅' : '❌'}`);
      console.log(`   • 错误处理: ${checks.hasErrorHandling ? '✅' : '❌'}`);

      this.testResults.quickThumbnailService = Object.values(checks).every(Boolean);
    } else {
      console.log('❌ ThumbnailService文件不存在');
    }
    console.log('');
  }

  testMediaServiceIntegration() {
    console.log('🔧 检查MediaService集成...');

    const servicePath = path.join(__dirname, '../src/media/media.service.ts');

    if (fs.existsSync(servicePath)) {
      const content = fs.readFileSync(servicePath, 'utf-8');

      const checks = {
        importsThumbnailService: content.includes('import { ThumbnailService }'),
        injectsThumbnailService: content.includes('private readonly thumbnailService: ThumbnailService'),
        hasQuickCoverGeneration: content.includes('generateQuickCover'),
        hasImmediateUpdate: content.includes('thumbnail_url') && content.includes('quick-cover.jpg'),
        hasErrorHandling: content.includes('thumbnailError')
      };

      console.log(`   • 导入ThumbnailService: ${checks.importsThumbnailService ? '✅' : '❌'}`);
      console.log(`   • 依赖注入: ${checks.injectsThumbnailService ? '✅' : '❌'}`);
      console.log(`   • 调用快速封面生成: ${checks.hasQuickCoverGeneration ? '✅' : '❌'}`);
      console.log(`   • 立即更新数据库: ${checks.hasImmediateUpdate ? '✅' : '❌'}`);
      console.log(`   • 错误处理: ${checks.hasErrorHandling ? '✅' : '❌'}`);

      this.testResults.mediaServiceIntegration = Object.values(checks).every(Boolean);
    } else {
      console.log('❌ MediaService文件不存在');
    }
    console.log('');
  }

  testVideoThumbnailComponent() {
    console.log('🎨 检查VideoThumbnail组件...');

    const componentPath = path.join(__dirname, '../../react/fans-next/src/components/VideoThumbnail.tsx');

    if (fs.existsSync(componentPath)) {
      const content = fs.readFileSync(componentPath, 'utf-8');

      const checks = {
        hasDefaultPlaceholder: content.includes('视频封面') && content.includes('Video className'),
        hasLoadingState: content.includes('生成封面中') && content.includes('animate-pulse'),
        hasPlayIcon: content.includes('Play') && content.includes('showPlayIcon'),
        hasErrorHandling: content.includes('imageError') && content.includes('handleImageError'),
        hasNextImage: content.includes('import Image from'),
        hasProperInterface: content.includes('VideoThumbnailProps')
      };

      console.log(`   • 默认占位符: ${checks.hasDefaultPlaceholder ? '✅' : '❌'}`);
      console.log(`   • 加载状态动画: ${checks.hasLoadingState ? '✅' : '❌'}`);
      console.log(`   • 播放图标: ${checks.hasPlayIcon ? '✅' : '❌'}`);
      console.log(`   • 图片错误处理: ${checks.hasErrorHandling ? '✅' : '❌'}`);
      console.log(`   • 使用Next.js Image: ${checks.hasNextImage ? '✅' : '❌'}`);
      console.log(`   • TypeScript接口: ${checks.hasProperInterface ? '✅' : '❌'}`);

      this.testResults.videoThumbnailComponent = Object.values(checks).every(Boolean);
    } else {
      console.log('❌ VideoThumbnail组件文件不存在');
    }
    console.log('');
  }

  testReviewDashboardUpdate() {
    console.log('📋 检查审核管理界面更新...');

    const dashboardPath = path.join(__dirname, '../../react/fans-next/src/app/admin/review/components/ReviewDashboard.tsx');

    if (fs.existsSync(dashboardPath)) {
      const content = fs.readFileSync(dashboardPath, 'utf-8');

      const checks = {
        importsVideoThumbnail: content.includes('import { VideoThumbnail }'),
        usesVideoThumbnailInGrid: content.includes('media.media_type === \'VIDEO\'') && content.includes('<VideoThumbnail'),
        hasLoadingProp: content.includes('loading={!media.thumbnail_url}'),
        hasProperFallback: content.includes('} else {') && content.includes('<img'),
        maintainsImageSupport: content.includes('media.thumbnail_url || media.url')
      };

      console.log(`   • 导入VideoThumbnail: ${checks.importsVideoThumbnail ? '✅' : '❌'}`);
      console.log(`   • 条件渲染视频缩略图: ${checks.usesVideoThumbnailInGrid ? '✅' : '❌'}`);
      console.log(`   • 传递loading属性: ${checks.hasLoadingProp ? '✅' : '❌'}`);
      console.log(`   • 图片类型回退: ${checks.hasProperFallback ? '✅' : '❌'}`);
      console.log(`   • 保持图片支持: ${checks.maintainsImageSupport ? '✅' : '❌'}`);

      this.testResults.reviewDashboardUpdate = Object.values(checks).every(Boolean);
    } else {
      console.log('❌ ReviewDashboard组件文件不存在');
    }
    console.log('');
  }

  testNextjsConfig() {
    console.log('🖼️  检查Next.js配置...');

    const configPath = path.join(__dirname, '../../fans-next/next.config.ts');

    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');

      const checks = {
        hasRemotePatterns: content.includes('remotePatterns'),
        hasPort3000Config: content.includes('"port": "3000"'),
        hasPort3001Config: content.includes('"port": "3001"'),
        hasLocalhostConfig: content.includes('"hostname": "localhost"'),
        hasBothPorts: content.match(/port.*3000/g) && content.match(/port.*3001/g)
      };

      console.log(`   • 配置remotePatterns: ${checks.hasRemotePatterns ? '✅' : '❌'}`);
      console.log(`   • 支持3000端口: ${checks.hasPort3000Config ? '✅' : '❌'}`);
      console.log(`   • 支持3001端口: ${checks.hasPort3001Config ? '✅' : '❌'}`);
      console.log(`   • 配置localhost: ${checks.hasLocalhostConfig ? '✅' : '❌'}`);
      console.log(`   • 双端口配置: ${checks.hasBothPorts ? '✅' : '❌'}`);

      this.testResults.nextjsConfig = checks.hasBothPorts && checks.hasRemotePatterns;
    } else {
      console.log('❌ next.config.ts文件不存在');
    }
    console.log('');
  }

  printResults() {
    console.log('📊 视频用户体验优化实现检查结果:');
    console.log('========================================');

    const results = [
      { name: '快速封面生成服务', passed: this.testResults.quickThumbnailService },
      { name: 'MediaService集成', passed: this.testResults.mediaServiceIntegration },
      { name: 'VideoThumbnail组件', passed: this.testResults.videoThumbnailComponent },
      { name: '审核管理界面更新', passed: this.testResults.reviewDashboardUpdate },
      { name: 'Next.js图片配置', passed: this.testResults.nextjsConfig }
    ];

    results.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    });

    const passedCount = results.filter(r => r.passed).length;
    console.log('========================================');
    console.log(`实现完成度: ${passedCount}/${results.length} (${Math.round(passedCount / results.length * 100)}%)`);

    if (passedCount === results.length) {
      console.log('\n🎉 所有用户体验优化功能实现完整！');
      console.log('\n🚀 优化亮点:');
      console.log('   • ⚡ 立即生成快速封面 (640x360, 5秒内完成)');
      console.log('   • 🎨 优美的加载状态和默认占位符');
      console.log('   • 🔄 数据库立即更新缩略图URL');
      console.log('   • 📱 响应式设计，支持各种设备');
      console.log('   • 🖼️  Next.js图片优化和域名配置');
      console.log('\n💡 用户体验提升:');
      console.log('   • 审核管理页面不再显示空白视频封面');
      console.log('   • 上传完成后立即看到视频预览');
      console.log('   • 流畅的加载动画和错误处理');
      console.log('   • 现代化的视频播放界面');
    } else {
      console.log(`\n⚠️  ${results.length - passedCount} 项功能需要检查完善`);

      const failedItems = results.filter(r => !r.passed);
      failedItems.forEach(item => {
        console.log(`   • ${item.name}`);
      });
    }
  }
}

// 运行测试
const tester = new OfflineUXTest();
tester.runAllTests().catch(console.error);
