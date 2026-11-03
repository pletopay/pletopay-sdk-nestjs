import { Module } from '@nestjs/common';
import { PletopayModule } from '@pletopay/nestjs';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    PletopayModule.forRoot({
      secretKey: process.env.PLETOPAY_SECRET_KEY,
      webhookSecret: process.env.PLETOPAY_WEBHOOK_SECRET,
      // POST /webhooks/pletopay: verified deliveries reach the @OnPletopayEvent handlers below.
      webhookPath: 'webhooks/pletopay',
    }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class AppModule {}
