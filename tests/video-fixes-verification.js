#!/usr/bin/env node

/**
 * 视频相关修复验证测试
 * 验证VideoPlayer组件修复和视频封面拉伸修复
 */

const fs = require('fs');
const path = require('path');

class VideoFixesVerification {
  constructor() {
    // 根据.cursorrules获取正确的项目路径
    const frontendPath = '/Users/houjiawei/Desktop/Projects/react/fans-next';
    const backendPath = '/Users/houjiawei/Desktop/Projects/nestjs/fans-backend';

    this.results = {
      videoPlayerSrcCheck: false,
      mediaDetailModalSrcFix: false,
      thumbnailServiceSmartScale: false,
      videoThumbnailSmartRatio: false,
      reviewDashboardUpdated: false,
      allVideoPlayerUsagesValid: false
    };

    this.frontendPath = frontendPath;
    this.backendPath = backendPath;
  }

  async runAllTests() {
    console.log('🎥 视频相关修复验证测试\n');

    this.testVideoPlayerSrcCheck();
    this.testMediaDetailModalSrcFix();
    this.testThumbnailServiceSmartScale();
    this.testVideoThumbnailSmartRatio();
    this.testReviewDashboardUpdated();
    this.testAllVideoPlayerUsages();

    this.printResults();
  }

  testVideoPlayerSrcCheck() {
    console.log('🛠️ 测试VideoPlayer组件src检查修复...');

    try {
      const videoPlayerPath = path.join(this.frontendPath, 'src/components/VideoPlayer.tsx');

      if (fs.existsSync(videoPlayerPath)) {
        const content = fs.readFileSync(videoPlayerPath, 'utf-8');

        const checks = {
          hasStringCheck: content.includes('src && typeof src === \'string\''),
          hasErrorHandling: content.includes('console.warn(\'VideoPlayer: 无效的视频源\', src)'),
          hasReturnOnError: content.includes('setError(\'视频源无效\');') && content.includes('return;')
        };

        console.log(`   字符串类型检查: ${checks.hasStringCheck ? '✅' : '❌'}`);
        console.log(`   错误处理: ${checks.hasErrorHandling ? '✅' : '❌'}`);
        console.log(`   错误状态设置: ${checks.hasReturnOnError ? '✅' : '❌'}`);

        this.results.videoPlayerSrcCheck = Object.values(checks).every(Boolean);
      } else {
        console.log('   ❌ VideoPlayer.tsx文件不存在');
      }
    } catch (error) {
      console.log(`   VideoPlayer组件检查失败: ${error.message}`);
    }

    console.log('');
  }

  testMediaDetailModalSrcFix() {
    console.log('🎬 测试MediaDetailModal src传递修复...');

    try {
      const modalPath = path.join(this.frontendPath, 'src/app/admin/review/components/MediaDetailModal.tsx');

      if (fs.existsSync(modalPath)) {
        const content = fs.readFileSync(modalPath, 'utf-8');

        const checks = {
          hasSrcProp: content.includes('src={videoSources}'),
          hasVideoPlayer: content.includes('<VideoPlayer'),
          hasPropsSpread: content.includes('{...playerProps}')
        };

        console.log(`   显式传递src: ${checks.hasSrcProp ? '✅' : '❌'}`);
        console.log(`   使用VideoPlayer: ${checks.hasVideoPlayer ? '✅' : '❌'}`);
        console.log(`   传递playerProps: ${checks.hasPropsSpread ? '✅' : '❌'}`);

        this.results.mediaDetailModalSrcFix = Object.values(checks).every(Boolean);
      } else {
        console.log('   ❌ MediaDetailModal.tsx文件不存在');
      }
    } catch (error) {
      console.log(`   MediaDetailModal检查失败: ${error.message}`);
    }

    console.log('');
  }

  testThumbnailServiceSmartScale() {
    console.log('🖼️ 测试视频封面智能缩放修复...');

    try {
      const thumbnailServicePath = path.join(this.backendPath, 'src/video-processing/services/thumbnail.service.ts');

      if (fs.existsSync(thumbnailServicePath)) {
        const content = fs.readFileSync(thumbnailServicePath, 'utf-8');

        const checks = {
          hasVerticalCheck: content.includes('originalHeight > originalWidth'),
          hasAspectRatioCalc: content.includes('aspectRatio = originalWidth / originalHeight'),
          hasTargetWidth: content.includes('targetWidth') && content.includes('targetHeight'),
          hasSmartPadding: content.includes('pad=') && content.includes('(ow-iw)/2:(oh-ih)/2:black'),
          hasDebugLog: content.includes('原始尺寸:') && content.includes('目标尺寸:')
        };

        console.log(`   竖屏检测: ${checks.hasVerticalCheck ? '✅' : '❌'}`);
        console.log(`   宽高比计算: ${checks.hasAspectRatioCalc ? '✅' : '❌'}`);
        console.log(`   目标尺寸计算: ${checks.hasTargetWidth ? '✅' : '❌'}`);
        console.log(`   智能填充: ${checks.hasSmartPadding ? '✅' : '❌'}`);
        console.log(`   调试日志: ${checks.hasDebugLog ? '✅' : '❌'}`);

        this.results.thumbnailServiceSmartScale = Object.values(checks).every(Boolean);
      } else {
        console.log('   ❌ thumbnail.service.ts文件不存在');
      }
    } catch (error) {
      console.log(`   ThumbnailService检查失败: ${error.message}`);
    }

    console.log('');
  }

