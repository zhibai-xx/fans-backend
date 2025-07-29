import { IsString, IsOptional, IsUUID, IsEnum, ValidateIf } from 'class-validator';
import { MediaType } from '@prisma/client';
import { Transform } from 'class-transformer';

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
     * 分类ID（可选） - 自动转换空字符串为undefined
     */
    @Transform(({ value }) => {
        if (value === '' || value === null) {
            return undefined;
        }
        return value;
    })
    @ValidateIf((o) => o.category_id !== undefined)
    @IsUUID()
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