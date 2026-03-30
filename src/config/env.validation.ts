import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  @Type(() => Number) // 添加类型转换装饰器
  PORT: number;

  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => value === 'true')
  @IsOptional()
  USE_OSS_STORAGE: boolean;

  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => value === 'true')
  @IsOptional()
  ENABLE_VIDEO_FEATURE: boolean;

  @IsString()
  @IsOptional()
  OSS_ACCESS_KEY_ID: string;

  @IsString()
  @IsOptional()
  OSS_ACCESS_KEY_SECRET: string;

  @IsString()
  @IsOptional()
  OSS_BUCKET: string;

  @IsString()
  @IsOptional()
  OSS_REGION: string;

  @IsString()
  @IsOptional()
  OSS_ENDPOINT: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(validatedConfig);

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  if (validatedConfig.USE_OSS_STORAGE) {
    const requiredFields = [
      'OSS_ACCESS_KEY_ID',
      'OSS_ACCESS_KEY_SECRET',
      'OSS_BUCKET',
      'OSS_REGION',
      'OSS_ENDPOINT',
    ] as const;

    const missingFields = requiredFields.filter((field) => {
      const value = validatedConfig[field];
      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missingFields.length > 0) {
      throw new Error(
        `USE_OSS_STORAGE=true 时缺少 OSS 配置: ${missingFields.join(', ')}`,
      );
    }
  }

  return validatedConfig;
}
