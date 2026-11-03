import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Pletopay } from '@pletopay/node';
import { PLETOPAY_CLIENT, PLETOPAY_OPTIONS } from './pletopay.constants';
import type { PletopayModuleAsyncOptions, PletopayModuleOptions, PletopayOptionsFactory } from './pletopay.options';
import { clientProviders } from './pletopay.providers';
import { createPletopayWebhookController } from './webhooks/pletopay-webhook.controller';
import { PletopayWebhookDispatcher } from './webhooks/pletopay-webhook.dispatcher';
import { PletopayWebhookGuard } from './webhooks/pletopay-webhook.guard';

const EXPORTS = [Pletopay, PLETOPAY_CLIENT, PLETOPAY_OPTIONS, PletopayWebhookGuard, PletopayWebhookDispatcher];

/**
 * Provides the `Pletopay` client, the webhook guard and the `@OnPletopayEvent` dispatcher.
 *
 * @example
 * ```ts
 * PletopayModule.forRoot({ secretKey: process.env.PLETOPAY_SECRET_KEY, webhookSecret: process.env.PLETOPAY_WEBHOOK_SECRET, webhookPath: 'webhooks/pletopay' })
 * PletopayModule.forRootAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: (config: ConfigService) => ({ secretKey: config.get('PLETOPAY_SECRET_KEY') }) })
 * ```
 */
@Module({})
export class PletopayModule {
  static forRoot(options: PletopayModuleOptions): DynamicModule {
    return this.build([{ provide: PLETOPAY_OPTIONS, useValue: options }], options.isGlobal, options.webhookPath, []);
  }

  static forRootAsync(options: PletopayModuleAsyncOptions): DynamicModule {
    return this.build(this.asyncProviders(options), options.isGlobal, options.webhookPath, options.imports ?? []);
  }

  private static build(
    optionsProviders: Provider[],
    isGlobal: boolean | undefined,
    webhookPath: string | undefined,
    imports: NonNullable<DynamicModule['imports']>,
  ): DynamicModule {
    return {
      module: PletopayModule,
      global: isGlobal === true,
      imports: [DiscoveryModule, ...imports],
      providers: [...optionsProviders, ...clientProviders, PletopayWebhookGuard, PletopayWebhookDispatcher],
      controllers: webhookPath ? [createPletopayWebhookController(webhookPath)] : [],
      exports: EXPORTS,
    };
  }

  private static asyncProviders(options: PletopayModuleAsyncOptions): Provider[] {
    const withModuleFlags = (resolved: PletopayModuleOptions): PletopayModuleOptions => ({
      ...resolved,
      isGlobal: options.isGlobal ?? resolved.isGlobal,
      webhookPath: options.webhookPath ?? resolved.webhookPath,
    });
    if (options.useFactory) {
      const factory = options.useFactory;
      return [
        {
          provide: PLETOPAY_OPTIONS,
          useFactory: async (...args: never[]) => withModuleFlags(await factory(...args)),
          inject: options.inject ?? [],
        },
      ];
    }
    const factoryClass = options.useClass ?? options.useExisting;
    if (!factoryClass) {
      throw new Error('PletopayModule.forRootAsync needs useFactory, useClass or useExisting');
    }
    return [
      {
        provide: PLETOPAY_OPTIONS,
        useFactory: async (factory: PletopayOptionsFactory) => withModuleFlags(await factory.createPletopayOptions()),
        inject: [factoryClass],
      },
      ...(options.useClass ? [{ provide: options.useClass, useClass: options.useClass }] : []),
    ];
  }
}
