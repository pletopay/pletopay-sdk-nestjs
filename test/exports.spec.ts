import * as nest from '@pletopay/nestjs';
import * as node from '@pletopay/node';

describe('package surface', () => {
  it('re-exports the whole Node SDK', () => {
    for (const name of Object.keys(node).filter((n) => n !== 'default' && n !== '__esModule'))
      expect(name in nest).toBe(true);
    expect(nest.Pletopay).toBe(node.Pletopay);
    expect(nest.VERSION).toBe(node.VERSION);
  });

  it('exposes the module, guard, decorators and dispatcher', () => {
    for (const name of [
      'PletopayModule',
      'PletopayWebhookGuard',
      'PletopayWebhook',
      'PletopayEvent',
      'OnPletopayEvent',
      'PletopayWebhookDispatcher',
      'InjectPletopay',
      'PLETOPAY_OPTIONS',
      'PLETOPAY_CLIENT',
    ])
      expect(typeof (nest as Record<string, unknown>)[name]).not.toBe('undefined');
  });
});
