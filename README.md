# Pletopay NestJS module

`@pletopay/nestjs` wires the [Pletopay](https://docs.pletopay.com) Node.js SDK into NestJS: an injectable `Pletopay` client, a guard that verifies `X-PletoPay-Signature` on webhook deliveries, and `@OnPletopayEvent()` handlers that receive typed events. It re-exports everything from `@pletopay/node`, so one import covers both.

- NestJS 10, 11 and 12 (Express or Fastify). Node.js 20+.
- Everything in `@pletopay/node`: all 82 API operations, idempotency keys, retries, pagination, typed errors.

## Install

```bash
npm install @pletopay/nestjs
# or: pnpm add @pletopay/nestjs · yarn add @pletopay/nestjs
```

## Register the module

```ts
import { Module } from '@nestjs/common';
import { PletopayModule } from '@pletopay/nestjs';

@Module({
  imports: [
    PletopayModule.forRoot({
      secretKey: process.env.PLETOPAY_SECRET_KEY, // sk_test_… / sk_live_…
      webhookSecret: process.env.PLETOPAY_WEBHOOK_SECRET, // whsec_…
      webhookPath: 'webhooks/pletopay', // optional: mounts POST /webhooks/pletopay (see Webhooks)
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

Every `PletopayOptions` of the Node SDK is accepted (`baseUrl`, `apiVersion`, `timeoutMs`, `maxRetries`, `fetch`, `dispatcher`, `hooks`, `logger`, `appInfo`, …).

With `ConfigService` or any async source:

```ts
PletopayModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secretKey: config.getOrThrow('PLETOPAY_SECRET_KEY'),
    webhookSecret: config.get('PLETOPAY_WEBHOOK_SECRET'),
  }),
  webhookPath: 'webhooks/pletopay',
});
```

`useClass` / `useExisting` with a `PletopayOptionsFactory` work too.

## Use the client

```ts
import { Injectable } from '@nestjs/common';
import { Pletopay, PletopayConflictError } from '@pletopay/nestjs';

@Injectable()
export class OrdersService {
  constructor(private readonly pletopay: Pletopay) {}

  async checkout(orderId: string, amount: number) {
    const session = await this.pletopay.checkout.sessions.create(
      { amount, currency: 'NGN', reference: orderId, success_url: 'https://shop.test/thanks' },
      { idempotencyKey: `checkout-${orderId}` },
    );
    return { url: session.url, token: session.token }; // hosted page, or the popup with pletopay.js
  }

  async isPaid(orderId: string) {
    const payment = await this.pletopay.payments.retrieveByReference(orderId);
    return payment.status === 'succeeded';
  }
}
```

`@InjectPletopay()` and the `PLETOPAY_CLIENT` token inject the same instance. See the [Node SDK README](https://github.com/evidenze/pletopay-sdk-node#readme) for every resource, pagination, errors and retries.

## Webhooks

Pletopay signs every delivery. The guard verifies the signature against the raw request body, so create the app with `rawBody: true`:

```ts
const app = await NestFactory.create(AppModule, { rawBody: true }); // Express and Fastify alike
```

### Option 1: handlers only

Set `webhookPath` on the module and annotate methods of any singleton provider or controller:

```ts
import { Injectable } from '@nestjs/common';
import { OnPletopayEvent, type EventOf } from '@pletopay/nestjs';

@Injectable()
export class OrdersService {
  @OnPletopayEvent('payment.succeeded')
  async onPaid(event: EventOf<'payment.succeeded'>) {
    await this.fulfil(event.data.object.reference, event.data.object.amount_received); // typed as Payment
  }

  @OnPletopayEvent(['transfer.failed', 'transfer.reversed'])
  onPayoutProblem(event: EventOf<'transfer.failed'> | EventOf<'transfer.reversed'>) { … }

  @OnPletopayEvent('*')
  audit(event: Event) { … }
}
```

The built-in controller at `POST <webhookPath>` verifies the delivery, answers `{ received: true }` and runs the matching handlers.

By default handlers run **after the response** (`webhookHandling: 'after-response'`): Pletopay gets its 200 within the 10-second window and a throwing handler is logged, not retried. Set `webhookHandling: 'await'` to run handlers before responding; then a throwing handler fails the delivery with a 5xx and Pletopay retries it. Handlers must live on singleton classes: request- or transient-scoped handlers are rejected at bootstrap.

Deliveries are at least once and unordered: de-duplicate on `event.id` in your handler.

### Option 2: your own route

```ts
import { Controller } from '@nestjs/common';
import { PletopayEvent, PletopayWebhook, type Event } from '@pletopay/nestjs';

@Controller('hooks')
export class WebhookController {
  @PletopayWebhook('pletopay') // = @Post('pletopay') + @HttpCode(200) + @UseGuards(PletopayWebhookGuard)
  handle(@PletopayEvent() event: Event) {
    switch (event.type) {
      case 'payment.succeeded':
        return this.orders.fulfil(event.data.object.reference);
    }
    return { received: true };
  }
}
```

`PletopayWebhookGuard` can also be applied with `@UseGuards()`; inject `PletopayWebhookDispatcher` and call `dispatch(event)` to run the `@OnPletopayEvent` handlers from your own route.

### Responses

| Situation                                                          | Response                        |
| ------------------------------------------------------------------ | ------------------------------- |
| Valid signature                                                    | your handler runs (200)         |
| Wrong, stale (more than 300 s) or missing signature, tampered body | 400, no handler runs            |
| App created without `rawBody: true`, or no `webhookSecret`         | 500 with the fix in the message |

To test your handler, sign a payload with `generateTestHeaderString({ payload, secret })` from `@pletopay/nestjs` and post it.

## Development

```bash
pnpm install        # links ../pletopay-sdk-node during development (pnpm.overrides in package.json)
pnpm verify         # lint, format, typecheck, brand check, Jest (Express + Fastify), build, publint, attw
```

## License

[MIT](LICENSE)
