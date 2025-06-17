# 标签和分类管理接口文档

## 概述

本文档描述了粉丝社区项目中标签（Tags）和分类（Categories）管理的API接口。这些接口用于管理媒体内容的标签和分类功能。

## 标签接口 (Tags API)

### 1. 获取所有标签

**接口地址：** `GET /media/tags`

**描述：** 获取系统中所有标签的列表，包含每个标签的使用次数统计。

**请求参数：** 无

**响应格式：**
```json
{
  "tags": [
    {
      "id": "uuid",
      "name": "演唱会",
      "created_at": "2024-01-01T00:00:00.000Z",
      "usage_count": 5
    }
  ]
}
```

### 2. 创建新标签

**接口地址：** `POST /media/tags`

**描述：** 创建一个新的标签。

**认证要求：** 需要JWT认证

**请求体：**
```json
{
  "name": "新标签名称"
}
```

**响应格式：**
```json
{
  "tag": {
    "id": "uuid",
    "name": "新标签名称",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**错误响应：**
- `400 Bad Request` - 标签已存在
- `401 Unauthorized` - 未授权

### 3. 获取标签详情

**接口地址：** `GET /media/tags/:id`

**描述：** 根据ID获取标签详情，包含使用该标签的媒体列表。

**路径参数：**
- `id` - 标签ID

**响应格式：**
```json
{
  "id": "uuid",
  "name": "演唱会",
  "created_at": "2024-01-01T00:00:00.000Z",
  "media": [
    {
      "id": "media-uuid",
      "title": "媒体标题",
      "thumbnail_url": "缩略图URL",
      "media_type": "IMAGE",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 4. 删除标签

**接口地址：** `DELETE /media/tags/:id`

**描述：** 删除指定的标签及其所有关联关系。

**认证要求：** 需要JWT认证

**路径参数：**
- `id` - 标签ID

**响应格式：**
```json
{
  "success": true,
  "message": "标签已成功删除"
}
```

### 5. 搜索标签

**接口地址：** `GET /media/tags/search/:query`

**描述：** 根据关键词模糊搜索标签。

**路径参数：**
- `query` - 搜索关键词

**响应格式：**
```json
[
  {
    "id": "uuid",
    "name": "演唱会",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

## 分类接口 (Categories API)

### 1. 获取所有分类

**接口地址：** `GET /media/categories`

**描述：** 获取系统中所有分类的列表，包含每个分类下的媒体数量统计。

**请求参数：** 无

**响应格式：**
```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "舞台照",
      "description": "演唱会和舞台表演的照片",
      "created_at": "2024-01-01T00:00:00.000Z",
      "media_count": 10
    }
  ]
}
```

### 2. 创建新分类

**接口地址：** `POST /media/categories`

**描述：** 创建一个新的分类。

**认证要求：** 需要JWT认证

**请求体：**
```json
{
  "name": "分类名称",
  "description": "分类描述（可选）"
}
```

**响应格式：**
```json
{
  "id": "uuid",
  "name": "分类名称",
  "description": "分类描述",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**错误响应：**
- `400 Bad Request` - 分类已存在
- `401 Unauthorized` - 未授权

### 3. 获取分类详情

**接口地址：** `GET /media/categories/:id`

**描述：** 根据ID获取分类详情，包含该分类下的媒体列表。

**路径参数：**
- `id` - 分类ID

**响应格式：**
```json
{
  "id": "uuid",
  "name": "舞台照",
  "description": "演唱会和舞台表演的照片",
  "created_at": "2024-01-01T00:00:00.000Z",
  "media": [
    {
      "id": "media-uuid",
      "title": "媒体标题",
      "thumbnail_url": "缩略图URL",
      "media_type": "IMAGE",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 4. 更新分类信息

**接口地址：** `PATCH /media/categories/:id`

**描述：** 更新分类的名称或描述。

**认证要求：** 需要JWT认证

**路径参数：**
- `id` - 分类ID

**请求体：**
```json
{
  "name": "新分类名称（可选）",
  "description": "新分类描述（可选）"
}
```

**响应格式：**
```json
{
  "id": "uuid",
  "name": "新分类名称",
  "description": "新分类描述",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### 5. 删除分类

**接口地址：** `DELETE /media/categories/:id`

**描述：** 删除指定的分类。如果分类下还有媒体，则无法删除。

**认证要求：** 需要JWT认证

**路径参数：**
- `id` - 分类ID

**响应格式：**
```json
{
  "success": true,
  "message": "分类已成功删除"
}
```

**错误响应：**
- `400 Bad Request` - 分类正在使用中，无法删除

## 数据验证规则

### 标签验证
- `name`: 必填，字符串，最大长度30字符，不能重复

### 分类验证
- `name`: 必填，字符串，最大长度50字符，不能重复
- `description`: 可选，字符串，最大长度200字符

## 错误处理

所有接口都遵循统一的错误响应格式：

```json
{
  "statusCode": 400,
  "message": "错误描述",
  "error": "Bad Request"
}
```

常见错误码：
- `400` - 请求参数错误
- `401` - 未授权
- `404` - 资源不存在
- `422` - 数据处理错误

## 使用示例

### 前端调用示例

```typescript
// 获取所有标签
const tags = await mediaService.getTags();

// 创建新标签
const newTag = await mediaService.createTag('新标签');

// 获取所有分类
const categories = await mediaService.getCategories();
```

### 测试接口

可以使用提供的测试脚本来验证接口：

```bash
node test-api.js
```

确保在运行测试前启动后端服务：

```bash
npm run start:dev
``` 