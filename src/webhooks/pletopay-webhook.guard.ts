import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Pletopay, PletopayError, PletopaySignatureVerificationError } from '@pletopay/node';
import { PLETOPAY_EVENT_KEY } from '../pletopay.constants';

interface WebhookRequest {
  rawBody?: Buffer | string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  [PLETOPAY_EVENT_KEY]?: unknown;
}

/**
 * Verifies `X-PletoPay-Signature` over the raw request body and stores the parsed event on the
 * request for `@PletopayEvent()`. Needs the raw body: create the app with
 * `NestFactory.create(AppModule, { rawBody: true })` (Express and Fastify both set `request.rawBody`).
 *
 * A bad or stale signature answers 400. A missing raw body or webhook secret is a configuration
 * error and answers 500 with the fix in the message.
 */
@Injectable()
export class PletopayWebhookGuard implements CanActivate {
  constructor(@Inject(Pletopay) private readonly pletopay: Pletopay) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
    const rawBody = request.rawBody ?? (Buffer.isBuffer(request.body) ? request.body : undefined);
    if (rawBody === undefined) {
      throw new InternalServerErrorException(
        'PletopayWebhookGuard needs the raw request body. Create the app with NestFactory.create(AppModule, { rawBody: true }).',
      );
    }
    try {
      request[PLETOPAY_EVENT_KEY] = this.pletopay.webhooks.constructEvent(
        rawBody,
        request.headers['x-pletopay-signature'],
      );
      return true;
    } catch (error) {
      if (error instanceof PletopaySignatureVerificationError) throw new BadRequestException(error.message);
      if (error instanceof PletopayError) throw new InternalServerErrorException(error.message);
      throw error;
    }
  }
}
