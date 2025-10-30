import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EnhancedDeletionService } from '../services/enhanced-deletion.service';
import { DeletionSummary } from '../dto/enhanced-delete.dto';
import { MyLoggerService } from 'src/my-logger/my-logger.service';

const MEDIA_CLEANUP_QUEUE = 'media-cleanup';
const HARD_DELETE_JOB = 'scheduled-hard-delete';

interface MediaCleanupJobData {
  limit?: number;
  reason?: string;
}

@Processor(MEDIA_CLEANUP_QUEUE)
export class MediaCleanupProcessor extends WorkerHost {
  private readonly logger = new MyLoggerService(MediaCleanupProcessor.name);

  constructor(
    private readonly enhancedDeletionService: EnhancedDeletionService,
  ) {
    super();
  }

  async process(job: Job<MediaCleanupJobData>): Promise<DeletionSummary> {
    if (job.name !== HARD_DELETE_JOB) {
      throw new Error(`未知的任务类型: ${job.name}`);
    }

    const limit = job.data?.limit ?? 50;
    const reason =
      job.data?.reason ?? 'Scheduled hard deletion via media-cleanup queue';

    this.logger.log(
      `开始执行回收站硬删除任务: ${job.id}, 批次大小: ${limit}, 原因: ${reason}`,
    );

    const summary =
      await this.enhancedDeletionService.performScheduledHardDeletion(limit, {
        reason,
        createBackup: false,
        forceDelete: true,
        operatorId: 0,
      });

    const freedMB = summary.spaceFree / 1024 / 1024;
    this.logger.log(
      `回收站硬删除完成，处理: ${summary.totalRequested} 条，成功: ${summary.successfulDeletions} 条，释放 ${freedMB.toFixed(2)} MB`,
    );

    return summary;
  }
}
