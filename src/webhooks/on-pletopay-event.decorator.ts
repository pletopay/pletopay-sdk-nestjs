import { SetMetadata } from '@nestjs/common';
import type { EventType } from '@pletopay/node';
import { ON_PLETOPAY_EVENT } from '../pletopay.constants';

/** `'*'` receives every event. */
export type PletopayEventSelector = EventType | '*' | (EventType | '*')[];

/**
 * Marks a method of a singleton provider or controller as a handler for one or more webhook events.
 * The method receives the verified, typed event. Handlers are collected at bootstrap by
 * `PletopayWebhookDispatcher` and run when a delivery passes `PletopayWebhookGuard`.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class OrdersService {
 *   @OnPletopayEvent('payment.succeeded')
 *   async onPaid(event: EventOf<'payment.succeeded'>) { … }
 * }
 * ```
 */
export const OnPletopayEvent = (types: PletopayEventSelector): MethodDecorator =>
  SetMetadata(ON_PLETOPAY_EVENT, Array.isArray(types) ? types : [types]);
