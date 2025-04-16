import { registerAs } from '@nestjs/config';

/**
 * 阿里云OSS配置
 * 提供阿里云OSS的访问凭证和存储配置
 */
export default () => ({
  oss: {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    region: process.env.OSS_REGION,
    endpoint: process.env.OSS_ENDPOINT,
    cdnBaseUrl: process.env.OSS_CDN_BASE_URL,
  },
});
