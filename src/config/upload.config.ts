import { registerAs } from '@nestjs/config';

export default () => ({
  useOssStorage: process.env.USE_OSS_STORAGE === 'true',
  localUploadDir: process.env.LOCAL_UPLOAD_DIR || './uploads',
  local: {
    dest: './uploads',
    maxSize: 1024 * 1024 * 100, // 100MB
    allowedTypes: ['image/jpeg', 'image/png', 'video/mp4'],
  },
  
  // 阿里云OSS配置
  oss: {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    region: process.env.OSS_REGION,
    endpoint: process.env.OSS_ENDPOINT,
    cdnBaseUrl: process.env.OSS_CDN_BASE_URL,
  }
});