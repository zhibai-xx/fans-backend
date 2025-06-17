import { Catch, ArgumentsHost, HttpStatus, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { Request, Response } from "express";
import { MyLoggerService } from "./my-logger/my-logger.service";
import { PrismaClientValidationError } from "@prisma/client/runtime/library";

// 统一的错误响应格式
type MyResponseObj = {
    statusCode: number,  // HTTP状态码
    timestamp: string,   // 时间戳
    path: string,        // 请求路径
    message: string,     // 错误信息（统一为字符串）
    error: string        // 错误类型
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

        // 初始化统一响应对象
        const myResponseObj: MyResponseObj = {
            statusCode: 500,  // 默认状态码为500（服务器错误）
            timestamp: new Date().toISOString(),  // 当前时间的ISO字符串
            path: request.url,  // 请求URL
            message: 'Internal Server Error',  // 默认错误消息
            error: 'Internal Server Error'     // 默认错误类型
        }

        // 根据异常类型处理不同的错误情况
        if (exception instanceof HttpException) {
            // 处理HTTP异常
            myResponseObj.statusCode = exception.getStatus()

            // 统一处理message格式
            const exceptionResponse = exception.getResponse()
            if (typeof exceptionResponse === 'string') {
                myResponseObj.message = exceptionResponse
            } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const responseObj = exceptionResponse as any
                if (Array.isArray(responseObj.message)) {
                    // 将数组格式的验证错误转换为字符串
                    myResponseObj.message = responseObj.message.join('; ')
                } else if (typeof responseObj.message === 'string') {
                    myResponseObj.message = responseObj.message
                } else {
                    myResponseObj.message = responseObj.error || 'Unknown error'
                }
            } else {
                myResponseObj.message = 'Unknown error'
            }

            // 设置错误类型
            myResponseObj.error = this.getErrorType(myResponseObj.statusCode)
        } else if (exception instanceof PrismaClientValidationError) {
            // 处理Prisma客户端验证错误
            myResponseObj.statusCode = 422  // 无法处理的实体
            myResponseObj.message = exception.message.replaceAll(/\n/g, '')
            myResponseObj.error = 'Unprocessable Entity'
        } else {
            // 处理其他未知错误
            myResponseObj.statusCode = HttpStatus.INTERNAL_SERVER_ERROR
            myResponseObj.message = 'Internal Server Error'
            myResponseObj.error = 'Internal Server Error'
        }

        // 返回响应并记录错误日志
        response.status(myResponseObj.statusCode).json(myResponseObj)
        this.logger.error(myResponseObj.message, AllExceptionsFilter.name)

        // 调用父类方法完成异常处理
        super.catch(exception, host)
    }

    private getErrorType(status: number): string {
        switch (status) {
            case HttpStatus.BAD_REQUEST:
                return 'Bad Request';
            case HttpStatus.UNAUTHORIZED:
                return 'Unauthorized';
            case HttpStatus.FORBIDDEN:
                return 'Forbidden';
            case HttpStatus.NOT_FOUND:
                return 'Not Found';
            case HttpStatus.CONFLICT:
                return 'Conflict';
            case HttpStatus.UNPROCESSABLE_ENTITY:
                return 'Unprocessable Entity';
            case HttpStatus.INTERNAL_SERVER_ERROR:
                return 'Internal Server Error';
            default:
                return 'Error';
        }
    }
}