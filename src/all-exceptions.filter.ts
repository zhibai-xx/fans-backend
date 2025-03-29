import { Catch, ArgumentsHost, HttpStatus, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { Request, Response } from "express";
import { MyLoggerService } from "./my-logger/my-logger.service";
import { PrismaClientValidationError } from "@prisma/client/runtime/library";

// 自定义响应对象类型定义
type MyResponseObj = {
    statusCode: number,  // HTTP状态码
    timestamp: string,   // 时间戳
    path: string,        // 请求路径
    response: string | object  // 响应内容
}

@Catch()  // 不指定异常类型，捕获所有异常
export class AllExceptionsFilter extends BaseExceptionFilter {
    // 使用自定义日志服务
    private readonly logger = new MyLoggerService(AllExceptionsFilter.name)

    catch(exception: unknown, host: ArgumentsHost): void {
        // 获取HTTP上下文
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // 初始化自定义响应对象
        const myResponseObj: MyResponseObj = {
            statusCode: 500,  // 默认状态码为500（服务器错误）
            timestamp: new Date().toISOString(),  // 当前时间的ISO字符串
            path: request.url,  // 请求URL
            response: '',  // 默认空响应
        }

        // 根据异常类型处理不同的错误情况
        if (exception instanceof HttpException) {
            // 处理HTTP异常
            myResponseObj.statusCode = exception.getStatus()
            myResponseObj.response = exception.getResponse()
        } else if (exception instanceof PrismaClientValidationError) {
            // 处理Prisma客户端验证错误
            myResponseObj.statusCode = 422  // 无法处理的实体
            myResponseObj.response = exception.message.replaceAll(/\n/g, '')
        } else {
            // 处理其他未知错误
            myResponseObj.statusCode = HttpStatus.INTERNAL_SERVER_ERROR
            myResponseObj.response = 'Internal Server Error'
        }

        // 返回响应并记录错误日志
        response.status(myResponseObj.statusCode).json(myResponseObj)
        this.logger.error(myResponseObj.response, AllExceptionsFilter.name)

        // 调用父类方法完成异常处理
        super.catch(exception, host)
    }
}