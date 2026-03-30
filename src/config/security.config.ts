const INSECURE_JWT_SECRET_VALUES = new Set([
  'your-secret-key',
  'your-super-secret-jwt-key-here',
]);

const parseOriginList = (rawValue: string): string[] => {
  return rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

export const getJwtSecretOrThrow = (): string => {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new Error('JWT_SECRET 未配置，请在环境变量中设置强随机密钥');
  }

  if (INSECURE_JWT_SECRET_VALUES.has(jwtSecret)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境禁止使用默认占位 JWT_SECRET，请设置强随机密钥');
    }

    console.warn('警告: 当前 JWT_SECRET 为占位值，仅允许在开发环境使用');
  }

  return jwtSecret;
};

export const getJwtRefreshSecretOrThrow = (): string => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET?.trim();
  if (refreshSecret && !INSECURE_JWT_SECRET_VALUES.has(refreshSecret)) {
    return refreshSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须配置 JWT_REFRESH_SECRET，且不能使用占位值');
  }

  return getJwtSecretOrThrow();
};

export const getAccessTokenExpiresIn = (): string => {
  return process.env.JWT_ACCESS_EXPIRES_IN?.trim() || '15m';
};

export const getRefreshTokenExpiresIn = (): string => {
  return process.env.JWT_REFRESH_EXPIRES_IN?.trim() || '30d';
};

export const getAllowedCorsOrigins = (): string[] => {
  const rawCorsOrigins = process.env.CORS_ORIGINS?.trim();

  if (rawCorsOrigins) {
    const parsedOrigins = parseOriginList(rawCorsOrigins);
    if (parsedOrigins.length > 0) {
      return parsedOrigins;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须配置 CORS_ORIGINS（逗号分隔）以明确允许来源');
  }

  return ['http://localhost:3001', 'http://127.0.0.1:3001'];
};
