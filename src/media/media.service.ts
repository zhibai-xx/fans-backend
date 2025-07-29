// src/media/media.service.ts
import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { MediaType, MediaStatus, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/database/database.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import {
    BatchUpdateStatusDto,
    BatchUpdateTagsDto,
    BatchUpdateCategoryDto,
    ReviewFilterDto,
    ReviewStatsDto,
    BatchOperationResultDto
} from './dto/review.dto';
import { MyLoggerService } from 'src/my-logger/my-logger.service';

@Injectable()
export class MediaService {
    private readonly logger = new MyLoggerService(MediaService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private configService: ConfigService,
    ) { }

    /**
     * 创建媒体记录（不包含文件上传）
     * @param data 媒体数据
     * @returns 创建的媒体记录
     */
    async create(data: {
        title: string;
        description?: string;
        url: string;
        size: number;
        media_type: MediaType;
        user_id: number;
        category_id?: string;
        tag_ids?: string[];
    }) {
        try {
            // 创建基本媒体记录
            const media = await this.databaseService.media.create({
                data: {
                    title: data.title,
                    description: data.description,
                    url: data.url,
                    size: data.size,
                    media_type: data.media_type,
                    status: MediaStatus.PENDING,

                    user: {
                        connect: { id: data.user_id }
                    },
                    category: data.category_id ? {
                        connect: { id: data.category_id }
                    } : undefined
                },
                include: {
                    category: true,
                    tags: {
                        include: {
                            tag: true
                        }
                    }
                }
            });

            // 如果提供了标签，创建关联
            if (data.tag_ids && data.tag_ids.length > 0) {
                // 先验证标签是否存在
                const existingTags = await this.databaseService.tag.findMany({
                    where: {
                        id: { in: data.tag_ids }
                    }
                });

                const existingTagIds = existingTags.map(tag => tag.id);

                // 只关联存在的标签
                for (const tagId of existingTagIds) {
                    await this.databaseService.mediaTag.create({
                        data: {
                            media: { connect: { id: media.id } },
                            tag: { connect: { id: tagId } }
                        }
                    });
                }

                // 如果有不存在的标签，记录警告
                const missingTagIds = data.tag_ids.filter(id => !existingTagIds.includes(id));
                if (missingTagIds.length > 0) {
                    this.logger.warn(`以下标签ID不存在，已跳过: ${missingTagIds.join(', ')}`);
                }
            }

            // 返回完整的媒体记录
            return await this.databaseService.media.findUnique({
                where: { id: media.id },
                include: {
                    category: true,
                    tags: {
                        include: {
                            tag: true
                        }
                    }
                }
            });
        } catch (error) {
            this.logger.error(`创建媒体记录失败: ${error.message}`, error.stack);
            throw new UnprocessableEntityException(`创建媒体记录失败: ${error.message}`);
        }
    }



    /**
     * 获取所有媒体列表，支持按类型、用户和状态筛选
     * @param options 查询选项
     * @returns 媒体列表
     */
    async findAll(options: {
        userId?: number;
        mediaType?: MediaType;
        status?: MediaStatus;
        skip?: number;
        take?: number;
    }) {
        const { userId, mediaType, status, skip = 0, take = 10 } = options;

        // 构建查询条件
        const where: Prisma.MediaWhereInput = {};

        if (userId) {
            where.user_id = userId;
        }

        if (mediaType) {
            where.media_type = mediaType;
        }

        if (status) {
            where.status = status;
        }

        // 查询媒体列表
        const [media, total] = await Promise.all([
            this.databaseService.media.findMany({
                where,
                skip,
                take,
                orderBy: { created_at: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            avatar_url: true
                        }
                    },
                    category: true,
                    tags: {
                        include: {
                            tag: true
                        }
                    }
                }
            }),
            this.databaseService.media.count({ where })
        ]);

        return {
            data: media,
            meta: {
                total,
                skip,
                take,
                hasMore: skip + take < total
            }
        };
    }

    /**
     * 根据ID获取媒体详情
     * @param id 媒体ID
     * @returns 媒体详情
     */
    async findOne(id: string) {
        const media = await this.databaseService.media.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar_url: true
                    }
                },
                category: true,
                tags: {
                    include: {
                        tag: true
                    }
                },
                comments: {
                    where: { parent_id: null },
                    orderBy: { created_at: 'desc' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatar_url: true
                            }
                        },
                        replies: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        username: true,
                                        avatar_url: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!media) {
            throw new NotFoundException('媒体不存在');
        }

        // 更新浏览次数 - 使用原始SQL而不是increment
        await this.databaseService.$executeRaw`
            UPDATE "Media" SET "views" = "views" + 1 WHERE "id" = ${id}
        `;

        return media;
    }

    /**
     * 删除媒体文件及相关数据
     * @param id 媒体ID
     * @param userId 用户ID（用于验证权限）
     * @returns 删除结果
     */
    async deleteMedia(id: string, userId: number) {
        // 查找媒体记录
        const media = await this.databaseService.media.findUnique({
            where: { id }
        });

        if (!media) {
            throw new NotFoundException('媒体不存在');
        }

        // 验证是否是媒体所有者
        if (media.user_id !== userId) {
            throw new ForbiddenException('您没有权限删除此媒体');
        }

        try {
            // 注意：实际文件删除现在由 upload 模块处理
            // 这里只删除数据库记录

            // 删除关联的标签、评论和收藏
            await this.databaseService.$transaction([
                // 删除媒体标签关联
                this.databaseService.mediaTag.deleteMany({
                    where: { media_id: id }
                }),
                // 删除媒体评论
                this.databaseService.comment.deleteMany({
                    where: { media_id: id }
                }),
                // 删除媒体收藏
                this.databaseService.favorite.deleteMany({
                    where: { media_id: id }
                }),
                // 删除媒体记录
                this.databaseService.media.delete({
                    where: { id }
                })
            ]);

            return { success: true, message: '媒体已成功删除' };
        } catch (error) {
            this.logger.error(`删除媒体失败: ${error.message}`, error.stack);
            throw new UnprocessableEntityException(`删除媒体失败: ${error.message}`);
        }
    }

    /**
     * 更新媒体状态（审核）
     * @param id 媒体ID
     * @param status 新状态
     * @param adminId 管理员ID
     * @returns 更新后的媒体
     */
    async updateStatus(id: string, status: MediaStatus, adminId: number) {
        // 验证管理员身份
        const admin = await this.databaseService.user.findUnique({
            where: { id: adminId }
        });

        if (!admin || admin.role !== 'ADMIN') {
            throw new ForbiddenException('只有管理员可以更新媒体状态');
        }

        // 查找并更新媒体状态
        const updatedMedia = await this.databaseService.media.update({
            where: { id },
            data: { status }
        });

        return updatedMedia;
    }

    // =====================================
    // 标签相关方法
    // =====================================

    /**
     * 获取所有标签
     * @returns 标签列表
     */
    async getAllTags() {
        try {
            const tags = await this.databaseService.tag.findMany({
                orderBy: { created_at: 'desc' },
                include: {
                    _count: {
                        select: {
                            media_tags: true
                        }
                    }
                }
            });

            return tags.map(tag => ({
                id: tag.id,
                name: tag.name,
                created_at: tag.created_at,
                usage_count: tag._count.media_tags
            }));
        } catch (error) {
            this.logger.error(`获取标签列表失败: ${error.message}`, error.stack);
            throw new UnprocessableEntityException(`获取标签列表失败: ${error.message}`);
        }
    }

    /**
     * 创建新标签
     * @param createTagDto 标签创建数据
     * @returns 创建的标签
     */
    async createTag(createTagDto: CreateTagDto) {
        try {
            // 检查标签是否已存在
            const existingTag = await this.databaseService.tag.findUnique({
                where: { name: createTagDto.name }
            });

            if (existingTag) {
                throw new BadRequestException('标签已存在');
            }

            // 创建新标签
            const tag = await this.databaseService.tag.create({
                data: {
                    name: createTagDto.name
                }
            });

            this.logger.log(`创建新标签: ${tag.name}`, MediaService.name);
            return tag;
        } catch (error) {
            this.logger.error(`创建标签失败: ${error.message}`, error.stack);

            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new UnprocessableEntityException(`创建标签失败: ${error.message}`);
        }
    }

    /**
     * 根据ID获取标签详情
     * @param id 标签ID
     * @returns 标签详情
     */
    async getTagById(id: string) {
        try {
            const tag = await this.databaseService.tag.findUnique({
                where: { id },
                include: {
                    media_tags: {
                        include: {
                            media: {
                                select: {
                                    id: true,
                                    title: true,
                                    thumbnail_url: true,
                                    media_type: true,
                                    created_at: true
                                }
                            }
                        }
                    }
                }
            });

            if (!tag) {
                throw new NotFoundException('标签不存在');
            }

            return {
                id: tag.id,
                name: tag.name,
                created_at: tag.created_at,
                media: tag.media_tags.map(mt => mt.media)
            };
        } catch (error) {
            this.logger.error(`获取标签详情失败: ${error.message}`, error.stack);

            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new UnprocessableEntityException(`获取标签详情失败: ${error.message}`);
        }
    }

    /**
     * 删除标签
     * @param id 标签ID
     * @returns 删除结果
     */
    async deleteTag(id: string) {
        try {
            // 检查标签是否存在
            const tag = await this.databaseService.tag.findUnique({
                where: { id }
            });

            if (!tag) {
                throw new NotFoundException('标签不存在');
            }

            // 删除标签及其关联关系
            await this.databaseService.$transaction([
                // 删除媒体标签关联
                this.databaseService.mediaTag.deleteMany({
                    where: { tag_id: id }
                }),
                // 删除标签
                this.databaseService.tag.delete({
                    where: { id }
                })
            ]);

            this.logger.log(`删除标签: ${tag.name}`, MediaService.name);
            return { success: true, message: '标签已成功删除' };
        } catch (error) {
            this.logger.error(`删除标签失败: ${error.message}`, error.stack);

            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new UnprocessableEntityException(`删除标签失败: ${error.message}`);
        }
    }

    /**
     * 搜索标签（按名称模糊匹配）
     * @param query 搜索关键词
     * @returns 匹配的标签列表
     */
    async searchTags(query: string) {
        try {
            const tags = await this.databaseService.tag.findMany({
                where: {
                    name: {
                        contains: query,
                        mode: 'insensitive'
                    }
                },
                orderBy: { created_at: 'desc' },
                take: 20 // 限制返回数量
            });

            return tags;
        } catch (error) {
            this.logger.error(`搜索标签失败: ${error.message}`, error.stack);
            throw new UnprocessableEntityException(`搜索标签失败: ${error.message}`);
        }
    }

    // =====================================
    // 分类相关方法
    // =====================================

    /**
     * 获取所有分类
     * @returns 分类列表
     */
    async getAllCategories() {
        try {
            const categories = await this.databaseService.category.findMany({
                orderBy: { created_at: 'desc' },
                include: {
                    _count: {
                        select: {
                            media: true
                        }
                    }
                }
            });

            return categories.map(category => ({
                id: category.id,
                name: category.name,
                description: category.description,
                created_at: category.created_at,
                media_count: category._count.media
            }));
        } catch (error) {
            this.logger.error(`获取分类列表失败: ${error.message}`, error.stack);
            throw new UnprocessableEntityException(`获取分类列表失败: ${error.message}`);
        }
    }

    /**
     * 创建新分类
     * @param createCategoryDto 分类创建数据
     * @returns 创建的分类
     */
    async createCategory(createCategoryDto: CreateCategoryDto) {
        try {
            // 检查分类是否已存在
            const existingCategory = await this.databaseService.category.findUnique({
                where: { name: createCategoryDto.name }
            });

            if (existingCategory) {
                throw new BadRequestException('分类已存在');
            }

            // 创建新分类
            const category = await this.databaseService.category.create({
                data: {
                    name: createCategoryDto.name,
                    description: createCategoryDto.description
                }
            });

            this.logger.log(`创建新分类: ${category.name}`, MediaService.name);
            return category;
        } catch (error) {
            this.logger.error(`创建分类失败: ${error.message}`, error.stack);

            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new UnprocessableEntityException(`创建分类失败: ${error.message}`);
        }
    }

    /**
     * 根据ID获取分类详情
     * @param id 分类ID
     * @returns 分类详情
     */
    async getCategoryById(id: string) {
        try {
            const category = await this.databaseService.category.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            media: true
                        }
                    }
                }
            });

            if (!category) {
                throw new NotFoundException('分类不存在');
            }

            return {
                id: category.id,
                name: category.name,
                description: category.description,
                created_at: category.created_at,
                media_count: category._count.media
            };
        } catch (error) {
            this.logger.error(`获取分类详情失败: ${error.message}`, error.stack);

            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new UnprocessableEntityException(`获取分类详情失败: ${error.message}`);
        }
    }

    /**
     * 删除分类
     * @param id 分类ID
     * @returns 删除结果
     */
    async deleteCategory(id: string) {
        try {
            // 检查分类是否存在
            const category = await this.databaseService.category.findUnique({
                where: { id }
            });

            if (!category) {
                throw new NotFoundException('分类不存在');
            }

            // 检查是否有媒体使用此分类
            const mediaCount = await this.databaseService.media.count({
                where: { category_id: id }
            });

            if (mediaCount > 0) {
                throw new BadRequestException(`无法删除分类，还有 ${mediaCount} 个媒体正在使用此分类`);
            }

            // 删除分类
            await this.databaseService.category.delete({
                where: { id }
            });

            this.logger.log(`删除分类: ${category.name}`, MediaService.name);
            return { success: true, message: '分类已成功删除' };
        } catch (error) {
            this.logger.error(`删除分类失败: ${error.message}`, error.stack);

            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            throw new UnprocessableEntityException(`删除分类失败: ${error.message}`);
        }
    }

    /**
     * 更新分类信息
     * @param id 分类ID
     * @param updateData 更新数据
     * @returns 更新后的分类
     */
    async updateCategory(id: string, updateData: Partial<CreateCategoryDto>) {
        try {
            // 检查分类是否存在
            const existingCategory = await this.databaseService.category.findUnique({
                where: { id }
            });

            if (!existingCategory) {
                throw new NotFoundException('分类不存在');
            }

            // 如果要更新名称，检查新名称是否已存在
            if (updateData.name && updateData.name !== existingCategory.name) {
                const nameExists = await this.databaseService.category.findUnique({
                    where: { name: updateData.name }
                });

                if (nameExists) {
                    throw new BadRequestException('分类名称已存在');
                }
            }

            // 更新分类
            const updatedCategory = await this.databaseService.category.update({
                where: { id },
                data: updateData
            });

            this.logger.log(`更新分类: ${updatedCategory.name}`, MediaService.name);
            return updatedCategory;
        } catch (error) {
            this.logger.error(`更新分类失败: ${error.message}`, error.stack);

            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            throw new UnprocessableEntityException(`更新分类失败: ${error.message}`);
        }
    }

    /**
     * 获取审核统计信息
     * @returns 审核统计数据
     */
    async getReviewStats(): Promise<ReviewStatsDto> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [
            totalCount,
            statusCounts,
            typeCounts,
            todayPendingCount,
            todayReviewedCount
        ] = await Promise.all([
            // 总媒体数
            this.databaseService.media.count(),

            // 按状态统计
            this.databaseService.media.groupBy({
                by: ['status'],
                _count: true
            }),

            // 按类型统计
            this.databaseService.media.groupBy({
                by: ['media_type'],
                _count: true
            }),

            // 今日待审核数量
            this.databaseService.media.count({
                where: {
                    status: MediaStatus.PENDING,
                    created_at: {
                        gte: today
                    }
                }
            }),

            // 今日已审核数量
            this.databaseService.media.count({
                where: {
                    status: {
                        in: [MediaStatus.APPROVED, MediaStatus.REJECTED]
                    },
                    updated_at: {
                        gte: today,
                        lt: tomorrow
                    }
                }
            })
        ]);

        // 处理统计数据
        const stats = {
            total: totalCount,
            pending: 0,
            approved: 0,
            rejected: 0,
            private: 0,
            images: 0,
            videos: 0,
            todayPending: todayPendingCount,
            todayReviewed: todayReviewedCount
        };

        // 按状态统计
        statusCounts.forEach(item => {
            switch (item.status) {
                case MediaStatus.PENDING:
                    stats.pending = item._count;
                    break;
                case MediaStatus.APPROVED:
                    stats.approved = item._count;
                    break;
                case MediaStatus.REJECTED:
                    stats.rejected = item._count;
                    break;
                case MediaStatus.PRIVATE:
                    stats.private = item._count;
                    break;
            }
        });

        // 按类型统计
        typeCounts.forEach(item => {
            switch (item.media_type) {
                case MediaType.IMAGE:
                    stats.images = item._count;
                    break;
                case MediaType.VIDEO:
                    stats.videos = item._count;
                    break;
            }
        });

        return new ReviewStatsDto(stats);
    }

    /**
     * 高级筛选获取媒体列表（用于审核）
     * @param filters 筛选条件
     * @param userUuidService 用户UUID服务
     * @returns 筛选后的媒体列表
     */
    async getMediaForReview(filters: ReviewFilterDto, userUuidService: any) {
        const {
            type,
            status,
            categoryId,
            tagId,
            userUuid,
            search,
            sortBy = 'created_at',
            sortOrder = 'desc',
            skip = 0,
            take = 20
        } = filters;

        // 构建查询条件
        const where: Prisma.MediaWhereInput = {};

        if (type) {
            where.media_type = type;
        }

        if (status) {
            where.status = status;
        }

        if (categoryId) {
            where.category_id = categoryId;
        }

        if (tagId) {
            where.tags = {
                some: {
                    tag_id: tagId
                }
            };
        }

        if (userUuid) {
            const userId = await userUuidService.getInternalIdByUuid(userUuid);
            if (userId) {
                where.user_id = userId;
            }
        }

        if (search) {
            const searchTerm = search.trim();
            console.log('🔍 搜索调试信息:', {
                originalSearch: search,
                trimmedSearch: searchTerm,
                searchLength: searchTerm.length,
                hasUnderscore: searchTerm.includes('_'),
                hasPercent: searchTerm.includes('%')
            });

            if (searchTerm) {
                where.OR = [
                    {
                        title: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    },
                    {
                        description: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    }
                ];

                console.log('📊 搜索查询条件:', JSON.stringify(where, null, 2));
            }
        }

        // 构建排序条件
        const orderBy: Prisma.MediaOrderByWithRelationInput = {};
        orderBy[sortBy] = sortOrder;

        // 查询媒体列表
        const [media, total] = await Promise.all([
            this.databaseService.media.findMany({
                where,
                skip,
                take,
                orderBy,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            avatar_url: true,
                            uuid: true
                        }
                    },
                    category: true,
                    tags: {
                        include: {
                            tag: true
                        }
                    }
                }
            }),
            this.databaseService.media.count({ where })
        ]);

        return {
            data: media,
            meta: {
                total,
                skip,
                take,
                hasMore: skip + take < total
            }
        };
    }

    /**
     * 批量更新媒体状态
     * @param dto 批量更新数据
     * @param adminId 管理员ID
     * @returns 批量操作结果
     */
    async batchUpdateStatus(dto: BatchUpdateStatusDto, adminId: number): Promise<BatchOperationResultDto> {
        // 验证管理员身份
        const admin = await this.databaseService.user.findUnique({
            where: { id: adminId }
        });

        if (!admin || admin.role !== 'ADMIN') {
            throw new ForbiddenException('只有管理员可以批量更新媒体状态');
        }

        const successIds: string[] = [];
        const failureIds: string[] = [];
        const errors: string[] = [];

        // 批量处理每个媒体
        for (const mediaId of dto.mediaIds) {
            try {
                const media = await this.databaseService.media.findUnique({
                    where: { id: mediaId }
                });

                if (!media) {
                    failureIds.push(mediaId);
                    errors.push(`媒体 ${mediaId} 不存在`);
                    continue;
                }

                await this.databaseService.media.update({
                    where: { id: mediaId },
                    data: {
                        status: dto.status,
                        updated_at: new Date()
                    }
                });

                successIds.push(mediaId);
                this.logger.log(`管理员 ${adminId} 更新媒体 ${mediaId} 状态为 ${dto.status}`);

            } catch (error) {
                failureIds.push(mediaId);
                errors.push(`更新媒体 ${mediaId} 失败: ${error.message}`);
                this.logger.error(`批量更新媒体状态失败: ${error.message}`, error.stack);
            }
        }

        return new BatchOperationResultDto(successIds, failureIds, errors);
    }

    /**
     * 批量更新媒体标签
     * @param dto 批量标签更新数据
     * @param adminId 管理员ID
     * @returns 批量操作结果
     */
    async batchUpdateTags(dto: BatchUpdateTagsDto, adminId: number): Promise<BatchOperationResultDto> {
        // 验证管理员身份
        const admin = await this.databaseService.user.findUnique({
            where: { id: adminId }
        });

        if (!admin || admin.role !== 'ADMIN') {
            throw new ForbiddenException('只有管理员可以批量更新媒体标签');
        }

        // 验证标签是否存在
        const tags = await this.databaseService.tag.findMany({
            where: { id: { in: dto.tagIds } }
        });

        if (tags.length !== dto.tagIds.length) {
            throw new BadRequestException('部分标签不存在');
        }

        const successIds: string[] = [];
        const failureIds: string[] = [];
        const errors: string[] = [];

        // 批量处理每个媒体
        for (const mediaId of dto.mediaIds) {
            try {
                const media = await this.databaseService.media.findUnique({
                    where: { id: mediaId }
                });

                if (!media) {
                    failureIds.push(mediaId);
                    errors.push(`媒体 ${mediaId} 不存在`);
                    continue;
                }

                if (dto.action === 'replace') {
                    // 替换标签：先删除现有标签关联，再添加新标签
                    await this.databaseService.$transaction(async (tx) => {
                        await tx.mediaTag.deleteMany({
                            where: { media_id: mediaId }
                        });

                        if (dto.tagIds.length > 0) {
                            await tx.mediaTag.createMany({
                                data: dto.tagIds.map(tagId => ({
                                    media_id: mediaId,
                                    tag_id: tagId
                                }))
                            });
                        }
                    });
                } else {
                    // 添加标签：只添加不存在的标签关联
                    const existingTags = await this.databaseService.mediaTag.findMany({
                        where: {
                            media_id: mediaId,
                            tag_id: { in: dto.tagIds }
                        }
                    });

                    const existingTagIds = existingTags.map(mt => mt.tag_id);
                    const newTagIds = dto.tagIds.filter(tagId => !existingTagIds.includes(tagId));

                    if (newTagIds.length > 0) {
                        await this.databaseService.mediaTag.createMany({
                            data: newTagIds.map(tagId => ({
                                media_id: mediaId,
                                tag_id: tagId
                            }))
                        });
                    }
                }

                successIds.push(mediaId);
                this.logger.log(`管理员 ${adminId} 批量更新媒体 ${mediaId} 标签`);

            } catch (error) {
                failureIds.push(mediaId);
                errors.push(`更新媒体 ${mediaId} 标签失败: ${error.message}`);
                this.logger.error(`批量更新媒体标签失败: ${error.message}`, error.stack);
            }
        }

        return new BatchOperationResultDto(successIds, failureIds, errors);
    }

    /**
     * 批量更新媒体分类
     * @param dto 批量分类更新数据
     * @param adminId 管理员ID
     * @returns 批量操作结果
     */
    async batchUpdateCategory(dto: BatchUpdateCategoryDto, adminId: number): Promise<BatchOperationResultDto> {
        // 验证管理员身份
        const admin = await this.databaseService.user.findUnique({
            where: { id: adminId }
        });

        if (!admin || admin.role !== 'ADMIN') {
            throw new ForbiddenException('只有管理员可以批量更新媒体分类');
        }

        // 验证分类是否存在（如果提供了分类ID）
        if (dto.categoryId) {
            const category = await this.databaseService.category.findUnique({
                where: { id: dto.categoryId }
            });

            if (!category) {
                throw new BadRequestException('指定的分类不存在');
            }
        }

        const successIds: string[] = [];
        const failureIds: string[] = [];
        const errors: string[] = [];

        // 批量处理每个媒体
        for (const mediaId of dto.mediaIds) {
            try {
                const media = await this.databaseService.media.findUnique({
                    where: { id: mediaId }
                });

                if (!media) {
                    failureIds.push(mediaId);
                    errors.push(`媒体 ${mediaId} 不存在`);
                    continue;
                }

                // 准备更新数据
                const updateData: any = {
                    updated_at: new Date()
                };

                // 处理分类关联 - 使用Prisma关系语法
                if (dto.categoryId) {
                    // 连接到新分类
                    updateData.category = {
                        connect: { id: dto.categoryId }
                    };
                } else {
                    // 断开分类关联（设置为无分类）
                    updateData.category = {
                        disconnect: true
                    };
                }

                await this.databaseService.media.update({
                    where: { id: mediaId },
                    data: updateData
                });

                successIds.push(mediaId);
                this.logger.log(`管理员 ${adminId} 更新媒体 ${mediaId} 分类为 ${dto.categoryId || '无'}`);

            } catch (error) {
                failureIds.push(mediaId);
                errors.push(`更新媒体 ${mediaId} 分类失败: ${error.message}`);
                this.logger.error(`批量更新媒体分类失败: ${error.message}`, error.stack);
            }
        }

        return new BatchOperationResultDto(successIds, failureIds, errors);
    }

    /**
     * 更新媒体信息（管理员专用）
     * @param id 媒体ID
     * @param updateMediaDto 更新数据
     * @param userId 用户ID
     * @returns 更新后的媒体信息
     */
    async updateMediaInfo(id: string, updateMediaDto: UpdateMediaDto, userId: number) {
        try {
            // 验证管理员身份
            const user = await this.databaseService.user.findUnique({
                where: { id: userId }
            });

            if (!user || user.role !== 'ADMIN') {
                throw new ForbiddenException('只有管理员可以编辑媒体信息');
            }

            // 检查媒体是否存在
            const existingMedia = await this.databaseService.media.findUnique({
                where: { id },
                include: {
                    tags: true
                }
            });

            if (!existingMedia) {
                throw new NotFoundException('媒体不存在');
            }

            // 验证分类是否存在（如果提供了）
            if (updateMediaDto.category_id) {
                const category = await this.databaseService.category.findUnique({
                    where: { id: updateMediaDto.category_id }
                });

                if (!category) {
                    throw new BadRequestException('指定的分类不存在');
                }
            }

            // 验证标签是否存在（如果提供了）
            if (updateMediaDto.tag_ids && updateMediaDto.tag_ids.length > 0) {
                const tags = await this.databaseService.tag.findMany({
                    where: { id: { in: updateMediaDto.tag_ids } }
                });

                if (tags.length !== updateMediaDto.tag_ids.length) {
                    throw new BadRequestException('部分标签不存在');
                }
            }

            // 构建更新数据
            const updateData: any = {
                updated_at: new Date()
            };

            if (updateMediaDto.title !== undefined) {
                updateData.title = updateMediaDto.title;
            }
            if (updateMediaDto.description !== undefined) {
                updateData.description = updateMediaDto.description;
            }

            // 处理分类关联 - 使用Prisma关系语法
            if (updateMediaDto.category_id !== undefined) {
                if (updateMediaDto.category_id) {
                    // 连接到新分类
                    updateData.category = {
                        connect: { id: updateMediaDto.category_id }
                    };
                } else {
                    // 断开分类关联
                    updateData.category = {
                        disconnect: true
                    };
                }
            }

            if (updateMediaDto.media_type !== undefined) {
                updateData.media_type = updateMediaDto.media_type;
            }
            if (updateMediaDto.status !== undefined) {
                updateData.status = updateMediaDto.status;
            }

            // 使用事务更新媒体信息和标签
            const result = await this.databaseService.$transaction(async (prisma) => {
                // 更新基本信息
                const updatedMedia = await prisma.media.update({
                    where: { id },
                    data: updateData
                });

                // 更新标签关联（如果提供了标签）
                if (updateMediaDto.tag_ids !== undefined) {
                    // 删除现有标签关联
                    await prisma.mediaTag.deleteMany({
                        where: { media_id: id }
                    });

                    // 创建新的标签关联
                    if (updateMediaDto.tag_ids.length > 0) {
                        await prisma.mediaTag.createMany({
                            data: updateMediaDto.tag_ids.map(tagId => ({
                                media_id: id,
                                tag_id: tagId
                            }))
                        });
                    }
                }

                return updatedMedia;
            });

            this.logger.log(`管理员 ${userId} 更新了媒体 ${id} 的信息`, MediaService.name);

            // 获取完整的媒体信息返回
            return await this.databaseService.media.findUnique({
                where: { id },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            avatar_url: true
                        }
                    },
                    category: true,
                    tags: {
                        include: {
                            tag: true
                        }
                    }
                }
            });

        } catch (error) {
            this.logger.error(`更新媒体信息失败: ${error.message}`, error.stack);

            if (error instanceof NotFoundException ||
                error instanceof ForbiddenException ||
                error instanceof BadRequestException) {
                throw error;
            }

            throw new UnprocessableEntityException(`更新媒体信息失败: ${error.message}`);
        }
    }

    /**
     * 获取用户上传记录统计
     * @param userId 用户ID
     * @returns 上传统计信息
     */
    async getUserUploadStats(userId: number) {
        try {
            const stats = await this.databaseService.media.groupBy({
                by: ['status'],
                where: { user_id: userId },
                _count: {
                    status: true
                },
                _sum: {
                    views: true,
                    likes_count: true
                }
            });

            const total = await this.databaseService.media.count({
                where: { user_id: userId }
            });

            const result = {
                total,
                pending: 0,
                approved: 0,
                rejected: 0,
                private: 0,
                total_views: 0,
                total_likes: 0,
                approval_rate: 0
            };

            stats.forEach(stat => {
                result[stat.status.toLowerCase()] = stat._count.status;
                result.total_views += stat._sum.views || 0;
                result.total_likes += stat._sum.likes_count || 0;
            });

            // 计算通过率
            if (total > 0) {
                result.approval_rate = Math.round((result.approved / total) * 100);
            }

            return result;
        } catch (error) {
            this.logger.error(`获取用户上传统计失败: ${error.message}`, error.stack);
            throw new UnprocessableEntityException(`获取上传统计失败: ${error.message}`);
        }
    }

    /**
     * 获取用户上传记录列表
     * @param userId 用户ID
     * @param filters 筛选条件
     * @returns 用户上传记录列表
     */
    async getUserUploadRecords(userId: number, filters: {
        status?: string;
        media_type?: string;
        search?: string;
        category_id?: string;
        sortBy?: string;
        sortOrder?: string;
        page?: number;
        limit?: number;
    }) {
        try {
            const {
                status,
                media_type,
                search,
                category_id,
                sortBy = 'created_at',
                sortOrder = 'desc',
                page = 0,
                limit = 20
            } = filters;

            // 构建查询条件
            const where: Prisma.MediaWhereInput = {
                user_id: userId
            };

            if (status) {
                where.status = status as MediaStatus;
            }

            if (media_type) {
                where.media_type = media_type as MediaType;
            }

            if (search) {
                // 使用更灵活的搜索方式，支持特殊字符（包括下划线）
                const searchTerm = search.trim();
                if (searchTerm) {
                    // 对于所有搜索都使用 startsWith 和 contains 的组合
                    // 这样可以更好地处理特殊字符
                    where.OR = [
                        {
                            title: {
                                contains: searchTerm,
                                mode: 'insensitive'
                            }
                        },
                        {
                            description: {
                                contains: searchTerm,
                                mode: 'insensitive'
                            }
                        },
                        // 添加精确匹配的搜索条件，对特殊字符更友好
                        {
                            title: {
                                startsWith: searchTerm,
                                mode: 'insensitive'
                            }
                        },
                        {
                            description: {
                                startsWith: searchTerm,
                                mode: 'insensitive'
                            }
                        }
                    ];
                }
            }

            if (category_id) {
                where.category_id = category_id;
            }

            // 构建排序条件
            const orderBy: Prisma.MediaOrderByWithRelationInput = {};
            orderBy[sortBy] = sortOrder as 'asc' | 'desc';

            // 获取记录和总数
            const [records, total] = await Promise.all([
                this.databaseService.media.findMany({
                    where,
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                nickname: true
                            }
                        },
                        category: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        tags: {
                            include: {
                                tag: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy,
                    skip: page * limit,
                    take: limit
                }),
                this.databaseService.media.count({ where })
            ]);

            // 获取统计信息
            const stats = await this.getUserUploadStats(userId);

            // 转换数据格式
            const formattedRecords = records.map(record => ({
                id: record.id,
                title: record.title,
                description: record.description,
                url: record.url,
                thumbnail_url: record.thumbnail_url,
                size: record.size,
                media_type: record.media_type,
                duration: record.duration,
                width: record.width,
                height: record.height,
                status: record.status,
                review_comment: (record as any).review_comment,
                reviewed_by: (record as any).reviewed_by,
                reviewed_at: (record as any).reviewed_at,
                reviewer: (record as any).reviewer,
                views: record.views,
                likes_count: record.likes_count,
                category: (record as any).category,
                tags: (record as any).tags?.map((mt: any) => mt.tag) || [],
                created_at: record.created_at,
                updated_at: record.updated_at
            }));

            return {
                records: formattedRecords,
                total,
                page,
                limit,
                hasMore: (page + 1) * limit < total,
                stats
            };
        } catch (error) {
            this.logger.error(`获取用户上传记录失败: ${error.message}`, error.stack);
            throw new UnprocessableEntityException(`获取上传记录失败: ${error.message}`);
        }
    }

    /**
     * 用户删除自己的媒体记录
     * @param userId 用户ID
     * @param mediaId 媒体ID
     */
    async deleteUserMedia(userId: number, mediaId: string) {
        try {
            // 检查媒体是否存在且属于该用户
            const media = await this.databaseService.media.findFirst({
                where: {
                    id: mediaId,
                    user_id: userId
                }
            });

            if (!media) {
                throw new NotFoundException('媒体不存在或无权删除');
            }

            // 检查媒体状态（已通过的内容可能需要管理员权限删除）
            if (media.status === 'APPROVED') {
                throw new ForbiddenException('已通过审核的内容不能删除，请联系管理员');
            }

            // 在事务中删除媒体及相关数据
            await this.databaseService.$transaction(async (prisma) => {
                // 删除标签关联
                await prisma.mediaTag.deleteMany({
                    where: { media_id: mediaId }
                });

                // 删除评论
                await prisma.comment.deleteMany({
                    where: { media_id: mediaId }
                });

                // 删除收藏
                await prisma.favorite.deleteMany({
                    where: { media_id: mediaId }
                });

                // 删除媒体记录
                await prisma.media.delete({
                    where: { id: mediaId }
                });
            });

            this.logger.log(`用户 ${userId} 删除了媒体 ${mediaId}`, MediaService.name);
        } catch (error) {
            this.logger.error(`删除用户媒体失败: ${error.message}`, error.stack);

            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }

            throw new UnprocessableEntityException(`删除媒体失败: ${error.message}`);
        }
    }

    /**
     * 用户重新提交被拒绝的媒体
     * @param userId 用户ID
     * @param mediaId 媒体ID
     * @param updateData 更新数据
     */
    async resubmitRejectedMedia(userId: number, mediaId: string, updateData: {
        title?: string;
        description?: string;
        category_id?: string;
        tag_ids?: string[];
    }) {
        try {
            // 检查媒体是否存在且属于该用户
            const media = await this.databaseService.media.findFirst({
                where: {
                    id: mediaId,
                    user_id: userId
                }
            });

            if (!media) {
                throw new NotFoundException('媒体不存在或无权操作');
            }

            // 只允许重新提交被拒绝的内容
            if (media.status !== 'REJECTED') {
                throw new ForbiddenException('只能重新提交被拒绝的内容');
            }

            // 在事务中更新媒体信息并重置审核状态
            const updatedMedia = await this.databaseService.$transaction(async (prisma) => {
                // 准备更新数据
                const updateFields: any = {
                    status: 'PENDING',  // 重置为待审核
                    review_comment: null as any,  // 清除审核备注
                    reviewed_at: null as any,     // 清除审核时间
                    updated_at: new Date()
                };

                // 清除审核员关联 - 使用Prisma关系语法
                updateFields.reviewer = {
                    disconnect: true
                };

                // 添加其他字段
                if (updateData.title !== undefined) {
                    updateFields.title = updateData.title;
                }
                if (updateData.description !== undefined) {
                    updateFields.description = updateData.description;
                }

                // 处理分类关联 - 使用Prisma关系语法
                if (updateData.category_id !== undefined) {
                    if (updateData.category_id) {
                        // 连接到新分类
                        updateFields.category = {
                            connect: { id: updateData.category_id }
                        };
                    } else {
                        // 断开分类关联
                        updateFields.category = {
                            disconnect: true
                        };
                    }
                }

                // 更新媒体信息和状态
                const updated = await prisma.media.update({
                    where: { id: mediaId },
                    data: updateFields
                });

                // 更新标签关联（如果提供了标签）
                if (updateData.tag_ids !== undefined) {
                    // 删除现有标签关联
                    await prisma.mediaTag.deleteMany({
                        where: { media_id: mediaId }
                    });

                    // 创建新的标签关联
                    if (updateData.tag_ids.length > 0) {
                        await prisma.mediaTag.createMany({
                            data: updateData.tag_ids.map(tagId => ({
                                media_id: mediaId,
                                tag_id: tagId
                            }))
                        });
                    }
                }

                return updated;
            });

            this.logger.log(`用户 ${userId} 重新提交了媒体 ${mediaId}`, MediaService.name);
            return updatedMedia;
        } catch (error) {
            this.logger.error(`重新提交媒体失败: ${error.message}`, error.stack);

            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }

            throw new UnprocessableEntityException(`重新提交失败: ${error.message}`);
        }
    }
}