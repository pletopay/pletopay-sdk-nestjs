# Contributing

Thanks for helping improve the Pletopay NestJS module.

## Setup

```bash
pnpm install   # resolves @pletopay/node from ../pletopay-sdk-node (pnpm.overrides) until it is published
pnpm verify
```

Node.js 22 and pnpm 10 are used for development; the package supports Node.js 20+ and NestJS 10, 11 and 12.

## Layout

- `src/pletopay.module.ts`: the dynamic module. `src/pletopay.providers.ts`: the client providers.
- `src/webhooks/`: guard, decorators, dispatcher and the ready-made controller.
- `test/`: Jest suites run against real Nest apps on both the Express and the Fastify adapter, using the shared webhook fixtures in `fixtures/` (identical bytes to the Node and Python SDK repos).
- `examples/basic-app`: a runnable app (typechecked in `pnpm typecheck`).

The library is bundled with tsup (esbuild), which does not emit decorator metadata: inject dependencies with explicit `@Inject(token)` in library code.

## Style

Prettier and ESLint are enforced (`pnpm format`, `pnpm lint`). The brand is spelled "Pletopay"; only the protocol headers (`X-PletoPay-Signature`, `PletoPay-Version`) keep the capital P, and `pnpm check:brand` enforces this.

## Releasing

1. Bump `version` in `package.json`, move the _Unreleased_ changelog entries under the new version and date. Remove or update the `pnpm.overrides` link once `@pletopay/node` is published.
2. Tag `vX.Y.Z` and push the tag. The release workflow runs `pnpm verify` and publishes to npm with provenance.
