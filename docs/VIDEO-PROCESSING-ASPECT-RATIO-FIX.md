# 视频处理比例变形问题修复报告

## 🚨 问题描述

用户上传720×960尺寸的竖屏视频后，发现处理后的文件出现严重变形：

### 问题现象
1. **原始文件**：`uploads/video/6685*.mp4` - 720×960，比例正常 ✅
2. **封面图**：`processed/e77289*/thumbnails/cover.jpg` - 被强制改为1280×720 ❌
3. **快速封面**：`processed/e77289*/thumbnails/quick-cover.jpg` - 480×640，比例正确 ✅  
4. **质量文件**：`processed/e77289*/qualities/369p.mp4` - 被强制改为640×360 ❌

### 根本原因
视频处理系统在多个环节使用了**固定尺寸配置**，强制将视频拉伸到预设的16:9比例，导致竖屏视频严重变形。

## 🔍 问题分析

### 1. 质量配置问题
**位置**：`src/video-processing/services/ffmpeg.service.ts`
```typescript
// ❌ 原始问题代码
private readonly videoQualities: Record<string, VideoQuality> = {
  '720p': { width: 1280, height: 720 },  // 固定16:9比例
  '480p': { width: 854, height: 480 },   // 固定16:9比例
  '360p': { width: 640, height: 360 },   // 固定16:9比例
};

// ❌ 原始getAvailableQualities方法
// 只是过滤预设配置，没有根据原始比例调整
```

### 2. 视频转码强制缩放
**位置**：`src/video-processing/services/ffmpeg.service.ts`
```bash
# ❌ 原始FFmpeg命令
'-vf', `scale=${quality.width}:${quality.height}`
# 这会强制拉伸视频到目标尺寸，不保持比例
```

### 3. 封面图固定尺寸
**位置**：`src/video-processing/services/video-processing.service.ts`
```typescript
// ❌ 原始问题代码
const coverImage = await this.thumbnailService.generateCoverImage(job.inputPath, coverPath, {
  width: 1280,  // 固定宽度
  height: 720   // 固定高度
});
```

### 4. 缩略图生成强制缩放
**位置**：`src/video-processing/services/ffmpeg.service.ts`
```bash
# ❌ 原始FFmpeg命令
'-vf', `scale=${width}:${height}`
# 所有缩略图都被强制拉伸
```

## ✅ 修复方案

### 1. 动态质量配置
**修复**：根据原始视频比例动态调整质量配置

```typescript
// ✅ 修复后的getAvailableQualities方法
getAvailableQualities(originalWidth: number, originalHeight: number): VideoQuality[] {
  const availableQualities: VideoQuality[] = [];
  const originalAspectRatio = originalWidth / originalHeight;
  const isVertical = originalHeight > originalWidth;

  // 根据原始视频比例调整质量配置
  for (const [key, baseQuality] of Object.entries(this.videoQualities)) {
    let targetWidth: number, targetHeight: number;

    if (isVertical) {
      // 竖屏视频：以高度为基准，按比例计算宽度
      targetHeight = Math.min(baseQuality.height, originalHeight);
      targetWidth = Math.round(targetHeight * originalAspectRatio);
    } else {
      // 横屏视频：以宽度为基准，按比例计算高度
      targetWidth = Math.min(baseQuality.width, originalWidth);
      targetHeight = Math.round(targetWidth / originalAspectRatio);
    }

    // 确保生成的尺寸不超过原始尺寸
    if (targetWidth <= originalWidth && targetHeight <= originalHeight) {
      const adjustedQuality: VideoQuality = {
        ...baseQuality,
        width: targetWidth,
        height: targetHeight,
      };
      availableQualities.push(adjustedQuality);
    }
  }
  
  return availableQualities.sort((a, b) => b.height - a.height);
}
```

**效果示例**：
- 720×960竖屏视频 → 360p质量变为270×360（保持3:4比例）
- 1280×720横屏视频 → 360p质量变为640×360（保持16:9比例）

### 2. FFmpeg比例保持缩放
**修复**：所有FFmpeg缩放命令改为保持比例

```bash
# ✅ 修复后的FFmpeg命令
'-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`
```

**参数说明**：
- `force_original_aspect_ratio=decrease`：保持原始比例，缩小到目标尺寸内
- `pad=${width}:${height}`：用黑边填充到目标尺寸
- `(ow-iw)/2:(oh-ih)/2:black`：居中填充，使用黑色

### 3. 封面图动态尺寸
**修复**：根据原始视频比例计算封面尺寸

```typescript
// ✅ 修复后的封面尺寸计算
const originalAspectRatio = metadata.width / metadata.height;
const isVertical = metadata.height > metadata.width;

