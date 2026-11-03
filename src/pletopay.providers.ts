import { Inject, type Provider } from '@nestjs/common';
import { Pletopay } from '@pletopay/node';
import { PLETOPAY_CLIENT, PLETOPAY_OPTIONS } from './pletopay.constants';
import type { PletopayModuleOptions } from './pletopay.options';

/** `@InjectPletopay()` injects the client; `constructor(private readonly pletopay: Pletopay)` works too. */
export const InjectPletopay = (): ReturnType<typeof Inject> => Inject(Pletopay);

export function createClient(options: PletopayModuleOptions): Pletopay {
  const {
    isGlobal: _isGlobal,
    webhookPath: _webhookPath,
    webhookHandling: _webhookHandling,
    ...clientOptions
  } = options;
  return new Pletopay(clientOptions);
}

export const clientProviders: Provider[] = [
  { provide: Pletopay, useFactory: createClient, inject: [PLETOPAY_OPTIONS] },
  { provide: PLETOPAY_CLIENT, useExisting: Pletopay },
];
