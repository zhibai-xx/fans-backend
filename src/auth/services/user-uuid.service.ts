import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UserUuidService {
  constructor(private readonly databaseService: DatabaseService) { }

  /**
   * 通过UUID获取用户内部ID
   * @param uuid 用户UUID
   * @returns 用户内部ID
   */
  async getInternalIdByUuid(uuid: string): Promise<number> {
    const user = await this.databaseService.user.findUnique({
      where: { uuid },
      select: { id: true }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user.id;
  }

  /**
   * 通过内部ID获取用户UUID
   * @param id 用户内部ID
   * @returns 用户UUID
   */
  async getUuidByInternalId(id: number): Promise<string> {
    const user = await this.databaseService.user.findUnique({
      where: { id },
      select: { uuid: true }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user.uuid;
  }

  /**
   * 批量获取UUID映射
   * @param ids 内部ID数组
   * @returns ID到UUID的映射
   */
  async getUuidMappingByIds(ids: number[]): Promise<Record<number, string>> {
    const users = await this.databaseService.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, uuid: true }
    });

    const mapping: Record<number, string> = {};
    users.forEach(user => {
      mapping[user.id] = user.uuid;
    });

    return mapping;
  }

  /**
   * 批量获取内部ID映射
   * @param uuids UUID数组
   * @returns UUID到内部ID的映射
   */
  async getInternalIdMappingByUuids(uuids: string[]): Promise<Record<string, number>> {
    const users = await this.databaseService.user.findMany({
      where: { uuid: { in: uuids } },
      select: { id: true, uuid: true }
    });

    const mapping: Record<string, number> = {};
    users.forEach(user => {
      mapping[user.uuid] = user.id;
    });

    return mapping;
  }
} 