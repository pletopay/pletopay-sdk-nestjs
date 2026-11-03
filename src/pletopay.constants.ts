/** Injection token for the resolved {@link PletopayModuleOptions}. */
export const PLETOPAY_OPTIONS = Symbol('PLETOPAY_OPTIONS');
/** Injection token for the `Pletopay` client (the `Pletopay` class itself also works as a token). */
export const PLETOPAY_CLIENT = Symbol('PLETOPAY_CLIENT');
/** Metadata key set by `@OnPletopayEvent()`. */
export const ON_PLETOPAY_EVENT = 'pletopay:on-event';
/** Request property where the webhook guard stores the verified event. */
export const PLETOPAY_EVENT_KEY = 'pletopayEvent';
