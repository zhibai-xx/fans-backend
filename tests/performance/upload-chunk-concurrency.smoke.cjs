const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3000/api';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Aa123456';
const SYSTEM_INGEST_SCAN_PATH =
  process.env.SYSTEM_INGEST_SCAN_PATH ||
  '/Users/houjiawei/Desktop/Projects/Scripts/weibo-crawler/weibo';
const FILE_COUNT = Number.parseInt(
  process.env.UPLOAD_CONCURRENCY_FILE_COUNT || '2',
  10,
);
const CHUNK_SIZE = 1024 * 1024;

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

const scanRealImages = async (token) => {
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
    throw new Error(`扫描真实图片失败: ${response.status}`);
  }
  return body.data.users
    .flatMap((user) => user.files.map((file) => ({ ...file, userId: user.userId })))
    .filter((file) => file.type === 'image')
    .slice(0, FILE_COUNT);
};

const createTempVariant = async (file, index) => {
  const originalBuffer = await fs.readFile(file.path);
  const suffix = Buffer.from(`\ncodecx-${Date.now()}-${index}\n`, 'utf8');
  const mutatedBuffer = Buffer.concat([originalBuffer, suffix]);
  const fileName = `perf-${Date.now()}-${index}-${path.basename(file.name)}`;
  const tempPath = path.join(os.tmpdir(), fileName);
  await fs.writeFile(tempPath, mutatedBuffer);
  return {
    path: tempPath,
    fileName,
    buffer: mutatedBuffer,
    md5: crypto.createHash('md5').update(mutatedBuffer).digest('hex'),
  };
};

const initUpload = async (token, file) => {
  const response = await fetch(`${BACKEND_BASE_URL}/upload/init`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      filename: file.fileName,
      fileSize: file.buffer.length,
      fileType: 'image',
      fileMd5: file.md5,
      chunkSize: CHUNK_SIZE,
      title: file.fileName,
      description: '并发上传 smoke 测试文件',
      tagIds: [],
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.uploadId) {
    throw new Error(`初始化上传失败: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
};

const uploadChunk = async (token, uploadId, totalChunks, chunkIndex, chunkBuffer) => {
  const formData = new FormData();
  formData.append('uploadId', uploadId);
  formData.append('chunkIndex', String(chunkIndex));
  formData.append('totalChunks', String(totalChunks));
  formData.append(
    'chunk',
    new Blob([chunkBuffer], { type: 'application/octet-stream' }),
    `chunk-${chunkIndex}`,
  );

  const response = await fetch(`${BACKEND_BASE_URL}/upload/chunk`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(
      `上传分片失败: ${response.status} chunk=${chunkIndex} ${JSON.stringify(body)}`,
    );
  }
};

const mergeChunks = async (token, uploadId, fileMd5) => {
  const response = await fetch(`${BACKEND_BASE_URL}/upload/merge`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      uploadId,
      fileMd5,
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.mediaId) {
    throw new Error(`合并分片失败: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
};

const uploadFile = async (token, sourceFile, index) => {
  const tempFile = await createTempVariant(sourceFile, index);
  const totalChunks = Math.ceil(tempFile.buffer.length / CHUNK_SIZE);
  const startedAt = nowMs();

  try {
    const initResult = await initUpload(token, tempFile);
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, tempFile.buffer.length);
      await uploadChunk(
        token,
        initResult.uploadId,
        totalChunks,
        chunkIndex,
        tempFile.buffer.subarray(start, end),
      );
    }

    const mergeResult = await mergeChunks(token, initResult.uploadId, tempFile.md5);
    const durationMs = nowMs() - startedAt;

    return {
      fileName: tempFile.fileName,
      uploadId: initResult.uploadId,
      durationMs: Number(durationMs.toFixed(2)),
      mediaId: mergeResult.mediaId,
    };
  } finally {
    await fs.unlink(tempFile.path).catch(() => {});
  }
};

const main = async () => {
  const token = await login();
  const files = await scanRealImages(token);
  if (files.length === 0) {
    throw new Error('未找到可用于分片上传的图片');
  }

  const results = await Promise.all(
    files.map((file, index) => uploadFile(token, file, index)),
  );

  console.log(
    JSON.stringify(
      {
        success: true,
        fileCount: results.length,
        chunkSize: CHUNK_SIZE,
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
