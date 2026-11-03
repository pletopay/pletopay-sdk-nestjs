import { applyDecorators, HttpCode, Post, UseGuards } from '@nestjs/common';
import { PletopayWebhookGuard } from './pletopay-webhook.guard';

/**
 * `@Post(path)` + `@HttpCode(200)` + `@UseGuards(PletopayWebhookGuard)`: a route that only runs for
 * authentic deliveries. Combine with `@PletopayEvent()` to receive the event.
 */
export const PletopayWebhook = (path?: string | string[]): MethodDecorator & ClassDecorator =>
  applyDecorators(path === undefined ? Post() : Post(path), HttpCode(200), UseGuards(PletopayWebhookGuard));
