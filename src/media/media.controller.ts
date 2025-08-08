import { MediaService } from './media.service';
import {
    Body, Controller, Delete, Get, Param,
    Patch, Post, Query, ParseIntPipe,
    HttpStatus, Req, HttpCode, UseGuards,
    UseInterceptors, ClassSerializerInterceptor, Res, NotFoundException, Request
} from '@nestjs/common';
import { MediaType, MediaStatus } from '@prisma/client';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { MyLoggerService } from 'src/my-logger/my-logger.service';
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
import { MediaResponseDto, MediaListResponseDto } from './dto/media-response.dto';
import { Request as ExpressRequest } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/auth/guards/admin-role.guard';
import { UserUuidService } from 'src/auth/services/user-uuid.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserUploadFiltersDto } from './dto/user-upload-record.dto';

// 扩展 Request 类型，定义需要的 user 属性
// 注意：这个接口只用于类型定义，不会影响运行时的行为
type RequestWithUser = ExpressRequest & { user: { id: number, [key: string]: any } };

@ApiTags('媒体')
@Controller('media')
@UseInterceptors(ClassSerializerInterceptor)
export class MediaController {
    constructor(
        private readonly mediaService: MediaService,
        private readonly configService: ConfigService,
        private readonly userUuidService: UserUuidService
    ) { }
    private readonly logger = new MyLoggerService(MediaController.name);



    /**
     * 获取媒体列表，支持分页和筛选
     * @param userUuid 用户UUID筛选
     * @param type 媒体类型筛选
     * @param status 状态筛选
     * @param skip 跳过条数
     * @param take 获取条数
     * @returns 分页媒体列表
     */
    @Get()
    @SkipThrottle({ default: false }) // 应用限流
    @ApiOperation({ summary: '获取媒体列表' })
    @ApiResponse({ status: 200, description: '获取成功', type: MediaListResponseDto })
    async findAll(
        @Query('userUuid') userUuid?: string,
        @Query('type') type?: MediaType,
        @Query('status') status?: MediaStatus,
        @Query('categoryId') categoryId?: string,
        @Query('tagId') tagId?: string,
        @Query('search') search?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: string,
        @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
        @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    ) {
        this.logger.log(`获取媒体列表: userUuid=${userUuid}, type=${type}, status=${status}, categoryId=${categoryId}, tagId=${tagId}, search=${search}, sortBy=${sortBy}, sortOrder=${sortOrder}, skip=${skip}, take=${take}`, MediaController.name);

        // 如果提供了userUuid，转换为内部ID
        let userId: number | undefined;
        if (userUuid) {
            userId = await this.userUuidService.getInternalIdByUuid(userUuid);
        }

        const result = await this.mediaService.findAll({
            userId,
            mediaType: type,
            status,
            categoryId,
            tagId,
            search,
            sortBy: sortBy || 'created_at',
            sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
            skip,
            take
        });

        // 获取所有用户的UUID映射
        const userIds = result.data.map(media => media.user_id);
        const userUuidMapping = await this.userUuidService.getUuidMappingByIds(userIds);

        // 转换响应数据
        const mediaList = result.data.map(media =>
            new MediaResponseDto(media, userUuidMapping[media.user_id])
        );

        return new MediaListResponseDto(mediaList, result.meta);
    }

    // =====================================
    // 标签相关接口
    // =====================================

    /**
     * 获取所有标签
     * @returns 标签列表
     */
    @Get('tags')
    @ApiOperation({ summary: '获取所有标签' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getAllTags() {
        this.logger.log('获取所有标签', MediaController.name);
        const tags = await this.mediaService.getAllTags();
        return { tags };
    }

    /**
     * 创建新标签
     * @param createTagDto 标签创建数据
     * @returns 创建的标签
     */
    @Post('tags')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '创建新标签' })
    @ApiResponse({ status: 201, description: '创建成功' })
    @ApiResponse({ status: 400, description: '标签已存在' })
    @ApiResponse({ status: 401, description: '未授权' })
    async createTag(@Body() createTagDto: CreateTagDto) {
        this.logger.log(`创建标签: ${createTagDto.name}`, MediaController.name);
        const tag = await this.mediaService.createTag(createTagDto);
        return { tag };
    }