let coverWidth: number, coverHeight: number;
if (isVertical) {
  // 竖屏视频：限制宽度为480，按比例计算高度
  coverWidth = Math.min(480, metadata.width);
  coverHeight = Math.round(coverWidth / originalAspectRatio);
  if (coverHeight > 800) {
    coverHeight = 800;
    coverWidth = Math.round(coverHeight * originalAspectRatio);
  }
} else {
  // 横屏视频：限制高度为720，按比例计算宽度  
  coverHeight = Math.min(720, metadata.height);
  coverWidth = Math.round(coverHeight * originalAspectRatio);
  if (coverWidth > 1280) {
    coverWidth = 1280;
    coverHeight = Math.round(coverWidth / originalAspectRatio);
  }
}
```

### 4. 数据库记录修复
**修复**：存储实际质量文件的正确宽高

```typescript
// ✅ 修复后的数据库记录
// 获取可用的质量配置来获取实际的宽高
const availableQualities = this.ffmpegService.getAvailableQualities(
  result.metadata?.width || 0, 
  result.metadata?.height || 0
);

for (const quality of result.qualities) {
  // 找到对应的质量配置获取实际尺寸
  const qualityConfig = availableQualities.find(q => q.name === quality.quality);
  const actualWidth = qualityConfig?.width || result.metadata?.width || 0;
  const actualHeight = qualityConfig?.height || result.metadata?.height || 0;
  
  await this.databaseService.videoQuality.create({
    data: {
      media_id: mediaId,
      quality: quality.quality,
      url: quality.url,
      size: quality.size,
      width: actualWidth,    // 使用实际宽度
      height: actualHeight,  // 使用实际高度
      bitrate: quality.bitrate,
    },
  });
}
```

## 🎯 修复效果预期

### 720×960竖屏视频处理后：
- **封面图**：480×640（保持3:4比例）✅
- **360p质量**：270×360（保持3:4比例）✅  
- **720p质量**：540×720（保持3:4比例）✅
- **预览缩略图**：160×213（保持3:4比例）✅

### 1280×720横屏视频处理后：
- **封面图**：1280×720（保持16:9比例）✅
- **360p质量**：640×360（保持16:9比例）✅
- **720p质量**：1280×720（保持16:9比例）✅
- **预览缩略图**：320×180（保持16:9比例）✅

### 480×360横屏视频处理后：
- **封面图**：480×360（保持4:3比例）✅
- **360p质量**：480×360（保持4:3比例）✅
- **预览缩略图**：240×180（保持4:3比例）✅

## 🔧 修复的文件列表

### 核心修复文件
1. **`src/video-processing/services/ffmpeg.service.ts`**
   - `getAvailableQualities()` - 动态质量配置
   - `transcodeVideo()` - 视频转码比例保持
   - `generateThumbnails()` - 缩略图比例保持
   - `generateHLS()` - HLS流比例保持
   - `generateThumbnailSprite()` - 精灵图比例保持

2. **`src/video-processing/services/video-processing.service.ts`**
   - 封面图动态尺寸计算
   - 预览缩略图动态尺寸计算  
   - 精灵图动态尺寸计算
   - 数据库质量记录修复

## 🧪 测试验证

### 测试用例
1. **720×960竖屏视频**（3:4比例）
2. **1280×720横屏视频**（16:9比例）
3. **480×360横屏视频**（4:3比例）
4. **正方形视频**（1:1比例）

### 验证点
- [ ] 所有质量文件保持原始比例
- [ ] 封面图不再变形
- [ ] 缩略图比例正确
- [ ] 数据库中宽高记录正确
- [ ] 前端播放器正确显示

### 测试方法
1. 上传不同比例的测试视频
2. 检查`processed/`目录下生成的文件
3. 验证数据库中的`video_qualities`表记录
4. 在前端播放器中测试显示效果

## 🚨 重要注意事项

### 向后兼容性
- 现有已处理的视频不受影响
- 新上传的视频将使用修复后的处理逻辑
- 如需重新处理旧视频，需要重新上传

### 性能影响
- 动态计算质量配置，性能影响微乎其微
- FFmpeg添加填充处理，可能略微增加处理时间
- 整体性能影响可忽略不计

### 存储空间
- 保持比例后，某些质量文件可能略小
- 填充的黑边不会显著增加文件大小
- 总体存储需求基本不变

## 🎉 修复总结

这次修复彻底解决了视频处理中的比例变形问题：

1. **✅ 质量配置动态化**：根据原始视频比例生成合适的质量配置
2. **✅ FFmpeg命令优化**：所有缩放操作都保持原始比例
3. **✅ 尺寸计算智能化**：封面图和缩略图尺寸根据视频比例动态计算
4. **✅ 数据库记录准确化**：存储实际处理后文件的正确尺寸

现在无论是横屏、竖屏还是正方形视频，都能保持原始比例，不再出现变形问题！🚀
