# Changelog

All notable changes to `@pletopay/nestjs` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org).

## [1.0.0] - 2026-10-23

### Added

- `PletopayModule.forRoot()` / `forRootAsync()` (`useFactory`, `useClass`, `useExisting`, `isGlobal`) providing the `Pletopay` client by class, `@InjectPletopay()` and the `PLETOPAY_CLIENT` token.
- `PletopayWebhookGuard`: verifies `X-PletoPay-Signature` over the raw body on Express and Fastify, 400 on bad signatures, 500 with the fix for configuration mistakes.
- `@PletopayWebhook()` route decorator and `@PletopayEvent()` parameter decorator.
- `@OnPletopayEvent()` handlers collected at bootstrap by `PletopayWebhookDispatcher`, with `after-response` (default) and `await` handling modes and a bootstrap error for request-scoped handlers.
- Ready-made webhook controller mounted with `webhookPath`.
- Re-export of the whole `@pletopay/node` SDK.
