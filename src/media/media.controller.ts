import { MediaService } from './media.service';
import {
    Body, Controller, Delete, Get, Param,
    Patch, Post, Query, ParseIntPipe, ValidationPipe,
    UseInterceptors, UploadedFile, HttpStatus, ParseFilePipe, FileTypeValidator, MaxFileSizeValidator,
    Req, HttpCode, UseGuards
} from '@nestjs/common';
import { MediaType, MediaStatus } from '@prisma/client';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { MyLoggerService } from 'src/my-logger/my-logger.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateMediaDto } from './dto/create-media.dto';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

// 扩展 Request 类型，定义需要的 user 属性
// 注意：这个接口只用于类型定义，不会影响运行时的行为
type RequestWithUser = Request & { user: { id: number, [key: string]: any } };

@ApiTags('媒体')
@Controller('media')
export class MediaController {
    constructor(
        private readonly mediaService: MediaService,
        private readonly configService: ConfigService
    ) { }
    private readonly logger = new MyLoggerService(MediaController.name);

    /**
     * 上传媒体文件
     * @param file 文件数据
     * @param createMediaDto 媒体信息
     * @param req 请求对象（获取用户ID）
     * @returns 上传结果
     */
    @Post('upload')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '上传媒体文件' })
    @ApiResponse({ status: 201, description: '上传成功' })
    @ApiResponse({ status: 401, description: '未授权' })
    @UseInterceptors(FileInterceptor('file'))
    async uploadMedia(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new FileTypeValidator({ 
                        fileType: '.(jpg|jpeg|png|gif|mp4|webm|mov)' 
                    }),
                    new MaxFileSizeValidator({ 
                        maxSize: 100 * 1024 * 1024 // 100MB
                    }),
                ],
                errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY
            })
        ) file: Express.Multer.File,
        @Body(ValidationPipe) createMediaDto: CreateMediaDto,
        @Req() req: RequestWithUser
    ) {
        // 使用认证用户的ID，JwtAuthGuard 确保这里总是有有效的用户ID
        const userId = req.user.id;
        this.logger.log(`用户 ${userId} 上传媒体: ${file.originalname}`, MediaController.name);
        return this.mediaService.uploadMedia(file, userId, createMediaDto);
    }

    /**
     * 获取媒体列表，支持分页和筛选
     * @param userId 用户ID筛选
     * @param type 媒体类型筛选
     * @param status 状态筛选
     * @param skip 跳过条数
     * @param take 获取条数
     * @returns 分页媒体列表
     */
    @Get()
    @SkipThrottle({ default: false }) // 应用限流
    @ApiOperation({ summary: '获取媒体列表' })
    @ApiResponse({ status: 200, description: '获取成功' })
    async findAll(
        @Query('userId', new ParseIntPipe({ optional: true })) userId?: number,
        @Query('type') type?: MediaType,
        @Query('status') status?: MediaStatus,
        @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
        @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    ) {
        this.logger.log(`获取媒体列表: userId=${userId}, type=${type}, status=${status}`, MediaController.name);
        return this.mediaService.findAll({
            userId,
            mediaType: type,
            status,
            skip,
            take
        });
    }

    /**
     * 获取媒体详情
     * @param id 媒体ID
     * @returns 媒体详情
     */
    @Get(':id')
    @ApiOperation({ summary: '获取媒体详情' })
    @ApiResponse({ status: 200, description: '获取成功' })
    @ApiResponse({ status: 404, description: '媒体不存在' })
    async findOne(@Param('id') id: string) {
        this.logger.log(`获取媒体详情: ${id}`, MediaController.name);
        return this.mediaService.findOne(id);
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
}
