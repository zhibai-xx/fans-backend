const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3000/api';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Aa123456';
const SYSTEM_INGEST_SCAN_PATH =
  process.env.SYSTEM_INGEST_SCAN_PATH ||
  '/Users/houjiawei/Desktop/Projects/Scripts/weibo-crawler/weibo';
const RUN_COUNT = Number.parseInt(process.env.INGEST_SCAN_RUNS || '3', 10);

const nowMs = () => Number(process.hrtime.bigint()) / 1_000_000;

const login = async () => {
  const response = await fetch(`${BACKEND_BASE_URL}/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`管理员登录失败: ${response.status}`);
  }

  const body = await response.json();
  const token = body.access_token;
  if (!token) {
    throw new Error('登录响应缺少 access_token');
  }
  return token;
};

const scanOnce = async (token) => {
  const start = nowMs();
  const response = await fetch(`${BACKEND_BASE_URL}/upload/system-ingest/scan`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      customPath: SYSTEM_INGEST_SCAN_PATH,
    }),
  });
  const duration = nowMs() - start;
  const body = await response.json();

  if (!response.ok || !body.success) {
    throw new Error(
      `system-ingest 扫描失败: ${response.status} ${JSON.stringify(body)}`,
    );
  }

  return {
    durationMs: Number(duration.toFixed(2)),
    totalFiles: body.data.totalFiles,
    userCount: body.data.users.length,
  };
};

const main = async () => {
  const token = await login();
  const runs = [];

  for (let index = 0; index < RUN_COUNT; index += 1) {
    runs.push(await scanOnce(token));
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        path: SYSTEM_INGEST_SCAN_PATH,
        runs,
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
