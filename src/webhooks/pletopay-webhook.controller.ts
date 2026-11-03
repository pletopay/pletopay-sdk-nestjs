import { Controller, Inject, type Type } from '@nestjs/common';
import type { Event } from '@pletopay/node';
import { PLETOPAY_OPTIONS } from '../pletopay.constants';
import type { PletopayModuleOptions } from '../pletopay.options';
import { PletopayEvent } from './pletopay-event.decorator';
import { PletopayWebhook } from './pletopay-webhook.decorator';
import { PletopayWebhookDispatcher } from './pletopay-webhook.dispatcher';

/**
 * Builds the ready-made webhook controller mounted by `PletopayModule.forRoot({ webhookPath })`:
 * `POST <webhookPath>` verifies the delivery, dispatches it and answers `{ received: true }`.
 */
export function createPletopayWebhookController(path: string): Type<unknown> {
  @Controller(path)
  class PletopayWebhookController {
    constructor(
      @Inject(PletopayWebhookDispatcher) private readonly dispatcher: PletopayWebhookDispatcher,
      @Inject(PLETOPAY_OPTIONS) private readonly options: PletopayModuleOptions,
    ) {}

    @PletopayWebhook()
    async handle(@PletopayEvent() event: Event): Promise<{ received: true }> {
      await this.dispatcher.dispatch(event, { handling: this.options.webhookHandling });
      return { received: true };
    }
  }
  return PletopayWebhookController;
}
