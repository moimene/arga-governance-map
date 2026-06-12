// ITEM-099 — Tests de validación legal de representaciones
import { describe, it, expect } from 'vitest';
import {
  validarProxyJunta,
  validarDelegacionConsejo,
  type ProxyJuntaInput,
  type DelegacionConsejoInput,
} from '../representacion-validator';

// ─── Factory helpers ─────────────────────────────────────────────────────────

function makeProxy(overrides?: Partial<ProxyJuntaInput>): ProxyJuntaInput {
  return {
    tipoSocial: 'SA',
    esCotizada: false,
    representacionPorEscrito: true,
    caracterEspecialOGeneralDocPublico: true,
    revocable: true,
    referenciaDocumentoRepresentacion: 'PODER-2026-001',
    ...overrides,
  };
}

function makeDelegacion(overrides?: Partial<DelegacionConsejoInput>): DelegacionConsejoInput {
  return {
    esCotizada: true,
    caracterDelegante: 'NO_EJECUTIVO',
    caracterDelegado: 'NO_EJECUTIVO',
    delegadoEsConsejero: true,
    referenciaDocumentoDelegacion: 'DELEG-2026-001',
    ...overrides,
  };
}

// ─── A) Proxy de junta (arts. 183-187 / 523 LSC) ──────────────────────────────

describe('validarProxyJunta — proxy de junta general (arts. 183-187 LSC)', () => {
  it('PROXY-01: proxy SA bien formado es válido sin hallazgos bloqueantes', () => {
    const res = validarProxyJunta(makeProxy());
    expect(res.valida).toBe(true);
    expect(res.hallazgos.some((h) => h.severity === 'BLOCKING')).toBe(false);
  });

  it('PROXY-02: falta de forma escrita es BLOCKING (art. 184.2 LSC en SA)', () => {
    const res = validarProxyJunta(makeProxy({ representacionPorEscrito: false }));
    expect(res.valida).toBe(false);
    const h = res.hallazgos.find((x) => x.id === 'PROXY_FORMA_ESCRITA_FALTA');
    expect(h?.severity).toBe('BLOCKING');
    expect(h?.referenciaLegal).toBe('art. 184.2 LSC');
  });

  it('PROXY-03: falta carácter especial es BLOCKING (art. 183.2 LSC en SL)', () => {
    const res = validarProxyJunta(
      makeProxy({ tipoSocial: 'SL', caracterEspecialOGeneralDocPublico: false, vinculoRepresentante: 'OTRO_SOCIO' }),
    );
    const h = res.hallazgos.find((x) => x.id === 'PROXY_CARACTER_ESPECIAL_FALTA');
    expect(h?.referenciaLegal).toBe('art. 183.2 LSC');
    expect(res.valida).toBe(false);
  });

  it('PROXY-04: representación irrevocable es BLOCKING (art. 185 LSC)', () => {
    const res = validarProxyJunta(makeProxy({ revocable: false }));
    expect(res.hallazgos.some((x) => x.id === 'PROXY_IRREVOCABLE')).toBe(true);
    expect(res.valida).toBe(false);
  });

  it('PROXY-05: SL con representante fuera del círculo del art. 183 es BLOCKING', () => {
    const res = validarProxyJunta(
      makeProxy({ tipoSocial: 'SL', vinculoRepresentante: 'TERCERO' }),
    );
    const h = res.hallazgos.find((x) => x.id === 'PROXY_SL_FUERA_CIRCULO');
    expect(h?.severity).toBe('BLOCKING');
    expect(h?.referenciaLegal).toBe('art. 183.1 LSC');
    expect(res.valida).toBe(false);
  });

  it('PROXY-06: SL círculo del art. 183 (cónyuge) es válido', () => {
    const res = validarProxyJunta(
      makeProxy({ tipoSocial: 'SL', vinculoRepresentante: 'CONYUGE' }),
    );
    expect(res.valida).toBe(true);
  });

  it('PROXY-07: SL tercero admitido por estatutos degrada a WARNING (no bloquea)', () => {
    const res = validarProxyJunta(
      makeProxy({ tipoSocial: 'SL', vinculoRepresentante: 'TERCERO', estatutosAmplianCirculoSL: true }),
    );
    expect(res.valida).toBe(true);
    expect(res.hallazgos.some((x) => x.id === 'PROXY_SL_TERCERO_AMPLIADO_ESTATUTOS')).toBe(true);
  });

  it('PROXY-08: SA admite representante tercero (art. 184.1 LSC) como INFO', () => {
    const res = validarProxyJunta(
      makeProxy({ tipoSocial: 'SA', vinculoRepresentante: 'TERCERO' }),
    );
    expect(res.valida).toBe(true);
    const h = res.hallazgos.find((x) => x.id === 'PROXY_SA_TERCERO_ADMITIDO');
    expect(h?.severity).toBe('INFO');
  });

  it('PROXY-09: cotizada con conflicto sin instrucciones de voto es BLOCKING (art. 523 LSC)', () => {
    const res = validarProxyJunta(
      makeProxy({ esCotizada: true, representanteEnConflicto: true, instruccionesVotoPrecisas: false }),
    );
    const h = res.hallazgos.find((x) => x.id === 'PROXY_COTIZADA_CONFLICTO_SIN_INSTRUCCIONES');
    expect(h?.severity).toBe('BLOCKING');
    expect(h?.referenciaLegal).toBe('art. 523 LSC');
    expect(res.valida).toBe(false);
  });

  it('PROXY-10: cotizada con conflicto e instrucciones precisas degrada a WARNING', () => {
    const res = validarProxyJunta(
      makeProxy({ esCotizada: true, representanteEnConflicto: true, instruccionesVotoPrecisas: true }),
    );
    expect(res.valida).toBe(true);
    expect(res.hallazgos.some((x) => x.id === 'PROXY_COTIZADA_CONFLICTO_CON_INSTRUCCIONES')).toBe(true);
  });

  it('PROXY-11: ausencia de referencia documental emite WARNING (rastro probatorio)', () => {
    const res = validarProxyJunta(makeProxy({ referenciaDocumentoRepresentacion: '' }));
    expect(res.valida).toBe(true);
    const h = res.hallazgos.find((x) => x.id === 'PROXY_SIN_REFERENCIA_DOCUMENTAL');
    expect(h?.severity).toBe('WARNING');
  });
});

