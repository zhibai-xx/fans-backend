import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MyLoggerService } from '../../my-logger/my-logger.service';
import {
  VideoProcessingService,
  VideoProcessingJob,
  VideoProcessingResult,
} from '../services/video-processing.service';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
};

const getErrorStack = (error: unknown): string | undefined => {
  return error instanceof Error ? error.stack : undefined;
};

/**
 * 视频处理队列处理器
 * 负责执行异步视频处理任务
 */
@Processor('video-processing')
export class VideoProcessor extends WorkerHost {
  private readonly logger = new MyLoggerService(VideoProcessor.name);

  constructor(private videoProcessingService: VideoProcessingService) {
    super();
  }

  /**
   * 处理视频处理任务
   * @param job BullMQ队列任务
   * @returns VideoProcessingResult
   */
  async process(
    job: Job<VideoProcessingJob, VideoProcessingResult>,
  ): Promise<VideoProcessingResult> {
    // 只处理 'process-video' 任务
    if (job.name !== 'process-video') {
      throw new Error(`未知的任务类型: ${job.name}`);
    }

    this.logger.log(
      `开始执行视频处理任务: ${job.id}, 媒体ID: ${job.data.mediaId}`,
    );

    try {
      // 设置初始进度
      await job.updateProgress(0);

      // 调用视频处理服务
      const result = await this.videoProcessingService.processVideo(job.data);

      // 设置完成进度
      await job.updateProgress(100);

      this.logger.log(
        `视频处理任务完成: ${job.id}, 耗时: ${result.processingTime}ms`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `视频处理任务失败: ${job.id}, ${getErrorMessage(error)}`,
        getErrorStack(error),
      );

      // 任务失败时记录错误
      await job.updateProgress(100);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(getErrorMessage(error));
    }
  }

  /**
   * 任务完成事件处理
   * @param job BullMQ队列任务
   * @param result 处理结果
   */
  onCompleted(
    job: Job<VideoProcessingJob, VideoProcessingResult>,
    result: VideoProcessingResult,
  ) {
    this.logger.log(
      `任务完成: ${job.id}, 媒体ID: ${result.mediaId}, 成功: ${result.success}`,
    );

    // 这里可以添加完成后的通知逻辑
    // 例如：发送WebSocket通知、邮件通知等
  }

  /**
   * 任务失败事件处理
   * @param job BullMQ队列任务
   * @param error 错误信息
   */
  onFailed(job: Job<VideoProcessingJob>, error: Error) {
    this.logger.error(
      `任务失败: ${job.id}, 媒体ID: ${job.data.mediaId}, 错误: ${error.message}`,
      error.stack,
    );

    // 这里可以添加失败后的处理逻辑
    // 例如：发送告警、记录日志等
  }

  /**
   * 任务暂停事件处理
   * @param job BullMQ队列任务
   */
  onStalled(job: Job<VideoProcessingJob>) {
    this.logger.warn(`任务暂停: ${job.id}, 媒体ID: ${job.data.mediaId}`);
  }
}
