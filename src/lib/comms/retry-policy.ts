import { MailAdapterError } from './adapters/MailAdapter';
import type { Canal } from './types';

export type RetryAction =
  | { kind: 'RETRY_SAME' }
  | { kind: 'PROMOTE_FALLBACK' }
  | { kind: 'MARK_ERROR'; reason: string };

export const MAX_RETRIES = 3;

export function computeNextAction(
  err: Error,
  state: { intento_n: number; canal_fallback: Canal | null },
): RetryAction {
  const isAdapterErr = err instanceof MailAdapterError;
  const retriable = isAdapterErr ? err.retriable : false;

  if (retriable && state.intento_n < MAX_RETRIES) {
    return { kind: 'RETRY_SAME' };
  }

  if (state.canal_fallback) {
    return { kind: 'PROMOTE_FALLBACK' };
  }

  return { kind: 'MARK_ERROR', reason: err.message };
}
