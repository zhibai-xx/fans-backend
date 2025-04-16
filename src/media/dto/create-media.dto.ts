import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { MediaType } from '@prisma/client';

export class CreateMediaDto {
    /**
     * 媒体标题
     * @example "我的演唱会照片"
     */
    @IsString()
    title: string;

    /**
     * 媒体描述（可选）
     * @example "2023年北京演唱会拍摄的照片"
     */
    @IsString()
    @IsOptional()
    description?: string;
    
    /**
     * 分类ID（可选）
     */
    @IsUUID()
    @IsOptional()
    category_id?: string;
    
    /**
     * 媒体类型（图片/视频）
     * @example "IMAGE"
     */
    @IsEnum(MediaType)
    @IsOptional()
    media_type?: MediaType;
    
    /**
     * 标签IDs数组（可选）
     */
    @IsUUID(4, { each: true })
    @IsOptional()
    tags?: string[];
}