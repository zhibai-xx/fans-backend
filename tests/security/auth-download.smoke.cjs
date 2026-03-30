const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3000/api';

const expectStatus = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(`${message}: 期望 ${expected}，实际 ${actual}`);
  }
};

const main = async () => {
  const mediaResponse = await fetch(`${BACKEND_BASE_URL}/media?take=1&skip=0`);
  if (!mediaResponse.ok) {
    throw new Error(`获取媒体列表失败: ${mediaResponse.status}`);
  }

  const mediaBody = await mediaResponse.json();
  const firstMedia = mediaBody.data?.[0];
  if (!firstMedia?.id) {
    throw new Error('媒体列表为空，无法执行安全 smoke');
  }

  const adminGuardResponse = await fetch(
    `${BACKEND_BASE_URL}/upload/system-ingest/scan`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    },
  );
  expectStatus(
    adminGuardResponse.status,
    401,
    '未登录访问 system-ingest 扫描接口应被拒绝',
  );

  const downloadResponse = await fetch(
    `${BACKEND_BASE_URL}/media/${firstMedia.id}/download`,
    {
      method: 'POST',
    },
  );
  if (!downloadResponse.ok) {
    throw new Error(`获取签名下载链接失败: ${downloadResponse.status}`);
  }
  const downloadBody = await downloadResponse.json();
  const downloadUrl = downloadBody.data?.download_url;
  if (!downloadUrl) {
    throw new Error('下载接口未返回 download_url');
  }

  const signedUrl = new URL(downloadUrl, `${BACKEND_BASE_URL.replace(/\/api$/, '')}`);
  const signature = signedUrl.searchParams.get('signature') || '';
  const expires = signedUrl.searchParams.get('expires') || '';

  signedUrl.searchParams.set(
    'signature',
    `${signature.slice(0, -1)}${signature.endsWith('a') ? 'b' : 'a'}`,
  );
  const tamperedResponse = await fetch(signedUrl.toString(), {
    redirect: 'manual',
  });
  expectStatus(
    tamperedResponse.status,
    401,
    '篡改后的下载签名应被拒绝',
  );

  const expiredUrl = new URL(downloadUrl, `${BACKEND_BASE_URL.replace(/\/api$/, '')}`);
  expiredUrl.searchParams.set('expires', String(Number(expires) - 3600 * 1000));
  const expiredResponse = await fetch(expiredUrl.toString(), {
    redirect: 'manual',
  });
  expectStatus(expiredResponse.status, 401, '过期下载链接应失效');

  console.log(
    JSON.stringify(
      {
        success: true,
        mediaId: firstMedia.id,
        checks: [
          'admin-guard',
          'signed-url-tamper',
          'signed-url-expired',
        ],
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
