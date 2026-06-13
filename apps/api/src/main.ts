import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Self-hosted catalog/product images, served at /static/** (outside the /api prefix).
  app.useStaticAssets(join(process.cwd(), 'storage'), { prefix: '/static/' });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }),
  );

  const corsOrigins = (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim());
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
  await app.listen(port);
  console.log(`SirfBazar API listening on http://localhost:${port} (docs at /docs)`);
}

bootstrap();
