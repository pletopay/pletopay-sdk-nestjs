import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PletopayWebhookDispatcher } from '@pletopay/nestjs';
import {
  AuditService,
  FailingService,
  GatedService,
  ManualWebhookController,
  OrdersService,
  RequestScopedService,
  appModule,
  createExpressApp,
  createFastifyApp,
  fixture,
  flush,
  freshHeader,
  gate,
  armGate,
  payload,
  received,
} from './helpers';

// Send the exact bytes: supertest would JSON-serialise a Buffer into {"type":"Buffer",…}.
const post = (
  app: INestApplication,
  path: string,
  header: string | undefined,
  body: string = payload.toString('utf8'),
) => {
  const req = request(app.getHttpServer()).post(path).set('content-type', 'application/json');
  return (header === undefined ? req : req.set('x-pletopay-signature', header)).send(body);
};

describe.each([
  ['Express', createExpressApp],
  ['Fastify', createFastifyApp],
])('webhooks on %s', (_name, create) => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await create(appModule({ webhookPath: 'webhooks/pletopay' }, [], [ManualWebhookController]));
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    received.length = 0;
  });

  it('the ready-made controller verifies, answers 200 and dispatches after the response', async () => {
    const res = await post(app, '/webhooks/pletopay', freshHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    await flush();
    expect(received.map((r) => r.name).sort()).toEqual(['AuditService.onAny', 'OrdersService.onPaid']);
    expect(received[0]!.event.id).toBe(fixture.event_id);
    expect(received[0]!.event.type).toBe('payment.succeeded');
  });

  it('rejects a wrong signature with 400 and runs no handler', async () => {
    const res = await post(app, '/webhooks/pletopay', fixture.header_wrong);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/No signature found|tolerance/);
    await flush();
    expect(received).toHaveLength(0);
  });

  it('rejects a stale (fixture) signature, a missing header and a tampered body', async () => {
    expect((await post(app, '/webhooks/pletopay', fixture.header)).status).toBe(400);
    const missing = await post(app, '/webhooks/pletopay', undefined);
    expect(missing.status).toBe(400);
    expect(missing.body.message).toMatch(/Missing X-PletoPay-Signature/);
    const tampered = payload.toString().replace('5000000', '5000001');
    expect((await post(app, '/webhooks/pletopay', freshHeader(), tampered)).status).toBe(400);
  });

  it('@PletopayWebhook + @PletopayEvent on your own controller', async () => {
    const res = await post(app, '/hooks/manual', freshHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, type: 'payment.succeeded', id: fixture.event_id });
  });

  it('@PletopayEvent without the guard is a 500 with the fix', async () => {
    const res = await request(app.getHttpServer()).get('/hooks/no-guard');
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/needs PletopayWebhookGuard/);
  });

  it('dispatches only to matching handlers', async () => {
    const dispatcher = app.get(PletopayWebhookDispatcher);
    expect(dispatcher.registered.map((h) => h.name).sort()).toEqual([
      'AuditService.onAny',
      'OrdersService.onPaid',
      'OrdersService.onPayoutProblem',
    ]);
    await dispatcher.dispatch(
      {
        id: 'evt_x',
        object: 'event',
        type: 'transfer.failed',
        api_version: '2026-09-25',
        livemode: false,
        created_at: 'now',
        data: { object: {} },
      } as never,
      { handling: 'await' },
    );
    expect(received.map((r) => r.name).sort()).toEqual(['AuditService.onAny', 'OrdersService.onPayoutProblem']);
    received.length = 0;
    await dispatcher.dispatch(
      {
        id: 'evt_y',
        object: 'event',
        type: 'brand.new',
        api_version: '',
        livemode: false,
        created_at: '',
        data: { object: {} },
      },
      { handling: 'await' },
    );
    expect(received.map((r) => r.name)).toEqual(['AuditService.onAny']);
  });
});

describe('handling modes and failures', () => {
  it('after-response: a throwing handler is logged and the delivery still succeeds', async () => {
    const app = await createExpressApp(appModule({ webhookPath: 'hooks' }, [FailingService]));
    const res = await post(app, '/hooks', freshHeader());
    expect(res.status).toBe(200);
    await flush();
    await app.close();
  });

  it('await: a throwing handler fails the delivery so Pletopay retries', async () => {
    const app = await createExpressApp(appModule({ webhookPath: 'hooks', webhookHandling: 'await' }, [FailingService]));
    received.length = 0;
    const res = await post(app, '/hooks', freshHeader());
    expect(res.status).toBe(500);
    expect(received.map((r) => r.name)).toContain('OrdersService.onPaid'); // others still ran
    await app.close();
  });

  it('after-response: the response does not wait for handlers', async () => {
    const app = await createExpressApp(appModule({ webhookPath: 'hooks' }, [GatedService]));
    received.length = 0;
    armGate();
    const res = await post(app, '/hooks', freshHeader()); // resolves while GatedService is still waiting
    expect(res.status).toBe(200);
    expect(received.map((r) => r.name)).not.toContain('GatedService.onPaid');
    gate.open();
    await flush();
    expect(received.map((r) => r.name)).toContain('GatedService.onPaid');
    await app.close();
  });

  it('await: the response waits for handlers', async () => {
    const app = await createExpressApp(appModule({ webhookPath: 'hooks', webhookHandling: 'await' }, [GatedService]));
    received.length = 0;
    armGate();
    const pending = post(app, '/hooks', freshHeader());
    const winner = await Promise.race([
      pending.then(() => 'response'),
      new Promise((r) => setTimeout(() => r('timeout'), 150)),
    ]);
    expect(winner).toBe('timeout'); // still waiting on the gated handler
    gate.open();
    const res = await pending;
    expect(res.status).toBe(200);
    expect(received.map((r) => r.name).sort()).toEqual([
      'AuditService.onAny',
      'GatedService.onPaid',
      'OrdersService.onPaid',
    ]);
    await app.close();
  });

  it('request-scoped handlers are rejected at bootstrap', async () => {
    await expect(createExpressApp(appModule({}, [RequestScopedService]))).rejects.toThrow(
      /request- or transient-scoped/,
    );
  });

  it('without rawBody the guard explains the fix (500)', async () => {
    const app = await createExpressApp(appModule({ webhookPath: 'hooks' }), false);
    const res = await post(app, '/hooks', freshHeader());
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/rawBody: true/);
    await app.close();
  });

  it('without a webhook secret the guard explains the fix (500)', async () => {
    const app = await createExpressApp(appModule({ webhookSecret: undefined, webhookPath: 'hooks' }));
    const res = await post(app, '/hooks', freshHeader());
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/No webhook secret/);
    await app.close();
  });

  it('exposes the registered handlers for inspection', async () => {
    const app = await createExpressApp(appModule());
    const handlers = app.get(PletopayWebhookDispatcher).registered;
    expect(handlers.find((h) => h.name === 'OrdersService.onPayoutProblem')?.types).toEqual([
      'transfer.failed',
      'transfer.reversed',
    ]);
    expect(handlers.find((h) => h.name === 'AuditService.onAny')?.types).toEqual(['*']);
    expect(app.get(OrdersService)).toBeInstanceOf(OrdersService);
    expect(app.get(AuditService)).toBeInstanceOf(AuditService);
    await app.close();
  });
});
