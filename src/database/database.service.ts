import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit {
    // 当模块初始化时自动连接数据库
    async onModuleInit() {
        // 连接到Prisma客户端，建立数据库连接
        await this.$connect()
    }
}
