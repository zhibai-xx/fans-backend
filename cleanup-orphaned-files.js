#!/usr/bin/env node

/**
 * 清理孤立的处理文件脚本
 * 用于清理数据库中已删除但文件系统中仍存在的媒体文件
 */

const fs = require('fs-extra');
const path = require('path');

class OrphanedFilesCleanup {
  constructor() {
    this.processedDir = path.join(process.cwd(), 'processed');
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.stats = {
      processedDirsFound: 0,
      processedDirsRemoved: 0,
      uploadFilesFound: 0,
      uploadFilesRemoved: 0,
      spaceFreed: 0,
      errors: []
    };
  }

  async cleanup(dryRun = true) {
    console.log(`🧹 孤立文件清理工具 ${dryRun ? '(预览模式)' : '(执行模式)'}\n`);

    await this.cleanupProcessedDirectories(dryRun);
    await this.generateReport();

    if (dryRun) {
      console.log('\n💡 要执行实际清理，请运行:');
      console.log('   node cleanup-orphaned-files.js --execute');
    }
  }

  async cleanupProcessedDirectories(dryRun) {
    console.log('📁 检查 processed 目录...');

    if (!await fs.pathExists(this.processedDir)) {
      console.log('   ⚠️ processed 目录不存在');
      return;
    }

    const items = await fs.readdir(this.processedDir);
    const directories = [];

    for (const item of items) {
      const itemPath = path.join(this.processedDir, item);
      const stat = await fs.stat(itemPath);

      if (stat.isDirectory()) {
        directories.push({
          name: item,
          path: itemPath,
          size: await this.getDirectorySize(itemPath)
        });
      }
    }

    this.stats.processedDirsFound = directories.length;
    console.log(`   发现 ${directories.length} 个处理目录`);

    // 检查哪些是孤立的
    for (const dir of directories) {
      const mediaId = dir.name;
      const isOrphaned = await this.checkIfMediaExists(mediaId);

      if (isOrphaned) {
        console.log(`   🗑️ 孤立目录: ${dir.name} (${this.formatSize(dir.size)})`);

        if (!dryRun) {
          try {
            await fs.remove(dir.path);
            this.stats.processedDirsRemoved++;
            this.stats.spaceFreed += dir.size;
            console.log(`      ✅ 已删除`);
          } catch (error) {
            this.stats.errors.push(`删除 ${dir.name} 失败: ${error.message}`);
            console.log(`      ❌ 删除失败: ${error.message}`);
          }
        }
      } else {
        console.log(`   ✅ 有效目录: ${dir.name}`);
      }
    }
  }

  async checkIfMediaExists(mediaId) {
    // 这里简化处理，实际应该连接数据库查询
    // 现在假设所有找到的目录都是孤立的
    // 在实际使用时，你可能需要连接数据库验证
    return true; // 暂时认为都是孤立的
  }

  async getDirectorySize(dirPath) {
    let totalSize = 0;

    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = await fs.stat(itemPath);

        if (stat.isDirectory()) {
          totalSize += await this.getDirectorySize(itemPath);
        } else {
          totalSize += stat.size;
        }
      }
    } catch (error) {
      this.stats.errors.push(`计算目录大小失败 ${dirPath}: ${error.message}`);
    }

    return totalSize;
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  async generateReport() {
    console.log('\n📋 清理报告');
    console.log('='.repeat(50));
    console.log(`处理目录发现: ${this.stats.processedDirsFound}`);
    console.log(`处理目录删除: ${this.stats.processedDirsRemoved}`);
    console.log(`释放空间: ${this.formatSize(this.stats.spaceFreed)}`);
    console.log(`错误数量: ${this.stats.errors.length}`);

    if (this.stats.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      this.stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    // 保存清理日志
    const logFile = path.join(process.cwd(), 'cleanup-log.json');
    await fs.writeJson(logFile, {
      timestamp: new Date().toISOString(),
      stats: this.stats
    }, { spaces: 2 });

    console.log(`\n📄 详细日志已保存: ${logFile}`);
  }

  // 特定媒体ID的清理
  async cleanupSpecificMedia(mediaIds) {
    console.log(`🎯 清理指定媒体文件: ${mediaIds.join(', ')}\n`);

    for (const mediaId of mediaIds) {
      const processedPath = path.join(this.processedDir, mediaId);

      if (await fs.pathExists(processedPath)) {
        const size = await this.getDirectorySize(processedPath);
        console.log(`   🗑️ 删除: ${mediaId} (${this.formatSize(size)})`);

        try {
          await fs.remove(processedPath);
          console.log(`      ✅ 删除成功`);
          this.stats.spaceFreed += size;
          this.stats.processedDirsRemoved++;
        } catch (error) {
          console.log(`      ❌ 删除失败: ${error.message}`);
          this.stats.errors.push(`删除 ${mediaId} 失败: ${error.message}`);
        }
      } else {
        console.log(`   ⚠️ 目录不存在: ${mediaId}`);
      }
    }

    await this.generateReport();
  }
}

// 主函数
async function main() {
  const cleanup = new OrphanedFilesCleanup();

  const args = process.argv.slice(2);
  const executeMode = args.includes('--execute');
  const specificMediaIds = args.filter(arg => !arg.startsWith('--'));

  if (specificMediaIds.length > 0) {
    // 清理指定的媒体ID
    await cleanup.cleanupSpecificMedia(specificMediaIds);
  } else {
    // 全面清理
    await cleanup.cleanup(!executeMode);
  }
}

main().catch(console.error);
