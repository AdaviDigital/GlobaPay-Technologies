import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { validateEnv } from './config/validate-env';

// Validate environment variables before starting the application
validateEnv(process.env);

async function bootstrap() {
  try {
    console.log('🚀 Starting GlobaPay API...');

    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      {
        cors: false,
      },
    );

    console.log('✅ Nest application created.');

    // Trust Render/Railway reverse proxy
    app.set('trust proxy', 1);

    const configuredOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    app.enableCors({
      origin: configuredOrigins,
      credentials: true,
    });

    app.use(helmet());

    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    // Health endpoint remains available at /health
    app.setGlobalPrefix('api', {
      exclude: ['health'],
    });

    const port = process.env.PORT
      ? parseInt(process.env.PORT, 10)
      : 4000;

    console.log(`🌐 Attempting to listen on port ${port}...`);

    await app.listen(port, '0.0.0.0');

    console.log(`✅ GlobaPay API listening on port ${port}`);
    console.log(`✅ Health endpoint: /health`);
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ BOOTSTRAP FAILED');
    console.error('========================================');

    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:\n', error.stack);
    } else {
      console.error(error);
    }

    console.error('========================================\n');

    process.exit(1);
  }
}

bootstrap();
