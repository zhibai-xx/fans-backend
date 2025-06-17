// src/media/media.service.ts
import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { MediaType, MediaStatus, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/database/database.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
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
                    media: {
                        select: {
                            id: true,
                            title: true,
                            thumbnail_url: true,
                            media_type: true,
                            created_at: true
                        },
                        orderBy: { created_at: 'desc' },
                        take: 20 // 限制返回的媒体数量
                    }
                }
            });

            if (!category) {
                throw new NotFoundException('分类不存在');
            }

            return category;
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
}