    /**
     * 搜索标签
     * @param query 搜索关键词
     * @returns 匹配的标签列表
     */
    @Get('tags/search/:query')
    @ApiOperation({ summary: '搜索标签' })
    @ApiResponse({ status: 200, description: '搜索成功' })
    async searchTags(@Param('query') query: string) {
        this.logger.log(`搜索标签: ${query}`, MediaController.name);
        return this.mediaService.searchTags(query);
    }

    /**
     * 根据ID获取标签详情
     * @param id 标签ID
     * @returns 标签详情
     */
    @Get('tags/:id')
    @ApiOperation({ summary: '获取标签详情' })
    @ApiResponse({ status: 200, description: '获取成功' })
    @ApiResponse({ status: 404, description: '标签不存在' })
    async getTagById(@Param('id') id: string) {
        this.logger.log(`获取标签详情: ${id}`, MediaController.name);
        return this.mediaService.getTagById(id);
    }

    /**
     * 删除标签
     * @param id 标签ID
     * @returns 删除结果
     */
    @Delete('tags/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '删除标签' })
    @ApiResponse({ status: 204, description: '删除成功' })
    @ApiResponse({ status: 401, description: '未授权' })
    @ApiResponse({ status: 404, description: '标签不存在' })
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteTag(@Param('id') id: string) {
        this.logger.log(`删除标签: ${id}`, MediaController.name);
        return this.mediaService.deleteTag(id);
    }

    // =====================================
    // 分类相关接口
    // =====================================

    /**
     * 获取所有分类
     * @returns 分类列表
     */
    @Get('categories')
    @ApiOperation({ summary: '获取所有分类' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async getAllCategories() {
        this.logger.log('获取所有分类', MediaController.name);
        const categories = await this.mediaService.getAllCategories();
        return { categories };
    }

    /**
     * 创建新分类
     * @param createCategoryDto 分类创建数据
     * @returns 创建的分类
     */
    @Post('categories')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '创建新分类' })
    @ApiResponse({ status: 201, description: '创建成功' })
    @ApiResponse({ status: 400, description: '分类已存在' })
    @ApiResponse({ status: 401, description: '未授权' })
    async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
        this.logger.log(`创建分类: ${createCategoryDto.name}`, MediaController.name);
        return this.mediaService.createCategory(createCategoryDto);
    }

    /**
     * 根据ID获取分类详情
     * @param id 分类ID
     * @returns 分类详情
     */
    @Get('categories/:id')
    @ApiOperation({ summary: '获取分类详情' })
    @ApiResponse({ status: 200, description: '获取成功' })
    @ApiResponse({ status: 404, description: '分类不存在' })
    async getCategoryById(@Param('id') id: string) {
        this.logger.log(`获取分类详情: ${id}`, MediaController.name);
        return this.mediaService.getCategoryById(id);
    }

    /**
     * 更新分类信息
     * @param id 分类ID
     * @param updateData 更新数据
     * @returns 更新后的分类
     */
    @Patch('categories/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '更新分类信息' })
    @ApiResponse({ status: 200, description: '更新成功' })
    @ApiResponse({ status: 401, description: '未授权' })
    @ApiResponse({ status: 404, description: '分类不存在' })
    async updateCategory(
        @Param('id') id: string,
        @Body() updateData: Partial<CreateCategoryDto>
    ) {
        this.logger.log(`更新分类: ${id}`, MediaController.name);
        return this.mediaService.updateCategory(id, updateData);
    }

    /**
     * 删除分类
     * @param id 分类ID
     * @returns 删除结果
     */
    @Delete('categories/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '删除分类' })
    @ApiResponse({ status: 204, description: '删除成功' })
    @ApiResponse({ status: 400, description: '分类正在使用中' })
    @ApiResponse({ status: 401, description: '未授权' })
    @ApiResponse({ status: 404, description: '分类不存在' })
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteCategory(@Param('id') id: string) {
        this.logger.log(`删除分类: ${id}`, MediaController.name);
        return this.mediaService.deleteCategory(id);
    }

    /**
     * 提供静态文件访问（本地存储模式使用）
     * @param filename 文件名
     * @param res 响应对象
     */
    @Get('file/:path')
    @ApiOperation({ summary: '获取媒体文件' })
    @ApiResponse({ status: 200, description: '获取成功' })
    serveMediaFile(@Param('path') path: string, @Req() req: Request) {
        // 这里通常需要通过一个特殊的中间件或服务来处理文件的提供
        // 在完整实现中，这里会返回文件内容或重定向到静态文件服务
        return { file: path };
    }

    /**
     * 获取媒体详情
     * @param id 媒体ID
     * @returns 媒体详情
     */
    @Get(':id')
    @ApiOperation({ summary: '获取媒体详情' })
    @ApiResponse({ status: 200, description: '获取成功', type: MediaResponseDto })
    @ApiResponse({ status: 404, description: '媒体不存在' })
    async findOne(@Param('id') id: string) {
        this.logger.log(`获取媒体详情: ${id}`, MediaController.name);
        const media = await this.mediaService.findOne(id);

        // 获取用户UUID
        const userUuid = await this.userUuidService.getUuidByInternalId(media.user_id);

        return new MediaResponseDto(media, userUuid);
    }

    /**
     * 删除媒体
     * @param id 媒体ID
     * @param req 请求对象（获取用户ID）
     * @returns 删除结果
     */
    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '删除媒体' })
    @ApiResponse({ status: 204, description: '删除成功' })
    @ApiResponse({ status: 401, description: '未授权' })
    @ApiResponse({ status: 403, description: '没有权限' })
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteMedia(
        @Param('id') id: string,
        @Req() req: RequestWithUser
    ) {
        const userId = req.user.id;
        this.logger.log(`用户 ${userId} 删除媒体: ${id}`, MediaController.name);
        return this.mediaService.deleteMedia(id, userId);
    }

