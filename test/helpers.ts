import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Injectable, Module, Scope, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { generateTestHeaderString, type Event, type EventOf } from '@pletopay/node';
import {
  OnPletopayEvent,
  PletopayEvent,
  PletopayModule,
  PletopayWebhook,
  type PletopayModuleOptions,
} from '@pletopay/nestjs';

export const TEST_KEY = 'sk_test_0123456789abcdef_0123456789abcdef0123456789abcdef01234567';

interface Fixture {
  payload_file: string;
  secret: string;
  timestamp: number;
  header: string;
  header_wrong: string;
  event_id: string;
  event_type: string;
}

const dir = join(__dirname, '..', 'fixtures');
export const fixture = JSON.parse(readFileSync(join(dir, 'webhook-signature.json'), 'utf8')) as Fixture;
export const payload: Buffer = readFileSync(join(dir, fixture.payload_file));
export const SECRET = fixture.secret;

/** A fresh, valid signature header for `payload` (the fixture's own header is from 2026 and would be stale). */
export const freshHeader = (body: Buffer | string = payload, secret = SECRET): string =>
  generateTestHeaderString({ payload: body, secret });

export const received: { name: string; event: Event }[] = [];

/** A handler that waits until the test opens the gate, to observe when handlers run relative to the response. */
export let gate: { promise: Promise<void>; open: () => void } = armGate();
export function armGate(): { promise: Promise<void>; open: () => void } {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  gate = { promise, open };
  return gate;
}

@Injectable()
export class GatedService {
  @OnPletopayEvent('payment.succeeded')
  async onPaid(event: EventOf<'payment.succeeded'>): Promise<void> {
    await gate.promise;
    received.push({ name: 'GatedService.onPaid', event });
  }
}

@Injectable()
export class OrdersService {
  @OnPletopayEvent('payment.succeeded')
  async onPaid(event: EventOf<'payment.succeeded'>): Promise<void> {
    received.push({ name: 'OrdersService.onPaid', event });
  }

  @OnPletopayEvent(['transfer.failed', 'transfer.reversed'])
  onPayoutProblem(event: Event): void {
    received.push({ name: 'OrdersService.onPayoutProblem', event });
  }
}

@Injectable()
export class AuditService {
  @OnPletopayEvent('*')
  onAny(event: Event): void {
    received.push({ name: 'AuditService.onAny', event });
  }
}

@Injectable()
export class FailingService {
  @OnPletopayEvent('payment.succeeded')
  boom(): void {
    throw new Error('handler exploded');
  }
}

@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {
  @OnPletopayEvent('payment.succeeded')
  onPaid(): void {}
}

@Controller('hooks')
export class ManualWebhookController {
  @PletopayWebhook('manual')
  handle(@PletopayEvent() event: Event): { ok: true; type: string; id: string } {
    return { ok: true, type: event.type, id: event.id };
  }

  @Get('no-guard')
  noGuard(@PletopayEvent() event: Event): unknown {
    return event;
  }
}

export function appModule(
  options: Partial<PletopayModuleOptions> = {},
  extraProviders: unknown[] = [],
  controllers: unknown[] = [],
): new () => unknown {
  @Module({
    imports: [PletopayModule.forRoot({ secretKey: TEST_KEY, webhookSecret: SECRET, ...options })],
    providers: [OrdersService, AuditService, ...(extraProviders as never[])],
    controllers: controllers as never[],
  })
  class AppModule {}
  return AppModule;
}

export async function createExpressApp(module: new () => unknown, rawBody = true): Promise<INestApplication> {
  const app = await NestFactory.create(module, { rawBody, logger: false });
  await app.init();
  return app;
}

export async function createFastifyApp(module: new () => unknown, rawBody = true): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(module, new FastifyAdapter(), {
    rawBody,
    logger: false,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export const flush = (): Promise<void> => new Promise((resolve) => setImmediate(() => setImmediate(resolve)));
