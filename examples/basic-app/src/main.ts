import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody: true keeps the exact bytes Pletopay signed, which the webhook guard needs.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`listening on :${port}`);
}

void bootstrap();
