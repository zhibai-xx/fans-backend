import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../auth/guards/admin-role.guard';
import { MediaService } from '../media.service';
import { CreateTagDto, CreateCategoryDto, UpdateTagDto, UpdateCategoryDto } from '../dto/create-tag.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminTagCategoryController {
  constructor(private readonly mediaService: MediaService) { }

  // =====================================
  // 标签管理 API
  // =====================================

  /**
   * 获取所有标签（包含使用统计）
   */
  @Get('tags')
  async getAllTags(@Query('search') search?: string) {
    try {
      const tags = await this.mediaService.getAllTagsWithStats(search);
      return {
        success: true,
        data: tags,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 创建新标签
   */
  @Post('tags')
  @HttpCode(HttpStatus.CREATED)
  async createTag(@Body() createTagDto: CreateTagDto) {
    try {
      const tag = await this.mediaService.createTag(createTagDto);
      return {
        success: true,
        data: tag,
        message: '标签创建成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '创建标签失败',
      };
    }
  }

  /**
   * 更新标签
   */
  @Put('tags/:id')
  async updateTag(@Param('id') id: string, @Body() updateTagDto: UpdateTagDto) {
    try {
      if (!updateTagDto.name) {
        throw new BadRequestException('标签名称不能为空');
      }
      const tag = await this.mediaService.updateTag(id, { name: updateTagDto.name });
      return {
        success: true,
        data: tag,
        message: '标签更新成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '更新标签失败',
      };
    }
  }

  /**
   * 删除标签
   */
  @Delete('tags/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTag(@Param('id') id: string) {
    try {
      await this.mediaService.deleteTag(id);
      return {
        success: true,
        message: '标签删除成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '删除标签失败',
      };
    }
  }

  /**
   * 批量删除标签
   */
  @Delete('tags/batch')
  @HttpCode(HttpStatus.NO_CONTENT)
  async batchDeleteTags(@Body('ids') ids: string[]) {
    try {
      await this.mediaService.batchDeleteTags(ids);
      return {
        success: true,
        message: `成功删除 ${ids.length} 个标签`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '批量删除标签失败',
      };
    }
  }

  // =====================================
  // 分类管理 API
  // =====================================

  /**
   * 获取所有分类（包含使用统计）
   */
  @Get('categories')
  async getAllCategories(@Query('search') search?: string) {
    try {
      const categories = await this.mediaService.getAllCategoriesWithStats(search);
      return {
        success: true,
        data: categories,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 创建新分类
   */
  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    try {
      const category = await this.mediaService.createCategory(createCategoryDto);
      return {
        success: true,
        data: category,
        message: '分类创建成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '创建分类失败',
      };
    }
  }

  /**
   * 更新分类
   */
  @Put('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    try {
      const category = await this.mediaService.updateCategory(id, updateCategoryDto);
      return {
        success: true,
        data: category,
        message: '分类更新成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '更新分类失败',
      };
    }
  }

  /**
   * 删除分类
   */
  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('id') id: string) {
    try {
      await this.mediaService.deleteCategory(id);
      return {
        success: true,
        message: '分类删除成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '删除分类失败',
      };
    }
  }

  /**
   * 批量删除分类
   */
  @Delete('categories/batch')
  @HttpCode(HttpStatus.NO_CONTENT)
  async batchDeleteCategories(@Body('ids') ids: string[]) {
    try {
      await this.mediaService.batchDeleteCategories(ids);
      return {
        success: true,
        message: `成功删除 ${ids.length} 个分类`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '批量删除分类失败',
      };
    }
  }

  // =====================================
  // 统计信息 API
  // =====================================

  /**
   * 获取标签和分类的统计信息
   */
  @Get('tags-categories/stats')
  async getTagsCategoriesStats() {
    try {
      const stats = await this.mediaService.getTagsCategoriesStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}