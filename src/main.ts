import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // 设置时区为中国标准时间 (UTC+8)
  process.env.TZ = 'Asia/Shanghai';

  // 创建NestJS应用实例，完全禁用默认body parser
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // 手动配置body parser，确保multipart请求不被JSON解析器处理
  const express = require('express');
  const multer = require('multer');

  // 创建一个临时的multer实例用于检测multipart请求
  const upload = multer();

  // 精确的请求处理中间件
  app.use((req, res, next) => {
    const contentType = req.get('content-type') || '';
    const rawHeaders = req.rawHeaders;

    // 详细日志用于调试
    console.log(`[Body Parser] ${req.method} ${req.path}`);
    console.log(`[Body Parser] Content-Type: "${contentType}"`);
    console.log(`[Body Parser] Raw Headers: ${JSON.stringify(rawHeaders)}`);

    // 更严格的multipart检测
    const isMultipart = contentType.toLowerCase().startsWith('multipart/form-data');
    const isUploadChunk = req.path === '/api/upload/chunk';

    if (isMultipart || isUploadChunk) {
      // multipart请求或上传分片路由：完全跳过所有body parser
      console.log('[Body Parser] Skipping multipart/upload request');
      next();
    } else if (contentType.includes('application/json')) {
      // JSON请求：使用JSON解析器
      console.log('[Body Parser] Using JSON parser');
      express.json({ limit: '50mb' })(req, res, next);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // URL编码请求：使用URL编码解析器
      console.log('[Body Parser] Using URL encoded parser');
      express.urlencoded({ limit: '50mb', extended: true })(req, res, next);
    } else if (contentType === '') {
      // 空Content-Type：可能是OPTIONS请求，直接跳过
      console.log('[Body Parser] Empty content-type, skipping');
      next();
    } else {
      // 其他请求：尝试JSON解析器（兼容性）
      console.log('[Body Parser] Using default JSON parser for unknown type');
      express.json({ limit: '50mb' })(req, res, next);
    }
  });

  // 获取HTTP适配器，用于异常过滤器
  const { httpAdapter } = app.get(HttpAdapterHost)
  // 注册全局异常过滤器，处理所有未捕获的异常
  app.useGlobalFilters(
    new AllExceptionsFilter(httpAdapter)  // 统一异常处理（包含HTTP异常格式统一）
  )

  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // 自动删除非 DTO 中定义的属性
    transform: true, // 自动转换类型
    forbidNonWhitelisted: true, // 禁止非白名单属性
    transformOptions: {
      enableImplicitConversion: true, // 启用隐式类型转换
    },
  }));

  // 启用CORS，允许跨域请求
  // app.enableCors()
  app.enableCors({
    origin: 'http://localhost:3001',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'], // 明确允许 Authorization
    credentials: true,
  });
  // 设置全局API前缀，所有路由都会以/api开头
  app.setGlobalPrefix('api')

  // 配置 Swagger
  const config = new DocumentBuilder()
    .setTitle('Fans Backend API')
    .setDescription('Fans 后端 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // 启动应用并监听指定端口，如果环境变量没有设置端口则使用3001
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
