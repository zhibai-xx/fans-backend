const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3000/api';
const REQUEST_COUNT = Number.parseInt(
  process.env.PERF_REQUEST_COUNT || '20',
  10,
);
const CONCURRENCY = Number.parseInt(process.env.PERF_CONCURRENCY || '5', 10);

const nowMs = () => Number(process.hrtime.bigint()) / 1_000_000;

const percentile = (values, ratio) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index];
};

const runScenario = async (name, path) => {
  const durations = [];
  const statuses = new Map();
  let cursor = 0;

  const worker = async () => {
    while (cursor < REQUEST_COUNT) {
      const currentIndex = cursor;
      cursor += 1;
      if (currentIndex >= REQUEST_COUNT) {
        return;
      }

      const start = nowMs();
      const response = await fetch(`${BACKEND_BASE_URL}${path}`);
      const duration = nowMs() - start;
      durations.push(duration);
      statuses.set(
        response.status,
        (statuses.get(response.status) || 0) + 1,
      );
      await response.arrayBuffer();
    }
  };

  await Promise.all(
    Array.from({ length: CONCURRENCY }, () => worker()),
  );

  return {
    name,
    path,
    requestCount: REQUEST_COUNT,
    concurrency: CONCURRENCY,
    minMs: Number(Math.min(...durations).toFixed(2)),
    p50Ms: Number(percentile(durations, 0.5).toFixed(2)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(2)),
    maxMs: Number(Math.max(...durations).toFixed(2)),
    statuses: Object.fromEntries(statuses),
  };
};

const main = async () => {
  const health = await runScenario('health', '/health');
  const mediaList = await runScenario(
    'media-list',
    '/media?take=12&skip=0',
  );

  console.log(
    JSON.stringify(
      {
        success: true,
        scenarios: [health, mediaList],
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
