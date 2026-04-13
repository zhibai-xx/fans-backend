import * as path from 'path';
import * as fs from 'fs-extra';

const configuredUploadDir =
  process.env.UPLOAD_DIR || process.env.LOCAL_UPLOAD_DIR || 'uploads';

export const UPLOAD_ROOT = path.isAbsolute(configuredUploadDir)
  ? configuredUploadDir
  : path.join(process.cwd(), configuredUploadDir);

export const PROCESSED_ROOT = path.join(UPLOAD_ROOT, 'processed');
export const LEGACY_PROCESSED_ROOT = path.join(process.cwd(), 'processed');

export const getProcessedMediaDir = (mediaId: string) =>
  path.join(PROCESSED_ROOT, mediaId);

export async function ensureUploadStructure() {
  await fs.ensureDir(UPLOAD_ROOT);
  await fs.ensureDir(PROCESSED_ROOT);
}

async function isDirectoryEmpty(directoryPath: string) {
  const entries = await fs.readdir(directoryPath);
  return entries.length === 0;
}

export async function migrateLegacyProcessedDirectory(logger?: {
  log: (msg: string) => void;
  warn?: (msg: string) => void;
}) {
  const legacyExists = await fs.pathExists(LEGACY_PROCESSED_ROOT);
  const newExists = await fs.pathExists(PROCESSED_ROOT);

  if (legacyExists && !newExists) {
    if (logger?.log) {
      logger.log('检测到旧的 processed 目录，开始迁移到 uploads/processed');
    }
    await fs.move(LEGACY_PROCESSED_ROOT, PROCESSED_ROOT, { overwrite: false });
    if (logger?.log) {
      logger.log('已迁移 processed 目录至 uploads/processed');
    }
    return;
  }

  if (!legacyExists || !newExists) {
    return;
  }

  const [legacyIsEmpty, newIsEmpty] = await Promise.all([
    isDirectoryEmpty(LEGACY_PROCESSED_ROOT),
    isDirectoryEmpty(PROCESSED_ROOT),
  ]);

  if (legacyIsEmpty) {
    await fs.remove(LEGACY_PROCESSED_ROOT);
    if (logger?.log) {
      logger.log('检测到空的旧 processed 目录，已自动清理');
    }
    return;
  }

  if (newIsEmpty) {
    if (logger?.log) {
      logger.log(
        '检测到空的 uploads/processed 目录，开始迁移旧 processed 内容',
      );
    }
    await fs.remove(PROCESSED_ROOT);
    await fs.move(LEGACY_PROCESSED_ROOT, PROCESSED_ROOT, { overwrite: false });
    if (logger?.log) {
      logger.log('已迁移 processed 目录至 uploads/processed');
    }
    return;
  }

  if (logger?.warn) {
    logger.warn(
      '同时存在 uploads/processed 与根目录 processed，请手动检查并清理重复内容',
    );
  }
}
