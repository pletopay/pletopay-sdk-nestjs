# Example: basic app

A minimal NestJS app that creates checkout sessions, confirms payments on the server and receives webhooks through `@OnPletopayEvent` handlers.

```bash
pnpm install
PLETOPAY_SECRET_KEY=sk_test_… PLETOPAY_WEBHOOK_SECRET=whsec_… PORT=3000 npx ts-node examples/basic-app/src/main.ts   # ts-node (not tsx): Nest DI needs decorator metadata
curl -X POST localhost:3000/orders -H 'content-type: application/json' -d '{"orderId":"ORDER-1","amount":250000,"email":"ada@example.com"}'
```

Point a Pletopay webhook endpoint at `http://<host>:3000/webhooks/pletopay` (test mode allows loopback URLs locally) and send a test event from the dashboard or with `pletopay.webhookEndpoints.test(id)`.
