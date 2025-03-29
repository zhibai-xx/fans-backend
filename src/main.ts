import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './all-exceptions.filter';

async function bootstrap() {
  // 创建NestJS应用实例，并传入根模块AppModule
  const app = await NestFactory.create(AppModule)
  
  // 获取HTTP适配器，用于异常过滤器
  const { httpAdapter } = app.get(HttpAdapterHost)
  // 注册全局异常过滤器，处理所有未捕获的异常
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter))

  // 启用CORS，允许跨域请求
  app.enableCors() 
  // 设置全局API前缀，所有路由都会以/api开头
  app.setGlobalPrefix('api')
  // 启动应用并监听指定端口，如果环境变量没有设置端口则使用3000
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
