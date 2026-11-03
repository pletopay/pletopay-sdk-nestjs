import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pletopay } from '@pletopay/node';
import {
  InjectPletopay,
  PLETOPAY_CLIENT,
  PLETOPAY_OPTIONS,
  PletopayModule,
  PletopayWebhookDispatcher,
  PletopayWebhookGuard,
  type PletopayModuleOptions,
  type PletopayOptionsFactory,
} from '@pletopay/nestjs';
import { SECRET, TEST_KEY } from './helpers';

@Injectable()
class UsesClient {
  constructor(
    readonly byClass: Pletopay,
    @InjectPletopay() readonly byDecorator: Pletopay,
    @Inject(PLETOPAY_CLIENT) readonly byToken: Pletopay,
  ) {}
}

describe('PletopayModule.forRoot', () => {
  it('provides one client under the class, the decorator and the token', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PletopayModule.forRoot({
          secretKey: TEST_KEY,
          baseUrl: 'http://api.test',
          maxRetries: 0,
          webhookSecret: SECRET,
        }),
      ],
      providers: [UsesClient],
    }).compile();
    const uses = moduleRef.get(UsesClient);
    expect(uses.byClass).toBeInstanceOf(Pletopay);
    expect(uses.byClass).toBe(uses.byDecorator);
    expect(uses.byClass).toBe(uses.byToken);
    expect(uses.byClass.mode).toBe('test');
    expect(uses.byClass.baseUrl).toBe('http://api.test');
    expect(moduleRef.get(PletopayWebhookGuard)).toBeInstanceOf(PletopayWebhookGuard);
    expect(moduleRef.get(PletopayWebhookDispatcher)).toBeInstanceOf(PletopayWebhookDispatcher);
    expect(moduleRef.get<PletopayModuleOptions>(PLETOPAY_OPTIONS).webhookSecret).toBe(SECRET);
    await moduleRef.close();
  });

  it('does not leak module flags into the client options', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PletopayModule.forRoot({ secretKey: TEST_KEY, isGlobal: true, webhookPath: 'hooks', webhookHandling: 'await' }),
      ],
    }).compile();
    expect(moduleRef.get(Pletopay)).toBeInstanceOf(Pletopay);
    await moduleRef.close();
  });

  it('surfaces client configuration errors at bootstrap', async () => {
    await expect(
      Test.createTestingModule({ imports: [PletopayModule.forRoot({ secretKey: 'pk_test_abc_def' })] }).compile(),
    ).rejects.toThrow(/publishable key/);
  });

  it('is importable from a feature module when global', async () => {
    @Injectable()
    class FeatureService {
      constructor(readonly pletopay: Pletopay) {}
    }
    @Module({ providers: [FeatureService] })
    class FeatureModule {}
    const moduleRef = await Test.createTestingModule({
      imports: [PletopayModule.forRoot({ secretKey: TEST_KEY, isGlobal: true }), FeatureModule],
    }).compile();
    expect(moduleRef.get(FeatureService).pletopay).toBeInstanceOf(Pletopay);
    await moduleRef.close();
  });
});

describe('PletopayModule.forRootAsync', () => {
  const CONFIG = Symbol('CONFIG');

  it('useFactory with injected dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PletopayModule.forRootAsync({
          imports: [
            {
              module: class ConfigModule {},
              providers: [{ provide: CONFIG, useValue: { key: TEST_KEY } }],
              exports: [CONFIG],
            },
          ],
          inject: [CONFIG],
          useFactory: async (config: { key: string }) => ({ secretKey: config.key, baseUrl: 'http://async.test' }),
          webhookPath: 'hooks/async',
        }),
      ],
    }).compile();
    expect(moduleRef.get(Pletopay).baseUrl).toBe('http://async.test');
    expect(moduleRef.get<PletopayModuleOptions>(PLETOPAY_OPTIONS).webhookPath).toBe('hooks/async');
    await moduleRef.close();
  });

  it('useClass', async () => {
    @Injectable()
    class OptionsFactory implements PletopayOptionsFactory {
      createPletopayOptions(): PletopayModuleOptions {
        return { secretKey: TEST_KEY, baseUrl: 'http://class.test' };
      }
    }
    const moduleRef = await Test.createTestingModule({
      imports: [PletopayModule.forRootAsync({ useClass: OptionsFactory })],
    }).compile();
    expect(moduleRef.get(Pletopay).baseUrl).toBe('http://class.test');
    await moduleRef.close();
  });

  it('useExisting', async () => {
    @Injectable()
    class OptionsFactory implements PletopayOptionsFactory {
      async createPletopayOptions(): Promise<PletopayModuleOptions> {
        return { secretKey: TEST_KEY, baseUrl: 'http://existing.test' };
      }
    }
    @Module({ providers: [OptionsFactory], exports: [OptionsFactory] })
    class FactoryModule {}
    const moduleRef = await Test.createTestingModule({
      imports: [PletopayModule.forRootAsync({ imports: [FactoryModule], useExisting: OptionsFactory })],
    }).compile();
    expect(moduleRef.get(Pletopay).baseUrl).toBe('http://existing.test');
    await moduleRef.close();
  });

  it('rejects a configuration without a factory', () => {
    expect(() => PletopayModule.forRootAsync({})).toThrow(/useFactory, useClass or useExisting/);
  });
});
