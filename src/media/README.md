# 媒体文件模块

本模块提供媒体文件的上传、管理和访问功能，支持图片和视频等多种媒体类型，并提供本地存储和阿里云OSS两种存储方式。

## 功能特点

- 支持图片和视频上传
- 支持本地存储和阿里云OSS存储（可以轻松切换）
- 自动生成图片缩略图
- 提供完整的CRUD操作
- 包含文件类型验证和大小限制
- 防止恶意文件上传和目录遍历攻击
- 统一的API接口设计

## 安装依赖

项目使用了一些外部依赖，请确保安装以下依赖包：

```bash
# 文件处理
npm install --save @nestjs/platform-express
npm install --save-dev @types/multer

# 图片处理
npm install --save sharp

# 文件上传和静态文件服务
npm install --save @nestjs/serve-static

# UUID生成
npm install --save uuid
npm install --save-dev @types/uuid

# 阿里云OSS SDK (仅当使用阿里云OSS存储时需要)
npm install --save ali-oss
npm install --save-dev @types/ali-oss
```

## 环境配置

在项目根目录的`.env`文件中添加以下配置：

```env
# 存储配置
USE_OSS_STORAGE=false # 设置为true启用阿里云OSS存储，false使用本地存储

# 本地存储配置
LOCAL_UPLOAD_DIR="./uploads" # 本地存储路径

# 阿里云OSS配置
OSS_ACCESS_KEY_ID="your_access_key_id"
OSS_ACCESS_KEY_SECRET="your_access_key_secret"
OSS_BUCKET="your_bucket_name"
OSS_REGION="oss-cn-beijing" # 例如：oss-cn-beijing, oss-cn-shanghai等
OSS_ENDPOINT="oss-cn-beijing.aliyuncs.com"
OSS_CDN_BASE_URL="https://your-cdn-domain.com" # 可选：CDN访问URL前缀
```

## API端点

### 上传媒体文件

```
POST /api/media/upload
```

请求体：
- `file`: 文件数据（multipart/form-data）
- `title`: 媒体标题
- `description`（可选）: 媒体描述
- `category_id`（可选）: 分类ID
- `tags`（可选）: 标签ID数组

### 获取媒体列表

```
GET /api/media
```

查询参数：
- `userId`（可选）: 筛选特定用户的媒体
- `type`（可选）: 媒体类型（IMAGE/VIDEO）
- `status`（可选）: 媒体状态（PENDING/APPROVED/REJECTED/PRIVATE）
- `skip`（可选）: 分页起始位置
- `take`（可选）: 分页大小

### 获取媒体详情

```
GET /api/media/:id
```

### 删除媒体

```
DELETE /api/media/:id
```

### 更新媒体状态（管理员）

```
PATCH /api/media/:id/status
```

请求体：
- `status`: 新状态（PENDING/APPROVED/REJECTED/PRIVATE）

### 访问媒体文件

```
GET /api/media/file/:filename
```

## 使用示例

### 上传媒体文件

```javascript
// 使用fetch API上传文件
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('title', 'My Image');
formData.append('description', 'This is a beautiful image');

const response = await fetch('/api/media/upload', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': 'Bearer yourtoken'
  }
});

const result = await response.json();
console.log(result);
```

### 获取媒体列表

```javascript
const response = await fetch('/api/media?type=IMAGE&take=10');
const result = await response.json();
console.log(result.data); // 媒体列表
console.log(result.meta); // 分页信息
```

## 安全注意事项

1. 项目使用了多种安全措施来防止恶意文件上传：
   - 文件类型验证
   - 文件大小限制
   - 安全的文件名生成
   - 防止目录遍历攻击

2. 在生产环境中，请确保：
   - 配置适当的文件大小限制
   - 限制允许的文件类型
   - 使用适当的认证和授权机制
   - 考虑使用CDN来提供静态文件

## 存储策略

### 本地存储

当 `USE_OSS_STORAGE=false` 时，文件将保存在本地文件系统中（默认为 `./uploads` 目录）。

### 阿里云OSS存储

当 `USE_OSS_STORAGE=true` 时，文件将上传到阿里云OSS中。请确保提供正确的OSS配置。

## 扩展和定制

您可以通过以下方式扩展和定制媒体模块：

1. 添加新的存储服务（实现 `IStorageService` 接口）
2. 自定义文件命名策略和目录结构
3. 增强媒体元数据（如图片EXIF信息提取）
4. 添加图片/视频处理功能（如水印、裁剪等） 