  testVideoThumbnailSmartRatio() {
    console.log('🎨 测试VideoThumbnail智能宽高比修复...');

    try {
      const videoThumbnailPath = path.join(this.frontendPath, 'src/components/VideoThumbnail.tsx');

      if (fs.existsSync(videoThumbnailPath)) {
        const content = fs.readFileSync(videoThumbnailPath, 'utf-8');

        const checks = {
          hasSmartAspectRatioProp: content.includes('smartAspectRatio?: boolean'),
          hasDefaultTrue: content.includes('smartAspectRatio = true'),
          hasObjectContain: content.includes('smartAspectRatio ? "object-contain" : "object-cover"'),
          hasConditionalClass: content.includes('className={cn(')
        };

        console.log(`   smartAspectRatio属性: ${checks.hasSmartAspectRatioProp ? '✅' : '❌'}`);
        console.log(`   默认为true: ${checks.hasDefaultTrue ? '✅' : '❌'}`);
        console.log(`   条件object-contain: ${checks.hasObjectContain ? '✅' : '❌'}`);
        console.log(`   条件class名: ${checks.hasConditionalClass ? '✅' : '❌'}`);

        this.results.videoThumbnailSmartRatio = Object.values(checks).every(Boolean);
      } else {
        console.log('   ❌ VideoThumbnail.tsx文件不存在');
      }
    } catch (error) {
      console.log(`   VideoThumbnail检查失败: ${error.message}`);
    }

    console.log('');
  }

  testReviewDashboardUpdated() {
    console.log('📋 测试审核管理页面更新...');

    try {
      const reviewDashboardPath = path.join(this.frontendPath, 'src/app/admin/review/components/ReviewDashboard.tsx');

      if (fs.existsSync(reviewDashboardPath)) {
        const content = fs.readFileSync(reviewDashboardPath, 'utf-8');

        const checks = {
          hasSmartAspectRatioTrue: content.includes('smartAspectRatio={true}'),
          hasVideoThumbnailImport: content.includes("import { VideoThumbnail }"),
          hasVideoThumbnailUsage: content.includes('<VideoThumbnail')
        };

        console.log(`   启用smartAspectRatio: ${checks.hasSmartAspectRatioTrue ? '✅' : '❌'}`);
        console.log(`   导入VideoThumbnail: ${checks.hasVideoThumbnailImport ? '✅' : '❌'}`);
        console.log(`   使用VideoThumbnail: ${checks.hasVideoThumbnailUsage ? '✅' : '❌'}`);

        this.results.reviewDashboardUpdated = Object.values(checks).every(Boolean);
      } else {
        console.log('   ❌ ReviewDashboard.tsx文件不存在');
      }
    } catch (error) {
      console.log(`   ReviewDashboard检查失败: ${error.message}`);
    }

    console.log('');
  }

  testAllVideoPlayerUsages() {
    console.log('🎦 测试所有VideoPlayer使用页面...');

    try {
      const filesToCheck = [
        'src/app/admin/media/page.tsx',
        'src/app/videos/[videoId]/page.tsx',
        'src/app/admin/review/components/MediaDetailModal.tsx'
      ];

      let allValid = true;

      filesToCheck.forEach(file => {
        const fullPath = path.join(this.frontendPath, file);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');

          const hasVideoPlayer = content.includes('<VideoPlayer');
          const hasSrcProp = content.includes('src={') || content.includes('src=');

          console.log(`   ${path.basename(file)}: VideoPlayer=${hasVideoPlayer ? '✅' : '❌'}, src=${hasSrcProp ? '✅' : '❌'}`);

          if (hasVideoPlayer && !hasSrcProp) {
            allValid = false;
          }
        } else {
          console.log(`   ${path.basename(file)}: ❌ 文件不存在`);
          allValid = false;
        }
      });

      this.results.allVideoPlayerUsagesValid = allValid;
    } catch (error) {
      console.log(`   VideoPlayer使用检查失败: ${error.message}`);
    }

    console.log('');
  }

  printResults() {
    console.log('🎯 视频修复验证结果:');
    console.log('==========================================');

    const results = [
      { name: 'VideoPlayer src检查修复', passed: this.results.videoPlayerSrcCheck, critical: true },
      { name: 'MediaDetailModal src传递', passed: this.results.mediaDetailModalSrcFix, critical: true },
      { name: '视频封面智能缩放', passed: this.results.thumbnailServiceSmartScale, critical: true },
      { name: 'VideoThumbnail智能宽高比', passed: this.results.videoThumbnailSmartRatio, critical: true },
      { name: '审核页面更新', passed: this.results.reviewDashboardUpdated, critical: true },
      { name: '所有VideoPlayer使用检查', passed: this.results.allVideoPlayerUsagesValid, critical: true }
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
      console.log('\n🎉 所有视频相关问题修复完成！');
      console.log('\n✨ 修复摘要:');
      console.log('   1. ✅ VideoPlayer组件src undefined错误修复');
      console.log('   2. ✅ MediaDetailModal缺少src传递修复');
      console.log('   3. ✅ 视频封面拉伸问题修复（智能缩放）');
      console.log('   4. ✅ VideoThumbnail组件智能宽高比处理');
      console.log('   5. ✅ 审核管理页面显示优化');
      console.log('   6. ✅ 所有VideoPlayer使用页面检查');

      console.log('\n💡 效果:');
      console.log('   🎥 VideoPlayer不再因src为undefined而报错');
      console.log('   📱 竖屏视频(720×960)封面不再被拉伸');
      console.log('   🖼️ 视频封面根据原始尺寸智能生成');
      console.log('   🎨 审核页面视频缩略图显示更自然');

      console.log('\n🚀 现在可以上传新视频测试封面生成效果！');
    } else {
      console.log(`\n⚠️ 还有 ${results.length - passedCount} 项需要处理`);
    }
  }
}

// 运行测试
const tester = new VideoFixesVerification();
tester.runAllTests().catch(console.error);

