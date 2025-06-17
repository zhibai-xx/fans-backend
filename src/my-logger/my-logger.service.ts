import { Injectable, ConsoleLogger } from '@nestjs/common';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';

@Injectable()
export class MyLoggerService extends ConsoleLogger {
    /**
     * 将日志条目写入文件
     * @param entry 日志条目内容
     */
    async logToFile(entry) {
        // 格式化日志条目，添加时间戳（使用中国时区）
        const formattedEntry = `${Intl.DateTimeFormat('zh-CN', {
            dateStyle: 'short',
            timeStyle: 'medium',
            timeZone: 'Asia/Shanghai'
        }).format(new Date())}\t${entry}\n`

        try {
            // 确保日志目录存在，如果不存在则创建
            if (!fs.existsSync(path.join(__dirname, '..', '..', 'logs'))) {
                await fsPromises.mkdir(path.join(__dirname, '..', '..', 'logs'))
            }
            // 追加写入日志文件
            await fsPromises.appendFile(path.join(__dirname, '..', '..', 'logs', 'myLogFile.log'), formattedEntry)
        } catch (e) {
            // 处理写入错误
            if (e instanceof Error) console.error(e.message)
        }
    }

    /**
     * 覆盖ConsoleLogger的log方法，添加文件日志功能
     * @param message 日志消息
     * @param context 日志上下文
     */
    log(message: any, context?: string) {
        const entry = `${context}\t${message}`
        this.logToFile(entry)
        super.log(message, context)
    }

    /**
     * 覆盖ConsoleLogger的error方法，添加文件日志功能
     * @param message 错误消息
     * @param stackOrContext 错误堆栈或上下文
     */
    error(message: any, stackOrContext?: string) {
        const entry = `${stackOrContext}\t${message}`
        this.logToFile(entry)
        super.error(message, stackOrContext)
    }
}