// ─── B) Delegación en consejo (art. 529 quáter LSC) ───────────────────────────

describe('validarDelegacionConsejo — delegación en consejo (art. 529 quáter LSC)', () => {
  it('CONSEJO-01: cotizada no ejecutivo→no ejecutivo es válido', () => {
    const res = validarDelegacionConsejo(makeDelegacion());
    expect(res.valida).toBe(true);
    expect(res.hallazgos.some((x) => x.id === 'CONSEJO_NO_EJECUTIVO_DELEGA_CONFORME')).toBe(true);
  });

  it('CONSEJO-02: cotizada no ejecutivo→ejecutivo es BLOCKING (art. 529 quáter LSC)', () => {
    const res = validarDelegacionConsejo(makeDelegacion({ caracterDelegado: 'EJECUTIVO' }));
    const h = res.hallazgos.find((x) => x.id === 'CONSEJO_NO_EJECUTIVO_DELEGA_EN_EJECUTIVO');
    expect(h?.severity).toBe('BLOCKING');
    expect(h?.referenciaLegal).toBe('art. 529 quáter LSC');
    expect(res.valida).toBe(false);
  });

  it('CONSEJO-03: delegado que no es consejero es BLOCKING', () => {
    const res = validarDelegacionConsejo(makeDelegacion({ delegadoEsConsejero: false }));
    expect(res.hallazgos.some((x) => x.id === 'CONSEJO_DELEGADO_NO_ES_CONSEJERO')).toBe(true);
    expect(res.valida).toBe(false);
  });

  it('CONSEJO-04: ejecutivo→ejecutivo en cotizada no se restringe por carácter', () => {
    const res = validarDelegacionConsejo(
      makeDelegacion({ caracterDelegante: 'EJECUTIVO', caracterDelegado: 'EJECUTIVO' }),
    );
    expect(res.valida).toBe(true);
    expect(
      res.hallazgos.some((x) => x.id === 'CONSEJO_NO_EJECUTIVO_DELEGA_EN_EJECUTIVO'),
    ).toBe(false);
  });

  it('CONSEJO-05: ausencia de referencia documental emite WARNING', () => {
    const res = validarDelegacionConsejo(makeDelegacion({ referenciaDocumentoDelegacion: null }));
    expect(res.valida).toBe(true);
    const h = res.hallazgos.find((x) => x.id === 'CONSEJO_SIN_REFERENCIA_DOCUMENTAL');
    expect(h?.severity).toBe('WARNING');
  });

  it('CONSEJO-06: no cotizada no aplica la restricción no ejecutivo→ejecutivo', () => {
    const res = validarDelegacionConsejo(
      makeDelegacion({ esCotizada: false, caracterDelegado: 'EJECUTIVO' }),
    );
    expect(res.valida).toBe(true);
  });
});
