import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node20',
  platform: 'node',
  splitting: false,
  // Peer and runtime dependencies stay external; consumers provide Nest.
  external: ['@nestjs/common', '@nestjs/core', 'reflect-metadata', 'rxjs', '@pletopay/node'],
});
