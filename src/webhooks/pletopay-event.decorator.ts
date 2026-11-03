import { createParamDecorator, type ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { PLETOPAY_EVENT_KEY } from '../pletopay.constants';

/**
 * Injects the event that `PletopayWebhookGuard` verified for this request (no re-verification).
 *
 * @example `handle(@PletopayEvent() event: Event) { … }`
 */
export const PletopayEvent = createParamDecorator((_data: unknown, context: ExecutionContext): unknown => {
  const request = context.switchToHttp().getRequest<Record<string, unknown>>();
  const event = request[PLETOPAY_EVENT_KEY];
  if (event === undefined) {
    throw new InternalServerErrorException(
      '@PletopayEvent() needs PletopayWebhookGuard on the route: use @PletopayWebhook() or @UseGuards(PletopayWebhookGuard)',
    );
  }
  return event;
});
