import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { OrderOtpInterceptor } from './common/order-otp.interceptor';
import { registerJsonBodyParsers } from './merchant/bulk-body-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  registerJsonBodyParsers(app);

  // Self-hosted catalog/product images, served at /static/** (outside the /api prefix).
  app.useStaticAssets(join(process.cwd(), 'storage'), { prefix: '/static/' });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }),
  );
  app.useGlobalInterceptors(new OrderOtpInterceptor());

  const defaultCorsOrigins = [
    'https://sirfbazar.com',
    'https://www.sirfbazar.com',
    'https://admin.sirfbazar.com',
    'https://shop.sirfbazar.com',
    'https://pos.sirfbazar.com',
  ];
  const corsOrigins = [
    ...new Set(
      [...(process.env.CORS_ORIGINS ?? '*').split(','), ...defaultCorsOrigins]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SirfBazar API')
    .setDescription('Hyperlocal multi-merchant commerce and delivery platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.PORT) || 3001;
  if (process.env.HOST) await app.listen(port, process.env.HOST);
  else await app.listen(port);
  console.log(`SirfBazar API listening on http://localhost:${port} (docs at /docs)`);
}

bootstrap();
