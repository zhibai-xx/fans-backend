/**
 * 存储服务接口
 * 定义了存储媒体文件所需的基本方法
 */
export interface IStorageService {
  /**
   * 上传文件
   * @param file 文件对象
   * @param path 存储路径
   * @returns 访问URL
   */
  uploadFile(file: Express.Multer.File, path?: string): Promise<string>;

  /**
   * 删除文件
   * @param fileUrl 文件URL或路径
   * @returns 是否删除成功
   */
  deleteFile(fileUrl: string): Promise<boolean>;

  /**
   * 生成缩略图（仅适用于图片和视频）
   * @param file 文件对象
   * @param originalUrl 原始文件的URL
   * @returns 缩略图URL
   */
  generateThumbnail?(file: Express.Multer.File, originalUrl?: string): Promise<string>;
} 