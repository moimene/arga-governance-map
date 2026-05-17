import { describe, it, expect } from 'vitest';
import { getAdapter, type AdapterEnv } from '../adapter-registry';

const env: AdapterEnv = {
  resendApiKey: 'k',
  eadTrustClient: {} as never,
};

describe('adapter-registry', () => {
  it('returns the right adapter for each canal', () => {
    expect(getAdapter('EMAIL_NORMAL', env).canalSoportado).toBe('EMAIL_NORMAL');
    expect(getAdapter('EMAIL_CERTIFICADO', env).canalSoportado).toBe('EMAIL_CERTIFICADO');
    expect(getAdapter('BUROFAX_ERDS', env).canalSoportado).toBe('BUROFAX_ERDS');
  });

  it('throws for PORTAL_PUSH in P1', () => {
    expect(() => getAdapter('PORTAL_PUSH', env)).toThrow(/PORTAL_PUSH not supported/);
  });
});
