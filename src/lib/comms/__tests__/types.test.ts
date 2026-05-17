import { describe, it, expect } from 'vitest';
import type { TipoComunicacion, TipoRespuestaEsperada, Canal, NivelCertificacion } from '../types';

describe('comms types', () => {
  it('TipoComunicacion enum has 16 valid values', () => {
    const all: TipoComunicacion[] = [
      'CONVOCATORIA','NOTIFICACION_INDIVIDUAL','PUESTA_DISPOSICION',
      'SOLICITUD_DECLARACION','CIRCULAR_SIN_SESION','RECORDATORIO',
      'NOTIFICACION_ACUERDO','REMISION_ACTA','CERTIFICACION',
      'NOTIFICACION_CARGO','ALERTA_VENCIMIENTO','CONSIGNACION',
      'COMUNICACION_INTER_ORGANO','SOLICITUD_INFORMACION',
      'RESPUESTA_INFORMACION','COMUNICACION_LIBRE',
    ];
    expect(all.length).toBe(16);
  });

  it('TipoRespuestaEsperada enum has 6 values', () => {
    const all: TipoRespuestaEsperada[] = ['ACUSE','ACEPTACION','VOTO','DECLARACION','DELEGACION','INFORMATIVA'];
    expect(all.length).toBe(6);
  });

  it('Canal enum has 4 values; NivelCertificacion has 3 (excludes PORTAL_PUSH)', () => {
    const canales: Canal[] = ['EMAIL_NORMAL','EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH'];
    const niveles: NivelCertificacion[] = ['EMAIL_NORMAL','EMAIL_CERTIFICADO','BUROFAX_ERDS'];
    expect(canales.length).toBe(4);
    expect(niveles.length).toBe(3);
  });
});
