import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // 创建NestJS应用实例，并传入根模块AppModule
  const app = await NestFactory.create(AppModule)
  
  // 获取HTTP适配器，用于异常过滤器
  const { httpAdapter } = app.get(HttpAdapterHost)
  // 注册全局异常过滤器，处理所有未捕获的异常
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter))

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
  app.enableCors() 
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

  // 启动应用并监听指定端口，如果环境变量没有设置端口则使用3000
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
