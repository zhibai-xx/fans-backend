const fs = require('node:fs');
const path = require('node:path');

const envPath = path.join(process.cwd(), '.env.local');

const readEnv = () => {
  if (!fs.existsSync(envPath)) {
    throw new Error(`未找到环境文件: ${envPath}`);
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  const entries = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return null;
      }
      const key = line.slice(0, separatorIndex).trim();
      const value = line
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^"(.*)"$/, '$1');
      return [key, value];
    })
    .filter(Boolean);

  return Object.fromEntries(entries);
};

const main = async () => {
  const env = readEnv();
  const useOss = env.USE_OSS_STORAGE === 'true';

  if (!useOss) {
    console.log(
      JSON.stringify(
        {
          success: true,
          mode: 'local',
          message: '当前使用本地存储，OSS/CDN 真实链路验证需在启用 USE_OSS_STORAGE=true 后执行。',
        },
        null,
        2,
      ),
    );
    return;
  }

  const requiredFields = [
    'OSS_ACCESS_KEY_ID',
    'OSS_ACCESS_KEY_SECRET',
    'OSS_BUCKET',
    'OSS_REGION',
    'OSS_ENDPOINT',
  ];

  const placeholderPatterns = ['your_', 'your-', 'example', 'placeholder'];
  const invalidFields = requiredFields.filter((field) => {
    const value = env[field];
    if (!value || !value.trim()) {
      return true;
    }
    const normalized = value.toLowerCase();
    return placeholderPatterns.some((pattern) => normalized.includes(pattern));
  });

  if (invalidFields.length > 0) {
    throw new Error(
      `OSS 已启用，但以下配置仍是空值或占位值: ${invalidFields.join(', ')}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        mode: 'oss',
        bucket: env.OSS_BUCKET,
        region: env.OSS_REGION,
        endpoint: env.OSS_ENDPOINT,
        cdnBaseUrl: env.OSS_CDN_BASE_URL || null,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
