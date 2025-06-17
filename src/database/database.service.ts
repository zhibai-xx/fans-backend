import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit {
    constructor() {
        super({
            // 确保数据库连接使用正确的时区
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
        });
    }

    // 当模块初始化时自动连接数据库
    async onModuleInit() {
        // 设置时区
        process.env.TZ = 'Asia/Shanghai';

        // 连接到Prisma客户端，建立数据库连接
        await this.$connect();

        // 设置数据库会话时区（针对PostgreSQL）
        try {
            await this.$executeRaw`SET timezone = 'Asia/Shanghai'`;
            console.log('数据库时区已设置为 Asia/Shanghai');
        } catch (error) {
            console.warn('设置数据库时区失败:', error.message);
        }
    }
}
