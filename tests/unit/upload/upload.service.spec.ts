const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

interface UploadChunkMeta {
  index: number;
  size: number;
}

const validateChunks = (chunks: UploadChunkMeta[], declaredSize: number): void => {
  const ordered = [...chunks].sort((a, b) => a.index - b.index);
  ordered.forEach((chunk, idx) => {
    if (chunk.index !== idx) {
      throw new Error(`Chunk order mismatch: expected ${idx}, got ${chunk.index}`);
    }
  });

  const total = ordered.reduce((acc, chunk) => acc + chunk.size, 0);
  if (total !== declaredSize) {
    throw new Error(`Chunk sizes (${total}) do not match declared size (${declaredSize})`);
  }

  if (total > MAX_UPLOAD_SIZE) {
    throw new Error(`Payload exceeds maximum upload size (${MAX_UPLOAD_SIZE})`);
  }
};

describe('Upload • Chunk validation helpers', () => {
  it('accepts sequential chunk metadata within 50MB cap', () => {
    expect(() =>
      validateChunks(
        [
          { index: 0, size: 5 * 1024 * 1024 },
          { index: 1, size: 5 * 1024 * 1024 },
        ],
        10 * 1024 * 1024,
      ),
    ).not.toThrow();
  });

  it('rejects payloads exceeding the maximum file size', () => {
    expect(() =>
      validateChunks(
        [
          { index: 0, size: MAX_UPLOAD_SIZE },
          { index: 1, size: 1 },
        ],
        MAX_UPLOAD_SIZE + 1,
      ),
    ).toThrow('Payload exceeds maximum upload size');
  });
});
