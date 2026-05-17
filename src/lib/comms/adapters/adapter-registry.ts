import type { Canal } from '../types';
import type { MailAdapter } from './MailAdapter';
import { ResendAdapter } from './ResendAdapter';
import { ResendCertifiedAdapter } from './ResendCertifiedAdapter';
import { EADTrustERDSAdapter, type EADTrustClient } from './EADTrustERDSAdapter';
import { QTSPTimestampService, type QTSPClient } from './QTSPTimestampService';

export interface AdapterEnv {
  resendApiKey: string;
  resendBaseUrl?: string;
  eadTrustClient: EADTrustClient & QTSPClient;
  fetchImpl?: typeof fetch;
}

export function getAdapter(canal: Canal, env: AdapterEnv): MailAdapter {
  switch (canal) {
    case 'EMAIL_NORMAL':
      return new ResendAdapter({
        apiKey: env.resendApiKey,
        baseUrl: env.resendBaseUrl,
        fetch: env.fetchImpl,
      });
    case 'EMAIL_CERTIFICADO': {
      const resend = new ResendAdapter({
        apiKey: env.resendApiKey,
        baseUrl: env.resendBaseUrl,
        fetch: env.fetchImpl,
      });
      const qtsp = new QTSPTimestampService(env.eadTrustClient);
      return new ResendCertifiedAdapter(resend, qtsp);
    }
    case 'BUROFAX_ERDS':
      return new EADTrustERDSAdapter(env.eadTrustClient);
    case 'PORTAL_PUSH':
      throw new Error('PORTAL_PUSH not supported in P1; activated in P2 InternalPushAdapter');
    default: {
      const _exhaustive: never = canal;
      throw new Error(`Unknown canal: ${String(_exhaustive)}`);
    }
  }
}
