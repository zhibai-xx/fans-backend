import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { MyLoggerService } from 'src/my-logger/my-logger.service';
import {
  CommentListQueryDto,
  CommentListResponseDto,
  CommentResponseDto,
  CommentSortOption,
  CreateCommentDto,
} from '../dto/comment.dto';

const MAX_PAGE_SIZE = 50;
const REPLIES_PREVIEW_LIMIT = 3;

@Injectable()
export class MediaCommentService {
  private readonly logger = new MyLoggerService(MediaCommentService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async listComments(
    mediaId: string,
    query: CommentListQueryDto,
  ): Promise<CommentListResponseDto> {
    await this.ensureMediaExists(mediaId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;

    const where = query.parentId
      ? { media_id: mediaId, parent_id: query.parentId }
      : { media_id: mediaId, parent_id: null };

    const userSelect = {
      uuid: true,
      username: true,
      avatar_url: true,
    } as const;

    const repliesInclude = {
      orderBy: { created_at: 'asc' as const },
      take: REPLIES_PREVIEW_LIMIT,
      include: {
        user: {
          select: userSelect,
        },
      },
    } satisfies Prisma.Comment$repliesArgs;

    const include = {
      user: {
        select: userSelect,
      },
      replies: repliesInclude,
      _count: {
        select: {
          replies: true,
        },
      },
    } satisfies Prisma.CommentInclude;

    const orderBy = this.buildOrderBy(query.sort, Boolean(query.parentId));

    const [items, total] = await Promise.all([
      this.databaseService.comment.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit,
      }),
      this.databaseService.comment.count({ where }),
    ]);

    type CommentWithRelations = Prisma.CommentGetPayload<{
      include: typeof include;
    }>;

    const comments = (items as CommentWithRelations[]).map(
      (item) => new CommentResponseDto(item),
    );

    return new CommentListResponseDto(comments, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async createComment(
    mediaId: string,
    userId: number,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    await this.ensureMediaExists(mediaId);

    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('留言内容不能为空');
    }

    if (dto.parent_id) {
      const parent = await this.databaseService.comment.findUnique({
        where: { id: dto.parent_id },
        select: { id: true, media_id: true },
      });

      if (!parent || parent.media_id !== mediaId) {
        throw new BadRequestException('父级留言不存在或不属于当前视频');
      }
    }

    const comment = await this.databaseService.comment.create({
      data: {
        content,
        media_id: mediaId,
        user_id: userId,
        parent_id: dto.parent_id ?? null,
      },
      include: {
        user: {
          select: {
            uuid: true,
            username: true,
            avatar_url: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    this.logger.log(
      `用户 ${userId} 在媒体 ${mediaId} 发布留言`,
      MediaCommentService.name,
    );

    return new CommentResponseDto({ ...comment, replies: [] });
  }

  private async ensureMediaExists(mediaId: string) {
    const exists = await this.databaseService.media.findUnique({
      where: { id: mediaId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('媒体不存在');
    }
  }

  private buildOrderBy(
    sort: CommentSortOption = 'hot',
    isReplyList: boolean,
  ): Prisma.CommentOrderByWithRelationInput[] {
    if (isReplyList) {
      return [{ created_at: 'asc' }];
    }
    if (sort === 'hot') {
      return [
        { replies: { _count: 'desc' } },
        { created_at: 'desc' },
      ];
    }
    return [{ created_at: 'desc' }];
  }
}
