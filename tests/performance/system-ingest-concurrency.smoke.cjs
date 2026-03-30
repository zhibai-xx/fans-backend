const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3000/api';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Aa123456';
const SYSTEM_INGEST_SCAN_PATH =
  process.env.SYSTEM_INGEST_SCAN_PATH ||
  '/Users/houjiawei/Desktop/Projects/Scripts/weibo-crawler/weibo';
const CONCURRENCY = Number.parseInt(
  process.env.INGEST_UPLOAD_CONCURRENCY || '3',
  10,
);

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
  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(`管理员登录失败: ${response.status}`);
  }
  return body.access_token;
};

const scan = async (token) => {
  const response = await fetch(`${BACKEND_BASE_URL}/upload/system-ingest/scan`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ customPath: SYSTEM_INGEST_SCAN_PATH }),
  });
  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(`扫描失败: ${response.status}`);
  }
  return body.data.users.flatMap((user) =>
    user.files.map((file) => ({
      path: file.path,
      name: file.name,
      userId: user.userId,
      type: file.type,
    })),
  );
};

const uploadFile = async (token, file) => {
  const start = nowMs();
  const response = await fetch(
    `${BACKEND_BASE_URL}/upload/system-ingest/batch-upload`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        selectedFiles: [
          {
            path: file.path,
            name: file.name,
            userId: file.userId,
          },
        ],
      }),
    },
  );
  const durationMs = nowMs() - start;
  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(`上传失败: ${response.status} ${JSON.stringify(body)}`);
  }
  return {
    fileName: file.name,
    type: file.type,
    durationMs: Number(durationMs.toFixed(2)),
    result: body.data?.[0] || null,
  };
};

const main = async () => {
  const token = await login();
  const files = await scan(token);
  const selectedFiles = files
    .filter((file) => file.type === 'image' || file.type === 'video')
    .slice(0, CONCURRENCY);

  if (selectedFiles.length === 0) {
    throw new Error('未找到可用于并发导入的文件');
  }

  const results = await Promise.all(
    selectedFiles.map((file) => uploadFile(token, file)),
  );

  console.log(
    JSON.stringify(
      {
        success: true,
        concurrency: selectedFiles.length,
        results,
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
