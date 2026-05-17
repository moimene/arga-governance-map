import { describe, it, expect } from 'vitest';
import { computeNextAction } from '../retry-policy';
import { MailAdapterError } from '../adapters/MailAdapter';

describe('retry-policy.computeNextAction', () => {
  it('retriable error and intento_n < 3 → RETRY_SAME', () => {
    const err = new MailAdapterError('5xx', 'EMAIL_NORMAL', true);
    const action = computeNextAction(err, { intento_n: 1, canal_fallback: null });
    expect(action.kind).toBe('RETRY_SAME');
  });

  it('retriable + intento_n >= 3 + fallback exists → PROMOTE_FALLBACK', () => {
    const err = new MailAdapterError('5xx', 'EMAIL_NORMAL', true);
    const action = computeNextAction(err, { intento_n: 3, canal_fallback: 'BUROFAX_ERDS' });
    expect(action.kind).toBe('PROMOTE_FALLBACK');
  });

  it('retriable + intento_n >= 3 + no fallback → MARK_ERROR', () => {
    const err = new MailAdapterError('5xx', 'EMAIL_NORMAL', true);
    const action = computeNextAction(err, { intento_n: 3, canal_fallback: null });
    expect(action.kind).toBe('MARK_ERROR');
  });

  it('non-retriable + fallback → PROMOTE_FALLBACK', () => {
    const err = new MailAdapterError('400', 'EMAIL_NORMAL', false);
    const action = computeNextAction(err, { intento_n: 0, canal_fallback: 'BUROFAX_ERDS' });
    expect(action.kind).toBe('PROMOTE_FALLBACK');
  });

  it('non-retriable + no fallback → MARK_ERROR', () => {
    const err = new MailAdapterError('400', 'EMAIL_NORMAL', false);
    const action = computeNextAction(err, { intento_n: 0, canal_fallback: null });
    expect(action.kind).toBe('MARK_ERROR');
  });
});
