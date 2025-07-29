import { registerAs } from '@nestjs/config';

export default registerAs('performance', () => ({
  // 缓存配置
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '300'), // 5分钟
    max: parseInt(process.env.CACHE_MAX_ITEMS || '1000'), // 最大缓存项目数
    checkperiod: parseInt(process.env.CACHE_CHECK_PERIOD || '60'), // 检查周期（秒）
  },

  // 数据库配置
  database: {
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
    timeout: parseInt(process.env.DB_TIMEOUT || '5000'),
    queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '10000'),
  },

  // 分页配置
  pagination: {
    defaultLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT || '20'),
    maxLimit: parseInt(process.env.MAX_PAGE_LIMIT || '100'),
  },

  // 压缩配置
  compression: {
    enabled: process.env.COMPRESSION_ENABLED === 'true',
    level: parseInt(process.env.COMPRESSION_LEVEL || '6'),
    threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024'),
  },

  // 限流配置
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60'),
    limit: parseInt(process.env.THROTTLE_LIMIT || '10'),
  },

  // 上传配置
  upload: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_UPLOADS || '5'),
    chunkSize: parseInt(process.env.CHUNK_SIZE || '5242880'), // 5MB
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '60000'), // 1分钟
  },

  // 媒体处理配置
  media: {
    thumbnailSize: parseInt(process.env.THUMBNAIL_SIZE || '200'),
    videoPreviewDuration: parseInt(process.env.VIDEO_PREVIEW_DURATION || '10'),
    imageQuality: parseInt(process.env.IMAGE_QUALITY || '80'),
  },

  // 监控配置
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || '30000'), // 30秒
    logLevel: process.env.LOG_LEVEL || 'info',
  },
})); 