/**
 * 找到视频播放真正的bug
 * 
 * 我怀疑问题在于：
 * 1. formatVideoUrl函数产生的URL格式
 * 2. Video.js接收到的src格式
 * 3. API代理和直接访问的冲突
 */

console.log('🔍 寻找视频播放的真正bug...\n');

// 模拟MediaDetailModal中的formatVideoUrl函数
function formatVideoUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    console.warn('⚠️ formatVideoUrl: 无效URL', url);
    return '';
  }

  const cleanUrl = url.trim();

  // 这里是关键：API_BASE_URL的配置
  const API_BASE_URL = 'http://localhost:3000/api';  // 后端端口
  const BASE_URL = API_BASE_URL.replace('/api', ''); // http://localhost:3000

  console.log(`🔧 formatVideoUrl处理:`);
  console.log(`   输入URL: ${cleanUrl}`);
  console.log(`   API_BASE_URL: ${API_BASE_URL}`);
  console.log(`   BASE_URL: ${BASE_URL}`);

  // 如果已经是绝对URL，直接返回
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    console.log(`   ✅ 匹配规则: 绝对URL`);
    return cleanUrl;
  }

  // 如果已经是正确的API路径，直接返回
  if (cleanUrl.startsWith('/api/upload/file/')) {
    const result = `${BASE_URL}${cleanUrl}`;
    console.log(`   ✅ 匹配规则: API路径 -> ${result}`);
    return result;
  }

  // 处理processed路径（视频处理后的文件）
  if (cleanUrl.startsWith('/processed/')) {
    const result = `${BASE_URL}${cleanUrl}`;
    console.log(`   ✅ 匹配规则: processed路径 -> ${result}`);
    return result;
  }

  // 处理数据库存储的相对路径格式
  if (cleanUrl.startsWith('uploads/')) {
    const pathParts = cleanUrl.replace('uploads/', '');
    const result = `${BASE_URL}/api/upload/file/${pathParts}`;
    console.log(`   ✅ 匹配规则: uploads路径 -> ${result}`);
    return result;
  }

  // 如果以/开头，指向后端静态服务
  if (cleanUrl.startsWith('/')) {
    const result = `${BASE_URL}${cleanUrl}`;
    console.log(`   ✅ 匹配规则: 根路径 -> ${result}`);
    return result;
  }

  // 其他情况，尝试作为后端API路径
  const result = `${BASE_URL}/api/upload/file/${cleanUrl}`;
  console.log(`   ✅ 匹配规则: 默认API路径 -> ${result}`);
  return result;
}

// 测试不同的URL格式
console.log('🧪 测试URL格式化结果:');
console.log('==============================');

const testUrls = [
  'http://localhost:3000/api/upload/file/video/addc35814a082680503c81b99f236055.mp4',
  '/api/upload/file/video/addc35814a082680503c81b99f236055.mp4',
  '/processed/0de47152-63fb-4130-8008-66ca21c40e44/qualities/720p.mp4',
  'uploads/video/addc35814a082680503c81b99f236055.mp4',
  'video/addc35814a082680503c81b99f236055.mp4'
];

testUrls.forEach((url, index) => {
  console.log(`\n测试 ${index + 1}:`);
  const result = formatVideoUrl(url);
  console.log(`   最终结果: ${result}`);
});

console.log('\n🎯 关键发现:');
console.log('==============================');

console.log('❗ 问题1: URL格式化后指向后端端口 (3000)');
console.log('   - formatVideoUrl产生: http://localhost:3000/...');
console.log('   - 但前端运行在3001端口');
console.log('   - 这会导致跨域问题或直接访问后端');

console.log('\n❗ 问题2: Video.js可能收到错误的URL');
console.log('   - 应该通过前端API代理访问: http://localhost:3001/api/proxy/...');
console.log('   - 而不是直接访问后端: http://localhost:3000/api/...');

console.log('\n❗ 问题3: 重复请求的真正原因');
console.log('   - Video.js尝试访问 http://localhost:3000/... (失败 - 红色)');
console.log('   - 然后可能fallback到其他URL (成功 - 绿色)');
console.log('   - 或者浏览器自动重试导致重复请求');

console.log('\n💡 修复方案:');
console.log('==============================');

console.log('1. 🔧 修复formatVideoUrl函数:');
console.log('   - 将所有URL格式化为通过前端API代理访问');
console.log('   - 例: /api/proxy/upload/file/video/xxx.mp4');

console.log('\n2. 🎬 确保Video.js接收正确的URL格式:');
console.log('   - src应该是相对于前端的URL');
console.log('   - 让Next.js API代理处理后端通信');

console.log('\n3. 🧹 统一URL处理逻辑:');
console.log('   - 所有组件使用相同的URL格式化函数');
console.log('   - 避免直接访问后端端口');

console.log('\n🚨 立即需要检查的:');
console.log('1. MediaDetailModal中videoSources的实际值');
console.log('2. SimpleVideoPlayer接收到的src参数');
console.log('3. 浏览器Network面板中的实际请求URL');
console.log('4. 是否有URL在运行时发生变化导致重复请求');

console.log('\n🎯 下一步行动:');
console.log('1. 修改formatVideoUrl使用API代理路径');
console.log('2. 在组件中添加详细日志追踪URL变化');
console.log('3. 测试修复后的视频播放功能');