    /**
     * 更新媒体状态（管理员专用）
     * @param id 媒体ID
     * @param status 新状态
     * @param req 请求对象（获取管理员ID）
     * @returns 更新结果
     */
    @Patch(':id/status')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '更新媒体状态（管理员专用）' })
    @ApiResponse({ status: 200, description: '更新成功' })
    @ApiResponse({ status: 401, description: '未授权' })
    @ApiResponse({ status: 403, description: '没有权限' })
    async updateStatus(
        @Param('id') id: string,
        @Body('status') status: MediaStatus,
        @Req() req: RequestWithUser
    ) {
        const adminId = req.user.id;
        this.logger.log(`管理员 ${adminId} 更新媒体状态: ${id} -> ${status}`, MediaController.name);
        return this.mediaService.updateStatus(id, status, adminId);
    }

    // =====================================
    // 审核相关接口
    // =====================================

    /**
     * 获取审核统计信息（管理员专用）
     * @returns 审核统计数据
     */
    @Get('review/stats')
    @UseGuards(JwtAuthGuard, AdminRoleGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '获取审核统计信息（管理员专用）' })
    @ApiResponse({ status: 200, description: '获取成功', type: ReviewStatsDto })
    @ApiResponse({ status: 401, description: '未授权' })
    @ApiResponse({ status: 403, description: '需要管理员权限' })
    async getReviewStats(@Req() req: any): Promise<ReviewStatsDto> {
        this.logger.log('获取审核统计信息', MediaController.name);
        const stats = await this.mediaService.getReviewStats();
        return stats;
    }

    /**
     * 获取待审核媒体列表（管理员专用）
     * @param filters 筛选条件
     * @returns 待审核媒体列表
     */
    @Get('review/list')
    @UseGuards(JwtAuthGuard, AdminRoleGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '获取待审核媒体列表（管理员专用）' })
    @ApiResponse({ status: 200, description: '获取成功', type: MediaListResponseDto })
    @ApiResponse({ status: 401, description: '未授权' })
    @ApiResponse({ status: 403, description: '需要管理员权限' })
    async getMediaForReview(@Query() filters: ReviewFilterDto): Promise<MediaListResponseDto> {
        this.logger.log(`获取待审核媒体列表: ${JSON.stringify(filters)}`, MediaController.name);

        const result = await this.mediaService.getMediaForReview(filters, this.userUuidService);

        // 获取所有用户的UUID映射
        const userIds = result.data.map(media => media.user_id);
        const userUuidMapping = await this.userUuidService.getUuidMappingByIds(userIds);

        // 转换响应数据
        const mediaList = result.data.map(media =>
            new MediaResponseDto(media, userUuidMapping[media.user_id])
        );

        return new MediaListResponseDto(mediaList, result.meta);
    }

    /**
     * 批量更新媒体状态（管理员专用）
     * @param dto 批量更新数据
     * @param req 请求对象（获取管理员ID）
     * @returns 批量操作结果
     */
    @Post('review/batch-status')
    @UseGuards(JwtAuthGuard, AdminRoleGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '批量更新媒体状态（管理员专用）' })
    @ApiResponse({ status: 200, description: '批量更新成功', type: BatchOperationResultDto })
    @ApiResponse({ status: 401, description: '未授权' })
    @ApiResponse({ status: 403, description: '需要管理员权限' })
    async batchUpdateStatus(
        @Body() dto: BatchUpdateStatusDto,
        @Req() req: RequestWithUser
    ): Promise<BatchOperationResultDto> {
        const adminId = req.user.id;
        this.logger.log(`管理员 ${adminId} 批量更新媒体状态: ${dto.mediaIds.length} 个媒体 -> ${dto.status}`, MediaController.name);
        return this.mediaService.batchUpdateStatus(dto, adminId);
    }

    /**
     * 批量更新媒体标签（管理员专用）
     * @param dto 批量标签更新数据
     * @param req 请求对象（获取管理员ID）
     * @returns 批量操作结果
     */
    @Post('review/batch-tags')
    @UseGuards(JwtAuthGuard, AdminRoleGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '批量更新媒体标签（管理员专用）' })
    @ApiResponse({ status: 200, description: '批量更新成功', type: BatchOperationResultDto })
    @ApiResponse({ status: 401, description: '未授权' })
    @ApiResponse({ status: 403, description: '需要管理员权限' })
    async batchUpdateTags(
        @Body() dto: BatchUpdateTagsDto,
        @Req() req: RequestWithUser
    ): Promise<BatchOperationResultDto> {
        const adminId = req.user.id;
        this.logger.log(`管理员 ${adminId} 批量更新媒体标签: ${dto.mediaIds.length} 个媒体`, MediaController.name);
        return this.mediaService.batchUpdateTags(dto, adminId);
    }

    /**
     * 批量更新媒体分类（管理员专用）
     * @param dto 批量分类更新数据
     * @param req 请求对象（获取管理员ID）
     * @returns 批量操作结果
     */
    @Post('review/batch-category')
    @UseGuards(JwtAuthGuard, AdminRoleGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '批量更新媒体分类（管理员专用）' })
    @ApiResponse({ status: 200, description: '批量更新成功', type: BatchOperationResultDto })
    @ApiResponse({ status: 401, description: '未授权' })
    @ApiResponse({ status: 403, description: '需要管理员权限' })
    async batchUpdateCategory(
        @Body() dto: BatchUpdateCategoryDto,
        @Req() req: RequestWithUser
    ): Promise<BatchOperationResultDto> {
        const adminId = req.user.id;
        this.logger.log(`管理员 ${adminId} 批量更新媒体分类: ${dto.mediaIds.length} 个媒体 -> ${dto.categoryId || '无分类'}`, MediaController.name);
        return this.mediaService.batchUpdateCategory(dto, adminId);
    }

    // =====================================
    // 媒体信息管理接口（管理员专用）
    // =====================================

    /**
     * 更新媒体信息（管理员专用）
     * @param id 媒体ID
     * @param updateMediaDto 更新数据
     * @param req 请求对象（获取管理员ID）
     * @returns 更新后的媒体信息
     */
    @Patch(':id/info')
    @UseGuards(JwtAuthGuard, AdminRoleGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '更新媒体信息（管理员专用）' })
    @ApiResponse({ status: 200, description: '更新成功', type: MediaResponseDto })
    @ApiResponse({ status: 401, description: '未授权' })
    @ApiResponse({ status: 403, description: '需要管理员权限' })
    @ApiResponse({ status: 404, description: '媒体不存在' })
    async updateMediaInfo(
        @Param('id') id: string,
        @Body() updateMediaDto: UpdateMediaDto,
        @Req() req: RequestWithUser
    ): Promise<MediaResponseDto> {
        const adminId = req.user.id;
        this.logger.log(`管理员 ${adminId} 更新媒体信息: ${id}`, MediaController.name);

        const result = await this.mediaService.updateMediaInfo(id, updateMediaDto, adminId);

        if (!result) {
            throw new NotFoundException('媒体不存在');
        }

        // 获取用户UUID
        const userUuid = await this.userUuidService.getUuidByInternalId(result.user_id);

        return new MediaResponseDto(result, userUuid);
    }

}
