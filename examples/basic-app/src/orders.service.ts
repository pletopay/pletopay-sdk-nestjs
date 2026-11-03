import { Injectable, Logger } from '@nestjs/common';
import { OnPletopayEvent, type EventOf } from '@pletopay/nestjs';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly fulfilled = new Set<string>(); // use your database in production

  @OnPletopayEvent('payment.succeeded')
  onPaid(event: EventOf<'payment.succeeded'>): void {
    const payment = event.data.object;
    if (this.fulfilled.has(event.id)) return; // deliveries are at least once
    this.fulfilled.add(event.id);
    this.logger.log(`paid ${payment.reference}: ${payment.amount_received} kobo`);
  }

  @OnPletopayEvent(['transfer.failed', 'transfer.reversed'])
  onPayoutProblem(event: EventOf<'transfer.failed'> | EventOf<'transfer.reversed'>): void {
    this.logger.warn(`payout ${event.data.object.reference} ${event.type}: ${event.data.object.failure_reason ?? ''}`);
  }
}
