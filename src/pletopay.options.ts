import type { ModuleMetadata, Type } from '@nestjs/common';
import type { PletopayOptions } from '@pletopay/node';

/** How `@OnPletopayEvent` handlers run relative to the HTTP response. */
export type WebhookHandling = 'after-response' | 'await';

export interface PletopayModuleOptions extends PletopayOptions {
  /** Register the providers globally so every module can inject `Pletopay`. Default false. */
  isGlobal?: boolean;
  /**
   * Mount a ready-made webhook controller at this path (e.g. `'webhooks/pletopay'`). It verifies the
   * signature, dispatches to `@OnPletopayEvent` handlers and answers `{ received: true }`.
   */
  webhookPath?: string;
  /**
   * `after-response` (default): respond 200 first, then run handlers; a failing handler is logged, not
   * retried by Pletopay. `await`: run handlers before responding; a throwing handler makes the
   * delivery fail (5xx) so Pletopay retries it.
   */
  webhookHandling?: WebhookHandling;
}

export interface PletopayOptionsFactory {
  createPletopayOptions(): Promise<PletopayModuleOptions> | PletopayModuleOptions;
}

export interface PletopayModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  isGlobal?: boolean;
  /** Must be known synchronously (it configures a controller), so it is set here rather than in the factory. */
  webhookPath?: string;
  useFactory?: (...args: never[]) => Promise<PletopayModuleOptions> | PletopayModuleOptions;
  inject?: (string | symbol | Type<unknown>)[];
  useClass?: Type<PletopayOptionsFactory>;
  useExisting?: Type<PletopayOptionsFactory>;
}
