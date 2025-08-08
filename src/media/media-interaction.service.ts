import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { MyLoggerService } from 'src/my-logger/my-logger.service';
import {
  LikeStatusDto,
  MediaInteractionStatusDto,
  BatchLikeStatusDto,
  BatchFavoriteStatusDto
} from './dto/like.dto';
import { FavoriteStatusDto } from './dto/favorite.dto';

@Injectable()
export class MediaInteractionService {
  private readonly logger = new MyLoggerService(MediaInteractionService.name);

  constructor(private readonly databaseService: DatabaseService) { }

  // ===========================================
  // 点赞相关方法
  // ===========================================

  /**
   * 点赞媒体
   */
  async likeMedia(userId: number, mediaId: string) {
    try {
      // 检查媒体是否存在
      const media = await this.databaseService.media.findUnique({
        where: { id: mediaId },
      });

      if (!media) {
        throw new NotFoundException('媒体不存在');
      }

      // 检查是否已经点赞
      const existingLike = await this.databaseService.like.findUnique({
        where: {
          user_id_media_id: {
            user_id: userId,
            media_id: mediaId,
          },
        },
      });

      if (existingLike) {
        throw new ConflictException('您已经点赞过该媒体');
      }

      // 开始数据库事务
      return await this.databaseService.$transaction(async (prisma) => {
        // 创建点赞记录
        const like = await prisma.like.create({
          data: {
            user_id: userId,
            media_id: mediaId,
          },
        });

        // 更新媒体的点赞数
        await prisma.media.update({
          where: { id: mediaId },
          data: {
            likes_count: {
              increment: 1,
            },
          },
        });

        return like;
      });
    } catch (error) {
      this.logger.error(`点赞失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 取消点赞
   */
  async unlikeMedia(userId: number, mediaId: string) {
    try {
      // 检查点赞记录是否存在
      const existingLike = await this.databaseService.like.findUnique({
        where: {
          user_id_media_id: {
            user_id: userId,
            media_id: mediaId,
          },
        },
      });

      if (!existingLike) {
        throw new NotFoundException('未找到点赞记录');
      }

      // 开始数据库事务
      return await this.databaseService.$transaction(async (prisma) => {
        // 删除点赞记录
        await prisma.like.delete({
          where: {
            user_id_media_id: {
              user_id: userId,
              media_id: mediaId,
            },
          },
        });

        // 更新媒体的点赞数
        await prisma.media.update({
          where: { id: mediaId },
          data: {
            likes_count: {
              decrement: 1,
            },
          },
        });
      });
    } catch (error) {
      this.logger.error(`取消点赞失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 获取点赞状态
   */
  async getLikeStatus(userId: number, mediaId: string): Promise<LikeStatusDto> {
    try {
      // 检查是否已点赞
      const existingLike = await this.databaseService.like.findUnique({
        where: {
          user_id_media_id: {
            user_id: userId,
            media_id: mediaId,
          },
        },
      });

      // 获取媒体的点赞总数
      const media = await this.databaseService.media.findUnique({
        where: { id: mediaId },
        select: { likes_count: true },
      });

      if (!media) {
        throw new NotFoundException('媒体不存在');
      }

      return new LikeStatusDto(!!existingLike, media.likes_count);
    } catch (error) {
      this.logger.error(`获取点赞状态失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ===========================================
  // 收藏相关方法
  // ===========================================

  /**
   * 收藏媒体
   */
  async favoriteMedia(userId: number, mediaId: string) {
    try {
      // 检查媒体是否存在
      const media = await this.databaseService.media.findUnique({
        where: { id: mediaId },
      });

      if (!media) {
        throw new NotFoundException('媒体不存在');
      }

      // 检查是否已经收藏
      const existingFavorite = await this.databaseService.favorite.findUnique({
        where: {
          user_id_media_id: {
            user_id: userId,
            media_id: mediaId,
          },
        },
      });

      if (existingFavorite) {
        throw new ConflictException('您已经收藏过该媒体');
      }

      // 开始数据库事务
      return await this.databaseService.$transaction(async (prisma) => {
        // 创建收藏记录
        const favorite = await prisma.favorite.create({
          data: {
            user_id: userId,
            media_id: mediaId,
          },
        });

        // 更新媒体的收藏数
        await prisma.media.update({
          where: { id: mediaId },
          data: {
            favorites_count: {
              increment: 1,
            },
          },
        });

        return favorite;
      });
    } catch (error) {
      this.logger.error(`收藏失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 取消收藏
   */
  async unfavoriteMedia(userId: number, mediaId: string) {
    try {
      // 检查收藏记录是否存在
      const existingFavorite = await this.databaseService.favorite.findUnique({
        where: {
          user_id_media_id: {
            user_id: userId,
            media_id: mediaId,
          },
        },
      });

      if (!existingFavorite) {
        throw new NotFoundException('未找到收藏记录');
      }

      // 开始数据库事务
      return await this.databaseService.$transaction(async (prisma) => {
        // 删除收藏记录
        await prisma.favorite.delete({
          where: {
            user_id_media_id: {
              user_id: userId,
              media_id: mediaId,
            },
          },
        });

        // 更新媒体的收藏数
        await prisma.media.update({
          where: { id: mediaId },
          data: {
            favorites_count: {
              decrement: 1,
            },
          },
        });
      });
    } catch (error) {
      this.logger.error(`取消收藏失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 获取收藏状态
   */
  async getFavoriteStatus(userId: number, mediaId: string): Promise<FavoriteStatusDto> {
    try {
      // 检查是否已收藏
      const existingFavorite = await this.databaseService.favorite.findUnique({
        where: {
          user_id_media_id: {
            user_id: userId,
            media_id: mediaId,
          },
        },
      });

      // 获取媒体的收藏总数
      const media = await this.databaseService.media.findUnique({
        where: { id: mediaId },
        select: { favorites_count: true },
      });

      if (!media) {
        throw new NotFoundException('媒体不存在');
      }

      return new FavoriteStatusDto(!!existingFavorite, media.favorites_count);
    } catch (error) {
      this.logger.error(`获取收藏状态失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 获取用户收藏列表
   */
  async getUserFavorites(userId: number, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;

      // 获取用户收藏的媒体列表
      const [favorites, total] = await Promise.all([
        this.databaseService.favorite.findMany({
          where: { user_id: userId },
          include: {
            media: {
              include: {
                user: true,
                category: true,
                media_tags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.databaseService.favorite.count({
          where: { user_id: userId },
        }),
      ]);

      return {
        data: favorites.map(favorite => favorite.media),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`获取用户收藏列表失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ===========================================
  // 综合状态方法
  // ===========================================

  /**
   * 获取媒体互动状态（点赞+收藏）
   */
  async getMediaInteractionStatus(
    userId: number,
    mediaId: string
  ): Promise<MediaInteractionStatusDto> {
    try {
      // 并行查询点赞和收藏状态
      const [like, favorite, media] = await Promise.all([
        this.databaseService.like.findUnique({
          where: {
            user_id_media_id: {
              user_id: userId,
              media_id: mediaId,
            },
          },
        }),
        this.databaseService.favorite.findUnique({
          where: {
            user_id_media_id: {
              user_id: userId,
              media_id: mediaId,
            },
          },
        }),
        this.databaseService.media.findUnique({
          where: { id: mediaId },
          select: { likes_count: true, favorites_count: true },
        }),
      ]);

      if (!media) {
        throw new NotFoundException('媒体不存在');
      }

      return new MediaInteractionStatusDto(
        !!like,
        !!favorite,
        media.likes_count,
        media.favorites_count
      );
    } catch (error) {
      this.logger.error(`获取媒体互动状态失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 批量获取点赞状态
   */
  async getBatchLikeStatus(
    userId: number,
    mediaIds: string[]
  ): Promise<BatchLikeStatusDto> {
    try {
      const likes = await this.databaseService.like.findMany({
        where: {
          user_id: userId,
          media_id: { in: mediaIds },
        },
        select: { media_id: true },
      });

      const likedMediaIds = new Set(likes.map(like => like.media_id));
      const likesStatus = mediaIds.reduce((acc, mediaId) => {
        acc[mediaId] = likedMediaIds.has(mediaId);
        return acc;
      }, {} as Record<string, boolean>);

      return new BatchLikeStatusDto(likesStatus);
    } catch (error) {
      this.logger.error(`批量获取点赞状态失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 批量获取收藏状态
   */
  async getBatchFavoriteStatus(
    userId: number,
    mediaIds: string[]
  ): Promise<BatchFavoriteStatusDto> {
    try {
      const favorites = await this.databaseService.favorite.findMany({
        where: {
          user_id: userId,
          media_id: { in: mediaIds },
        },
        select: { media_id: true },
      });

      const favoritedMediaIds = new Set(favorites.map(favorite => favorite.media_id));
      const favoritesStatus = mediaIds.reduce((acc, mediaId) => {
        acc[mediaId] = favoritedMediaIds.has(mediaId);
        return acc;
      }, {} as Record<string, boolean>);

      return new BatchFavoriteStatusDto(favoritesStatus);
    } catch (error) {
      this.logger.error(`批量获取收藏状态失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ===========================================
  // 统计相关方法
  // ===========================================

  /**
   * 获取媒体统计信息
   */
  async getMediaStats(mediaId: string) {
    try {
      const stats = await this.databaseService.media.findUnique({
        where: { id: mediaId },
        select: {
          id: true,
          title: true,
          views: true,
          likes_count: true,
          favorites_count: true,
          _count: {
            select: {
              comments: true,
            },
          },
        },
      });

      if (!stats) {
        throw new NotFoundException('媒体不存在');
      }

      return stats;
    } catch (error) {
      this.logger.error(`获取媒体统计信息失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 获取用户互动统计
   */
  async getUserInteractionStats(userId: number) {
    try {
      const [likesCount, favoritesCount, receivedLikes, receivedFavorites] = await Promise.all([
        // 用户发出的点赞数
        this.databaseService.like.count({
          where: { user_id: userId },
        }),
        // 用户发出的收藏数
        this.databaseService.favorite.count({
          where: { user_id: userId },
        }),
        // 用户作品获得的点赞数
        this.databaseService.media.aggregate({
          where: { user_id: userId },
          _sum: { likes_count: true },
        }),
        // 用户作品获得的收藏数
        this.databaseService.media.aggregate({
          where: { user_id: userId },
          _sum: { favorites_count: true },
        }),
      ]);

      return {
        given_likes: likesCount,
        given_favorites: favoritesCount,
        received_likes: receivedLikes._sum.likes_count || 0,
        received_favorites: receivedFavorites._sum.favorites_count || 0,
      };
    } catch (error) {
      this.logger.error(`获取用户互动统计失败: ${error.message}`, error.stack);
      throw error;
    }
  }
}
