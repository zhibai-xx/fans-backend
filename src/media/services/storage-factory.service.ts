import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageService } from '../interfaces/storage.interface';
import { LocalStorageService } from './local-storage.service';
import { OssStorageService } from './oss-storage.service';

@Injectable()
export class StorageFactoryService {
  private storageService: IStorageService;

  constructor(
    private configService: ConfigService,
    private localStorageService: LocalStorageService,
    private ossStorageService: OssStorageService,
  ) {
    // 根据环境变量选择存储实现
    const useOss = this.configService.get<boolean>('USE_OSS_STORAGE', false);
    this.storageService = useOss ? this.ossStorageService : this.localStorageService;
  }

  /**
   * 获取当前配置的存储服务
   * @returns 存储服务实例
   */
  getStorage(): IStorageService {
    return this.storageService;
  }

  /**
   * 强制切换到OSS存储
   */
  useOssStorage(): void {
    this.storageService = this.ossStorageService;
  }

  /**
   * 强制切换到本地存储
   */
  useLocalStorage(): void {
    this.storageService = this.localStorageService;
  }
} 