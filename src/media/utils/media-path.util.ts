export const convertToAccessibleUrl = (
  relativePath: string | null | undefined,
): string => {
  if (!relativePath) return '';

  const cleanPath = relativePath.trim();

  const extractProcessed = (path: string): string => {
    const match = path.match(/processed\/.+$/);
    if (match) {
      return `/${match[0]}`;
    }
    return '';
  };

  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    const processedPath = extractProcessed(cleanPath);
    if (processedPath) {
      return processedPath;
    }
    return cleanPath;
  }

  if (cleanPath.startsWith('/processed/')) {
    return cleanPath;
  }
  if (cleanPath.startsWith('processed/')) {
    return `/${cleanPath}`;
  }

  if (cleanPath.startsWith('/uploads/processed/')) {
    return cleanPath.replace('/uploads', '');
  }
  if (cleanPath.startsWith('uploads/processed/')) {
    return `/processed/${cleanPath.substring('uploads/processed/'.length)}`;
  }

  if (cleanPath.startsWith('/api/upload/file/processed/')) {
    const processedPath = cleanPath.replace('/api/upload/file', '');
    return processedPath.startsWith('/') ? processedPath : `/${processedPath}`;
  }

  if (cleanPath.startsWith('uploads/')) {
    const uploadPath = cleanPath.substring('uploads/'.length);
    return `/api/upload/file/${uploadPath}`;
  }

  if (cleanPath.startsWith('/api/upload/file/')) {
    return cleanPath;
  }

  return `/api/upload/file/${cleanPath}`;
};
