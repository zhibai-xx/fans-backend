const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3000/api';
const REDIS_CONTAINER = process.env.REDIS_CONTAINER || 'idol_redis';

const fetchWithTimeout = async (url, options = {}, timeoutMs = 4000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const getMediaId = async () => {
  const response = await fetch(`${BACKEND_BASE_URL}/media?take=1&skip=0`);
  const body = await response.json();
  const mediaId = body.data?.[0]?.id;
  if (!mediaId) {
    throw new Error('无法获取媒体 ID');
  }
  return mediaId;
};

const main = async () => {
  const mediaId = await getMediaId();

  await execFileAsync('docker', ['stop', REDIS_CONTAINER]);

  try {
    const startedAt = Date.now();
    const response = await fetchWithTimeout(
      `${BACKEND_BASE_URL}/media/${mediaId}/download`,
      { method: 'POST' },
      5000,
    );
    const durationMs = Date.now() - startedAt;
    const body = await response.text();

    if (response.status !== 503) {
      throw new Error(
        `Redis 故障时游客下载应返回 503，实际 ${response.status}: ${body}`,
      );
    }

    console.log(
      JSON.stringify(
        {
          success: true,
          mediaId,
          durationMs,
          status: response.status,
        },
        null,
        2,
      ),
    );
  } finally {
    await execFileAsync('docker', ['start', REDIS_CONTAINER]);
  }
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
