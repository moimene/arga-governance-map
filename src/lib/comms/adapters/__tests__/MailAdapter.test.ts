import { describe, it, expect } from 'vitest';
import { MailAdapterError } from '../MailAdapter';

describe('MailAdapterError', () => {
  it('carries retriable flag, canal, and cause', () => {
    const cause = new Error('socket reset');
    const err = new MailAdapterError('timeout', 'EMAIL_NORMAL', true, cause);
    expect(err.name).toBe('MailAdapterError');
    expect(err.retriable).toBe(true);
    expect(err.canal).toBe('EMAIL_NORMAL');
    expect(err.message).toBe('timeout');
    expect(err.cause).toBe(cause);
  });
});
