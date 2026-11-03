import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import type { Event, UnknownEvent } from '@pletopay/node';
import { ON_PLETOPAY_EVENT, PLETOPAY_OPTIONS } from '../pletopay.constants';
import type { PletopayModuleOptions, WebhookHandling } from '../pletopay.options';

export interface PletopayEventHandler {
  /** Event types, or `'*'`. */
  types: readonly string[];
  /** `ClassName.method`, for logs. */
  name: string;
  handle: (event: Event | UnknownEvent) => unknown;
}

export interface DispatchOptions {
  /** Overrides the module's `webhookHandling` for this call. */
  handling?: WebhookHandling;
}

/**
 * Collects `@OnPletopayEvent()` methods from singleton providers and controllers at bootstrap and
 * runs the matching ones for each verified event.
 *
 * Request-scoped (or transient) classes are rejected at bootstrap: resolving them per event would
 * need a request context that a webhook delivery does not have.
 */
@Injectable()
export class PletopayWebhookDispatcher implements OnModuleInit {
  private readonly logger = new Logger(PletopayWebhookDispatcher.name);
  private handlers: PletopayEventHandler[] = [];

  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(MetadataScanner) private readonly scanner: MetadataScanner,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PLETOPAY_OPTIONS) private readonly options: PletopayModuleOptions,
  ) {}

  onModuleInit(): void {
    this.handlers = this.collect();
    if (this.handlers.length) {
      this.logger.log(
        `Registered ${this.handlers.length} webhook handler(s): ${this.handlers.map((h) => h.name).join(', ')}`,
      );
    }
  }

  /** The registered handlers (read-only). */
  get registered(): readonly PletopayEventHandler[] {
    return this.handlers;
  }

  /**
   * Runs the handlers for `event`. In `after-response` mode (default) this resolves immediately and
   * the handlers run on the next tick, so the HTTP response goes out first; in `await` mode it waits
   * for them and rethrows the first failure.
   */
  async dispatch(event: Event | UnknownEvent, options: DispatchOptions = {}): Promise<void> {
    const handling = options.handling ?? this.options.webhookHandling ?? 'after-response';
    const matching = this.handlers.filter((h) => h.types.includes('*') || h.types.includes(event.type));
    if (handling === 'await') {
      await Promise.all(matching.map((h) => this.run(h, event, true)));
      return;
    }
    setImmediate(() => {
      for (const handler of matching) void this.run(handler, event, false);
    });
  }

  private async run(handler: PletopayEventHandler, event: Event | UnknownEvent, rethrow: boolean): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      this.logger.error(
        `${handler.name} failed for ${event.type} ${event.id}: ${describe(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (rethrow) throw error;
    }
  }

  private collect(): PletopayEventHandler[] {
    const handlers: PletopayEventHandler[] = [];
    const wrappers: InstanceWrapper[] = [...this.discovery.getProviders(), ...this.discovery.getControllers()];
    for (const wrapper of wrappers) {
      const instance: unknown = wrapper.instance;
      const metatype = wrapper.metatype as { name: string } | null;
      if (!instance || typeof instance !== 'object' || !metatype) continue;
      const prototype = Object.getPrototypeOf(instance) as object | null;
      if (!prototype) continue;
      for (const method of this.scanner.getAllMethodNames(prototype)) {
        const target = (prototype as Record<string, unknown>)[method];
        if (typeof target !== 'function') continue;
        const types = this.reflector.get<string[] | undefined>(ON_PLETOPAY_EVENT, target);
        if (!types) continue;
        const name = `${metatype.name}.${method}`;
        if (!wrapper.isDependencyTreeStatic()) {
          throw new Error(
            `@OnPletopayEvent on ${name}: the class is request- or transient-scoped. Webhook handlers must be singletons (no request context exists for a delivery).`,
          );
        }
        handlers.push({
          types,
          name,
          handle: (event) => (target as (this: unknown, event: Event | UnknownEvent) => unknown).call(instance, event),
        });
      }
    }
    return handlers;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
