import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Pletopay, type CheckoutSession, type Payment } from '@pletopay/nestjs';

@Controller('orders')
export class OrdersController {
  constructor(private readonly pletopay: Pletopay) {}

  /** Creates a checkout session for an order; the browser redirects to `url` or opens the popup with `token`. */
  @Post()
  async create(
    @Body() body: { orderId: string; amount: number; email: string },
  ): Promise<Pick<CheckoutSession, 'id' | 'url' | 'token'>> {
    const session = await this.pletopay.checkout.sessions.create(
      {
        amount: body.amount,
        currency: 'NGN',
        reference: body.orderId,
        customer_email: body.email,
        success_url: 'https://shop.example.com/thanks',
      },
      { idempotencyKey: `checkout-${body.orderId}` },
    );
    return { id: session.id, url: session.url, token: session.token };
  }

  /** Confirms a payment from the server (never from a browser callback). */
  @Get(':reference')
  async status(@Param('reference') reference: string): Promise<Pick<Payment, 'status' | 'amount_received'>> {
    const payment = await this.pletopay.payments.retrieveByReference(reference);
    return { status: payment.status, amount_received: payment.amount_received };
  }
}
