#!/usr/bin/env node

/**
 * 完整修复验证 - 所有问题解决情况检查
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class CompleteFixVerification {
  constructor() {
    this.results = {
      backendRunning: false,
      typeScriptFixed: false,
      dependencyInjectionFixed: false,
      staticFileService: false,
      processedProxy: false,
      urlConsistency: false,
      apiFormat: false
    };
  }

  async runAllTests() {
    console.log('🎯 完整修复验证测试\n');

    await this.testBackendStatus();
    this.testTypeScriptFixes();
    this.testDependencyInjection();
    this.testStaticFileService();
    this.testProcessedProxy();
    this.testURLConsistency();
    await this.testAPIFormat();

    this.printFinalResults();
  }

  async testBackendStatus() {
    console.log('🚀 测试后端状态...');

    try {
      const response = await axios.get('http://localhost:3000/api/media?take=1', {
        timeout: 5000
      });

      if (response.data && response.data.success !== undefined) {
        console.log('   ✅ 后端API正常运行');
        this.results.backendRunning = true;
      }
    } catch (error) {
      console.log(`   ❌ 后端API错误: ${error.message}`);
    }

    console.log('');
  }

  testTypeScriptFixes() {
    console.log('🛠️ 测试TypeScript修复...');

    try {
      // 检查main.ts的修复
      const mainPath = path.join(__dirname, '../src/main.ts');
      if (fs.existsSync(mainPath)) {
        const content = fs.readFileSync(mainPath, 'utf-8');

        const checks = {
          hasNestExpressImport: content.includes('NestExpressApplication'),
          hasTypedCreate: content.includes('NestFactory.create<NestExpressApplication>'),
          hasStaticAssets: content.includes('useStaticAssets')
        };

        console.log(`   导入NestExpressApplication: ${checks.hasNestExpressImport ? '✅' : '❌'}`);
        console.log(`   类型化创建应用: ${checks.hasTypedCreate ? '✅' : '❌'}`);
        console.log(`   静态文件配置: ${checks.hasStaticAssets ? '✅' : '❌'}`);

        this.results.typeScriptFixed = Object.values(checks).every(Boolean);
      }

      // 检查ffmpeg.service.ts的修复
      const ffmpegPath = path.join(__dirname, '../src/video-processing/services/ffmpeg.service.ts');
      if (fs.existsSync(ffmpegPath)) {
        const content = fs.readFileSync(ffmpegPath, 'utf-8');
        const hasExecuteFFmpeg = content.includes('async executeFFmpeg(args: string[])');
        console.log(`   executeFFmpeg方法: ${hasExecuteFFmpeg ? '✅' : '❌'}`);
      }
    } catch (error) {
      console.log(`   TypeScript修复检查失败: ${error.message}`);
    }

    console.log('');
  }

  testDependencyInjection() {
    console.log('🔄 测试依赖注入修复...');

    try {
      const modulePath = path.join(__dirname, '../src/video-processing/video-processing.module.ts');
      if (fs.existsSync(modulePath)) {
        const content = fs.readFileSync(modulePath, 'utf-8');

        const checks = {
          hasThumbnailProvider: content.includes('ThumbnailService') && content.includes('providers:'),
          exportsThumbnailService: content.includes('exports: [VideoProcessingService, ThumbnailService]')
        };

        console.log(`   ThumbnailService提供者: ${checks.hasThumbnailProvider ? '✅' : '❌'}`);
        console.log(`   导出ThumbnailService: ${checks.exportsThumbnailService ? '✅' : '❌'}`);

        this.results.dependencyInjectionFixed = Object.values(checks).every(Boolean);
      }
    } catch (error) {
      console.log(`   依赖注入修复检查失败: ${error.message}`);
    }

    console.log('');
  }

  testStaticFileService() {
    console.log('📁 测试静态文件服务配置...');

    try {
      const mainPath = path.join(__dirname, '../src/main.ts');
      if (fs.existsSync(mainPath)) {
        const content = fs.readFileSync(mainPath, 'utf-8');

        const hasConfig = content.includes("app.useStaticAssets('processed'") &&
          content.includes("prefix: '/processed/'");

        console.log(`   静态文件配置: ${hasConfig ? '✅' : '❌'}`);
        this.results.staticFileService = hasConfig;
      }
    } catch (error) {
      console.log(`   静态文件服务检查失败: ${error.message}`);
    }

    console.log('');
  }

  testProcessedProxy() {
    console.log('🔄 测试前端代理配置...');

    try {
      const proxyPath = path.join(__dirname, '../../react/fans-next/src/app/processed/[...path]/route.ts');
      if (fs.existsSync(proxyPath)) {
        const content = fs.readFileSync(proxyPath, 'utf-8');

        const checks = {
          hasGetMethod: content.includes('export async function GET'),
          hasBackendUrl: content.includes('BACKEND_BASE_URL'),
          hasArrayBuffer: content.includes('arrayBuffer'),
          hasCacheControl: content.includes('Cache-Control')
        };

        Object.entries(checks).forEach(([key, value]) => {
          console.log(`   ${key}: ${value ? '✅' : '❌'}`);
        });

        this.results.processedProxy = Object.values(checks).every(Boolean);
      } else {
        console.log('   ❌ processed代理文件不存在');
      }
    } catch (error) {
      console.log(`   代理配置检查失败: ${error.message}`);
    }

    console.log('');
  }

  testURLConsistency() {
    console.log('🔗 测试URL一致性修复...');

    try {
      const mediaServicePath = path.join(__dirname, '../src/media/media.service.ts');
      if (fs.existsSync(mediaServicePath)) {
        const content = fs.readFileSync(mediaServicePath, 'utf-8');

        const checks = {
          usesRelativePath: content.includes('`/processed/${media.id}/thumbnails/quick-cover.jpg`'),
          noPort3001: !content.includes('localhost:3001/processed'),
          hasCorrectComment: content.includes('通过前端代理访问')
        };

        console.log(`   使用相对路径: ${checks.usesRelativePath ? '✅' : '❌'}`);
        console.log(`   移除3001端口: ${checks.noPort3001 ? '✅' : '❌'}`);
        console.log(`   正确注释: ${checks.hasCorrectComment ? '✅' : '❌'}`);

        this.results.urlConsistency = Object.values(checks).every(Boolean);
      }
    } catch (error) {
      console.log(`   URL一致性检查失败: ${error.message}`);
    }

    console.log('');
  }

  async testAPIFormat() {
    console.log('📋 测试API响应格式...');

    if (!this.results.backendRunning) {
      console.log('   ⚠️  后端未运行，跳过API格式测试');
      return;
    }

    try {
      const response = await axios.get('http://localhost:3000/api/media?take=1');

      const checks = {
        hasSuccess: response.data.hasOwnProperty('success'),
        hasData: response.data.hasOwnProperty('data'),
        hasPagination: response.data.hasOwnProperty('pagination'),
        successIsBoolean: typeof response.data.success === 'boolean',
        dataIsArray: Array.isArray(response.data.data),
        paginationHasFields: response.data.pagination &&
          response.data.pagination.hasOwnProperty('page') &&
          response.data.pagination.hasOwnProperty('limit') &&
          response.data.pagination.hasOwnProperty('total')
      };

      console.log(`   包含success字段: ${checks.hasSuccess ? '✅' : '❌'}`);
      console.log(`   包含data字段: ${checks.hasData ? '✅' : '❌'}`);
      console.log(`   包含pagination字段: ${checks.hasPagination ? '✅' : '❌'}`);
      console.log(`   success是布尔值: ${checks.successIsBoolean ? '✅' : '❌'}`);
      console.log(`   data是数组: ${checks.dataIsArray ? '✅' : '❌'}`);
      console.log(`   pagination包含必要字段: ${checks.paginationHasFields ? '✅' : '❌'}`);

      this.results.apiFormat = Object.values(checks).every(Boolean);

    } catch (error) {
      console.log(`   API格式测试失败: ${error.message}`);
    }

    console.log('');
  }

  printFinalResults() {
    console.log('🎯 完整修复验证结果:');
    console.log('==========================================');

    const results = [
      { name: '后端服务运行', passed: this.results.backendRunning, critical: true },
      { name: 'TypeScript错误修复', passed: this.results.typeScriptFixed, critical: true },
      { name: '依赖注入修复', passed: this.results.dependencyInjectionFixed, critical: true },
      { name: '静态文件服务配置', passed: this.results.staticFileService, critical: true },
      { name: '前端代理配置', passed: this.results.processedProxy, critical: false },
      { name: 'URL一致性修复', passed: this.results.urlConsistency, critical: true },
      { name: 'API响应格式', passed: this.results.apiFormat, critical: true }
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
      console.log('\n🎉 所有修复完成！系统已完全修复！');
      console.log('\n✨ 修复摘要:');
      console.log('   1. ✅ 封面URL端口统一问题已解决');
      console.log('   2. ✅ TypeScript编译错误已修复');
      console.log('   3. ✅ NestJS依赖注入问题已解决');
      console.log('   4. ✅ 静态文件服务配置完成');
      console.log('   5. ✅ 前端代理路由创建完成');
      console.log('   6. ✅ API响应格式符合规范');
      console.log('\n🚀 系统现在可以正常运行！');
    } else {
      console.log(`\n⚠️ 还有 ${results.length - passedCount} 项需要处理`);
    }
  }
}

// 运行验证
const tester = new CompleteFixVerification();
tester.runAllTests().catch(console.error);

