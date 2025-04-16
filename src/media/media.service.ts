// src/media/media.service.ts
import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { MediaType, MediaStatus, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/database/database.service';
import { StorageFactoryService } from './services/storage-factory.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { MyLoggerService } from 'src/my-logger/my-logger.service';
import { FileUtils } from './utils/file.utils';

@Injectable()
export class MediaService {
    private readonly logger = new MyLoggerService(MediaService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private configService: ConfigService,
        private storageFactory: StorageFactoryService,
    ) { }

    /**
     * 上传媒体文件并在数据库中创建记录
     * @param file 上传的文件
     * @param userId 用户ID
     * @param createMediaDto 媒体信息
     * @returns 创建的媒体记录
     */
    async uploadMedia(file: Express.Multer.File, userId: number, createMediaDto: CreateMediaDto) {
        try {
            // 验证用户是否存在
            const user = await this.databaseService.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                throw new NotFoundException('用户不存在');
            }

            // 验证文件类型
            const allowedTypes = this.configService.get<string[]>('upload.local.allowedTypes', [
                'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'
            ]);
            
            if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
                throw new UnprocessableEntityException(
                    `不支持的文件类型: ${file.mimetype}。允许的类型: ${allowedTypes.join(', ')}`
                );
            }

            // 验证文件大小
            const maxSize = this.configService.get<number>('upload.local.maxSize', 104857600); // 默认100MB
            if (file.size > maxSize) {
                throw new UnprocessableEntityException(
                    `文件过大。最大允许大小: ${maxSize / 1024 / 1024}MB`
                );
            }

            // 确定媒体类型
            let mediaType = createMediaDto.media_type || MediaType.IMAGE;
            if (file.mimetype.startsWith('image/')) {
                mediaType = MediaType.IMAGE;
            } else if (file.mimetype.startsWith('video/')) {
                mediaType = MediaType.VIDEO;
            }

            // 获取当前存储服务
            const storageService = this.storageFactory.getStorage();

            // 上传文件
            const fileUrl = await storageService.uploadFile(file);
            
            // 生成缩略图（如果是图片）
            let thumbnailUrl = '';
            if (mediaType === MediaType.IMAGE && storageService.generateThumbnail) {
                thumbnailUrl = await storageService.generateThumbnail(file, fileUrl);
            }

            // 准备创建数据
            // 使用两步创建方式避免类型错误
            const baseMediaData = {
                title: createMediaDto.title,
                description: createMediaDto.description,
                url: fileUrl,
                thumbnail_url: thumbnailUrl || null,
                media_type: mediaType,
                status: MediaStatus.PENDING,
                size: file.size,
                user: {
                    connect: { id: userId }
                }
            };

            // 首先创建基本记录
            const media = await this.databaseService.media.create({
                data: baseMediaData as Prisma.MediaCreateInput,
                include: {
                    category: true,
                    tags: {
                        include: {
                            tag: true
                        }
                    }
                }
            });

            // 如果提供了分类ID，更新分类
            if (createMediaDto.category_id) {
                await this.databaseService.media.update({
                    where: { id: media.id },
                    data: {
                        category: {
                            connect: { id: createMediaDto.category_id }
                        }
                    }
                });
            }

            // 如果提供了标签，创建关联
            if (createMediaDto.tags && createMediaDto.tags.length > 0) {
                for (const tagId of createMediaDto.tags) {
                    await this.databaseService.mediaTag.create({
                        data: {
                            media: { connect: { id: media.id } },
                            tag: { connect: { id: tagId } }
                        }
                    });
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
            // 记录错误日志
            this.logger.error(`上传媒体失败: ${error.message}`, error.stack);
            
            // 如果错误是我们已知的类型，直接抛出
            if (error instanceof NotFoundException || 
                error instanceof UnprocessableEntityException ||
                error instanceof ForbiddenException ||
                error instanceof BadRequestException) {
                throw error;
            }
            
            // 其他错误转换为通用错误
            throw new UnprocessableEntityException(`上传媒体失败: ${error.message}`);
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

        // 获取存储服务
        const storageService = this.storageFactory.getStorage();

        try {
            // 删除实际文件
            await storageService.deleteFile(media.url);
            
            // 如果有缩略图，也删除
            if (media.thumbnail_url) {
                await storageService.deleteFile(media.thumbnail_url);
            }

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
}