#!/usr/bin/env node

/**
 * URL一致性和类型错误修复测试
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class URLConsistencyTest {
  constructor() {
    this.results = {
      backendRunning: false,
      staticFileService: false,
      processedProxy: false,
      urlConsistency: false,
      typeScriptFixed: false
    };
  }

  async runAllTests() {
    console.log('🔧 URL一致性和类型修复测试...\n');

    await this.testBackendStatus();
    await this.testStaticFileService();
    await this.testProcessedProxy();
    await this.testURLConsistency();
    this.testTypeScriptFix();

    this.printResults();
  }

  async testBackendStatus() {
    console.log('🚀 测试后端状态...');

    try {
      const response = await axios.get('http://localhost:3000/api/media?take=1', {
        timeout: 5000
      });

      if (response.data && response.data.success !== undefined) {
        console.log('   后端API: ✅ 正常运行');
        this.results.backendRunning = true;
      }
    } catch (error) {
      console.log('   后端API: ❌ 未运行');
      console.log('   请确保后端服务正在运行');
    }

    console.log('');
  }

  async testStaticFileService() {
    console.log('📁 测试静态文件服务...');

    try {
      // 检查main.ts是否配置了静态文件服务
      const mainPath = path.join(__dirname, '../src/main.ts');

      if (fs.existsSync(mainPath)) {
        const content = fs.readFileSync(mainPath, 'utf-8');

        const hasStaticConfig = content.includes('useStaticAssets') &&
          content.includes("prefix: '/processed/'");

        console.log(`   main.ts静态文件配置: ${hasStaticConfig ? '✅' : '❌'}`);
        this.results.staticFileService = hasStaticConfig;
      }
    } catch (error) {
      console.log('   静态文件配置检查失败:', error.message);
    }

    console.log('');
  }

  async testProcessedProxy() {
    console.log('🔄 测试processed代理...');

    try {
      const proxyPath = path.join(__dirname, '../../react/fans-next/src/app/processed/[...path]/route.ts');

      if (fs.existsSync(proxyPath)) {
        const content = fs.readFileSync(proxyPath, 'utf-8');

        const checks = {
          hasGetMethod: content.includes('export async function GET'),
          hasCorrectUrl: content.includes('BACKEND_BASE_URL') && content.includes('/processed/'),
          hasFileReturn: content.includes('arrayBuffer') && content.includes('Content-Type'),
          hasCacheControl: content.includes('Cache-Control')
        };

        console.log(`   GET方法: ${checks.hasGetMethod ? '✅' : '❌'}`);
        console.log(`   正确URL构建: ${checks.hasCorrectUrl ? '✅' : '❌'}`);
        console.log(`   文件返回: ${checks.hasFileReturn ? '✅' : '❌'}`);
        console.log(`   缓存控制: ${checks.hasCacheControl ? '✅' : '❌'}`);

        this.results.processedProxy = Object.values(checks).every(Boolean);
      } else {
        console.log('   ❌ processed代理文件不存在');
      }
    } catch (error) {
      console.log('   processed代理检查失败:', error.message);
    }

    console.log('');
  }

  async testURLConsistency() {
    console.log('🔗 测试URL一致性修复...');

    try {
      // 检查MediaService中的URL修复
      const mediaServicePath = path.join(__dirname, '../src/media/media.service.ts');

      if (fs.existsSync(mediaServicePath)) {
        const content = fs.readFileSync(mediaServicePath, 'utf-8');

        const checks = {
          removedPort3001: !content.includes('localhost:3001/processed'),
          usesRelativeUrl: content.includes('`/processed/${media.id}/thumbnails/quick-cover.jpg`'),
          hasCorrectComment: content.includes('通过前端代理访问')
        };

        console.log(`   移除3001端口: ${checks.removedPort3001 ? '✅' : '❌'}`);
        console.log(`   使用相对URL: ${checks.usesRelativeUrl ? '✅' : '❌'}`);
        console.log(`   正确注释: ${checks.hasCorrectComment ? '✅' : '❌'}`);

        this.results.urlConsistency = Object.values(checks).every(Boolean);

        // 如果后端运行，测试实际数据
        if (this.results.backendRunning) {
          try {
            const response = await axios.get('http://localhost:3000/api/media?media_type=VIDEO&take=1');
            if (response.data.data && response.data.data.length > 0) {
              const video = response.data.data[0];
              if (video.thumbnail_url) {
                const isRelativeUrl = video.thumbnail_url.startsWith('/processed/');
                const noPort3001 = !video.thumbnail_url.includes(':3001');

                console.log(`   数据库URL相对路径: ${isRelativeUrl ? '✅' : '❌'}`);
                console.log(`   数据库URL无3001端口: ${noPort3001 ? '✅' : '❌'}`);

                if (video.thumbnail_url) {
                  console.log(`   示例URL: ${video.thumbnail_url}`);
                }
              }
            }
          } catch (error) {
            console.log('   数据检查失败:', error.message);
          }
        }
      }
    } catch (error) {
      console.log('   URL一致性检查失败:', error.message);
    }

    console.log('');
  }

  testTypeScriptFix() {
    console.log('🛠️ 测试TypeScript类型修复...');

    try {
      const adminPagePath = path.join(__dirname, '../../react/fans-next/src/app/admin/media/page.tsx');

      if (fs.existsSync(adminPagePath)) {
        const content = fs.readFileSync(adminPagePath, 'utf-8');

        const checks = {
          hasSrcFallback: content.includes('src={playerProps.src || videoSources}'),
          hasVideoPlayerImport: content.includes('import VideoPlayer from'),
          hasUseVideoPlayerImport: content.includes('import { useVideoPlayer }')
        };

        console.log(`   src回退修复: ${checks.hasSrcFallback ? '✅' : '❌'}`);
        console.log(`   VideoPlayer导入: ${checks.hasVideoPlayerImport ? '✅' : '❌'}`);
        console.log(`   useVideoPlayer导入: ${checks.hasUseVideoPlayerImport ? '✅' : '❌'}`);

        this.results.typeScriptFixed = Object.values(checks).every(Boolean);
      } else {
        console.log('   ❌ admin页面文件不存在');
      }
    } catch (error) {
      console.log('   TypeScript修复检查失败:', error.message);
    }

    console.log('');
  }

  printResults() {
    console.log('📊 修复结果总结:');
    console.log('==========================================');

    const results = [
      { name: '后端服务运行', passed: this.results.backendRunning, critical: true },
      { name: '静态文件服务配置', passed: this.results.staticFileService, critical: true },
      { name: 'processed文件代理', passed: this.results.processedProxy, critical: true },
      { name: 'URL一致性修复', passed: this.results.urlConsistency, critical: true },
      { name: 'TypeScript类型修复', passed: this.results.typeScriptFixed, critical: true }
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
    console.log(`修复完成度: ${passedCount}/${results.length} (${Math.round(passedCount / results.length * 100)}%)`);
    console.log(`关键修复: ${criticalPassed}/${totalCritical} (${Math.round(criticalPassed / totalCritical * 100)}%)`);

    if (passedCount === results.length) {
      console.log('\n🎉 所有修复完成！');
      console.log('\n✨ 修复内容:');
      console.log('   🔗 视频封面URL现在使用统一端口（通过代理）');
      console.log('   📁 后端添加processed静态文件服务');
      console.log('   🔄 前端添加processed文件代理');
      console.log('   🛠️ 修复VideoPlayer组件TypeScript类型错误');
      console.log('\n💡 建议:');
      console.log('   1. 重启后端服务以应用静态文件配置');
      console.log('   2. 重新上传视频以生成新的封面URL');
      console.log('   3. 检查管理页面视频播放是否正常');
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
const tester = new URLConsistencyTest();
tester.runAllTests().catch(console.error);
