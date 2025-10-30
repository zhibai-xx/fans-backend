import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions, RepeatOptions } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { MyLoggerService } from 'src/my-logger/my-logger.service';

const MEDIA_CLEANUP_QUEUE = 'media-cleanup';
const HARD_DELETE_JOB = 'scheduled-hard-delete';
const DEFAULT_CRON = '0 3 * * *'; // 每天凌晨3点执行
const DEFAULT_BATCH_LIMIT = 50;

@Injectable()
export class MediaCleanupScheduler implements OnModuleInit {
  private readonly logger = new MyLoggerService(MediaCleanupScheduler.name);

  constructor(
    @InjectQueue(MEDIA_CLEANUP_QUEUE)
    private readonly cleanupQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerRecurringCleanupJob();
  }

  private async registerRecurringCleanupJob(): Promise<void> {
    const cron =
      this.configService.get<string>('MEDIA_CLEANUP_CRON') ?? DEFAULT_CRON;
    const timezone = this.configService.get<string>('MEDIA_CLEANUP_TZ');
    const batchLimitRaw = this.configService.get<string>(
      'MEDIA_CLEANUP_BATCH_LIMIT',
    );
    const batchLimit = Number(batchLimitRaw) || DEFAULT_BATCH_LIMIT;

    // 移除已存在的计划任务，避免重复注册
    const repeatJobs = await this.cleanupQueue.getRepeatableJobs();
    for (const job of repeatJobs) {
      if (job.name === HARD_DELETE_JOB) {
        await this.cleanupQueue.removeRepeatableByKey(job.key);
      }
    }

    const repeatOptions: RepeatOptions = { pattern: cron };
    if (timezone) {
      repeatOptions.tz = timezone;
    }

    const jobOptions: JobsOptions = {
      repeat: repeatOptions,
      jobId: `${HARD_DELETE_JOB}`,
      removeOnComplete: true,
      removeOnFail: false,
    };

    await this.cleanupQueue.add(
      HARD_DELETE_JOB,
      {
        limit: batchLimit,
        reason: 'Scheduled hard deletion',
      },
      jobOptions,
    );

    this.logger.log(
      `回收站清理任务已注册，Cron: ${cron}, 每批处理: ${batchLimit}, 时区: ${
        timezone ?? '系统默认'
      }`,
    );
  }
}
