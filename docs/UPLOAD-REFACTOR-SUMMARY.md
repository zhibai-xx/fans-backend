# 文件上传功能重构总结

## 重构目标
将文件上传功能从 `media` 模块中独立出来，创建专门的 `upload` 模块，支持本地存储和阿里云 OSS 两种存储方式。

## 重构内容

### 1. 新增 Upload 模块结构
```
src/upload/
├── controllers/
│   └── file.controller.ts          # 静态文件服务控制器
├── dto/
│   └── upload.dto.ts               # 上传相关 DTO
├── interfaces/
│   └── storage.interface.ts        # 存储服务接口
├── services/
│   ├── local-storage.service.ts    # 本地存储服务
│   ├── oss-storage.service.ts      # 阿里云 OSS 存储服务
│   └── storage-factory.service.ts  # 存储工厂服务
├── utils/
│   └── file.utils.ts               # 文件工具类
├── upload.controller.ts            # 上传控制器
├── upload.service.ts               # 上传服务
└── upload.module.ts                # 上传模块
```

### 2. 核心功能特性
- **切片上传**：大文件自动分片，默认 5MB
- **断点续传**：支持网络中断后继续上传
- **并发控制**：默认 3 个分片并发上传
- **秒传功能**：相同文件 MD5 匹配直接返回
- **进度监控**：实时显示上传进度和状态
- **错误处理**：完整的重试和错误恢复机制
- **批量上传**：支持同时上传多个文件
- **存储切换**：支持本地存储和阿里云 OSS

### 3. API 接口
- `POST /api/upload/init` - 初始化上传
- `POST /api/upload/batch-init` - 批量初始化
- `POST /api/upload/chunk` - 上传分片
- `POST /api/upload/merge` - 合并分片
- `GET /api/upload/progress/:uploadId` - 获取进度
- `DELETE /api/upload/:uploadId` - 取消上传
- `GET /api/upload/file/:filename` - 静态文件访问

### 4. 数据库模型
新增 `Upload` 模型用于追踪上传状态：
- 文件基本信息（文件名、大小、类型、MD5）
- 分片信息（分片大小、总分片数、已上传分片）
- 状态管理（PENDING、UPLOADING、MERGING、COMPLETED、FAILED、EXPIRED）
- 关联关系（用户、媒体记录）

### 5. 存储服务架构
- **IStorageService 接口**：定义统一的存储操作
- **LocalStorageService**：本地文件系统存储
- **OssStorageService**：阿里云 OSS 存储
- **StorageFactoryService**：根据配置选择存储实现

### 6. 环境配置
```env
# 上传配置
UPLOAD_DIR=./uploads

# 存储模式选择
USE_OSS_STORAGE=false

# 阿里云 OSS 配置（可选）
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_access_key
OSS_ACCESS_KEY_SECRET=your_secret_key
OSS_BUCKET=your_bucket_name
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_CDN_BASE_URL=https://your-cdn-domain.com
```

## 清理内容

### 1. 删除的文件
从 `media` 模块中删除了以下文件：
- `src/media/controllers/file.controller.ts`
- `src/media/utils/file.utils.ts`
- `src/media/services/local-storage.service.ts`
- `src/media/services/oss-storage.service.ts`
- `src/media/services/storage-factory.service.ts`
- `src/media/interfaces/storage.interface.ts`

### 2. 清理的代码
- 从 `MediaService` 中删除了 `uploadMedia` 方法
- 从 `MediaController` 中删除了上传相关路由
- 从 `MediaModule` 中删除了存储相关的依赖和服务

### 3. 保留的功能
`MediaService` 保留了以下核心功能：
- `create()` - 创建媒体记录（供 upload 模块调用）
- `findAll()` - 查询媒体列表
- `findOne()` - 获取媒体详情
- `deleteMedia()` - 删除媒体记录
- 标签和分类管理功能

## 使用方式

### 1. 本地存储模式
```env
USE_OSS_STORAGE=false
UPLOAD_DIR=./uploads
```

### 2. 阿里云 OSS 模式
```env
USE_OSS_STORAGE=true
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_access_key
OSS_ACCESS_KEY_SECRET=your_secret_key
OSS_BUCKET=your_bucket_name
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
```

### 3. 前端集成
使用 `AdvancedUploadModal` 组件和 `FileUploader` 类：
```typescript
import { FileUploader } from '@/lib/upload/file-uploader';
import { AdvancedUploadModal } from '@/components/upload/AdvancedUploadModal';
```

## 技术优势

1. **模块化设计**：上传功能完全独立，易于维护和扩展
2. **存储抽象**：统一的存储接口，支持多种存储后端
3. **高性能**：切片上传、并发控制、断点续传
4. **用户体验**：实时进度、错误重试、批量上传
5. **企业级**：完整的错误处理、日志记录、状态管理
6. **类型安全**：全程 TypeScript 支持

## 依赖包
新增的依赖包：
- `sharp` - 图片处理和缩略图生成
- `ali-oss` - 阿里云 OSS SDK
- `@types/ali-oss` - 阿里云 OSS 类型定义
- `fs-extra` - 增强的文件系统操作
- `spark-md5` - MD5 计算（前端）

重构完成后，文件上传功能更加强大、稳定和易于维护！ 