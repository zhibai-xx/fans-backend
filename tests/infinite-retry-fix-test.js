/**
 * 测试无限重试修复效果
 * 验证视频播放器修复后不会疯狂请求接口
 */

const path = require('path');
const fs = require('fs');

console.log('🔍 测试：视频播放器无限重试修复\n');

// 1. 检查前端VideoPlayer组件修复
console.log('1️⃣ 检查VideoPlayer组件修复...');

const frontendPath = '/Users/houjiawei/Desktop/Projects/react/fans-next';
const videoPlayerPath = path.join(frontendPath, 'src/components/VideoPlayer.tsx');

if (!fs.existsSync(videoPlayerPath)) {
  console.error('❌ VideoPlayer.tsx 不存在');
  process.exit(1);
}

const videoPlayerContent = fs.readFileSync(videoPlayerPath, 'utf8');

// 检查关键修复点
const fixes = [
  {
    name: 'MAX_RETRY_COUNT 限制',
    check: videoPlayerContent.includes('MAX_RETRY_COUNT = 3'),
    expected: true
  },
  {
    name: 'retryCountRef 引用',
    check: videoPlayerContent.includes('retryCountRef = useRef'),
    expected: true
  },
  {
    name: '延迟重试机制',
    check: videoPlayerContent.includes('setTimeout') && videoPlayerContent.includes('retryDelay'),
    expected: true
  },
  {
    name: '网络错误检查',
    check: videoPlayerContent.includes('isNetworkError') && videoPlayerContent.includes('MEDIA_ERR_NETWORK'),
    expected: true
  }
];

fixes.forEach(fix => {
  if (fix.check === fix.expected) {
    console.log(`   ✅ ${fix.name}`);
  } else {
    console.log(`   ❌ ${fix.name}`);
  }
});

// 2. 检查MediaDetailModal组件修复
console.log('\n2️⃣ 检查MediaDetailModal组件修复...');

const modalPath = path.join(frontendPath, 'src/app/admin/review/components/MediaDetailModal.tsx');

if (!fs.existsSync(modalPath)) {
  console.error('❌ MediaDetailModal.tsx 不存在');
  process.exit(1);
}

const modalContent = fs.readFileSync(modalPath, 'utf8');

const modalFixes = [
  {
    name: 'useMemo 缓存视频源',
    check: modalContent.includes('useMemo(() => {') && modalContent.includes('videoSources'),
    expected: true
  },
  {
    name: 'formatVideoUrl 输入验证',
    check: modalContent.includes('|| typeof url !== \'string\'') && modalContent.includes('trim()'),
    expected: true
  },
  {
    name: '空src过滤',
    check: modalContent.includes('.filter(source => source.src)'),
    expected: true
  },
  {
    name: '无视频源fallback',
    check: modalContent.includes('if (videoSources.length === 0)') && modalContent.includes('视频无法播放'),
    expected: true
  }
];

modalFixes.forEach(fix => {
  if (fix.check === fix.expected) {
    console.log(`   ✅ ${fix.name}`);
  } else {
    console.log(`   ❌ ${fix.name}`);
  }
});

// 3. 检查API客户端限流处理
console.log('\n3️⃣ 检查API客户端限流处理...');

const apiClientPath = path.join(frontendPath, 'src/lib/api-client.ts');

if (!fs.existsSync(apiClientPath)) {
  console.error('❌ api-client.ts 不存在');
  process.exit(1);
}

const apiClientContent = fs.readFileSync(apiClientPath, 'utf8');

const apiClientFixes = [
  {
    name: '429状态码检查',
    check: apiClientContent.includes('response.status === 429'),
    expected: true
  },
  {
    name: '指数退避算法',
    check: apiClientContent.includes('Math.pow(2, retryCount)') && apiClientContent.includes('* 1000'),
    expected: true
  },
  {
    name: '延迟函数',
    check: apiClientContent.includes('private async delay(ms: number)') && apiClientContent.includes('setTimeout'),
    expected: true
  },
  {
    name: '最大重试次数',
    check: apiClientContent.includes('maxRetries = 3'),
    expected: true
  }
];

apiClientFixes.forEach(fix => {
  if (fix.check === fix.expected) {
    console.log(`   ✅ ${fix.name}`);
  } else {
    console.log(`   ❌ ${fix.name}`);
  }
});

// 4. 统计修复结果
console.log('\n📊 修复结果统计:');

const allFixes = [...fixes, ...modalFixes, ...apiClientFixes];
const passedFixes = allFixes.filter(fix => fix.check === fix.expected);
const totalFixes = allFixes.length;

console.log(`   ✅ 通过: ${passedFixes.length}/${totalFixes}`);
console.log(`   ❌ 失败: ${totalFixes - passedFixes.length}/${totalFixes}`);

if (passedFixes.length === totalFixes) {
  console.log('\n🎉 所有修复验证通过！');
  console.log('\n🔧 主要修复内容:');
  console.log('   • VideoPlayer: 添加重试次数限制和延迟重试机制');
  console.log('   • MediaDetailModal: 使用useMemo缓存视频源，防止重新创建');
  console.log('   • formatVideoUrl: 增强输入验证，过滤无效URL');
  console.log('   • ApiClient: 添加429限流错误处理和指数退避重试');
  
  console.log('\n📋 测试建议:');
  console.log('   1. 重新访问审核管理页面，点击视频详情');
  console.log('   2. 观察浏览器网络面板，确认不再有疯狂请求');
  console.log('   3. 观察后端日志，确认429错误消失');
  console.log('   4. 测试视频播放是否正常工作');
  
  process.exit(0);
} else {
  console.log('\n⚠️ 部分修复验证失败，请检查代码');
  process.exit(1);
}

