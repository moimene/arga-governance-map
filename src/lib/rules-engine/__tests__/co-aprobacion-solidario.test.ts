import { describe, it, expect } from 'vitest';
import { renderTemplate } from '@/lib/doc-gen/template-renderer';
import { evaluarCoAprobacion, evaluarSolidario } from '../votacion-engine';
import type { CoAprobacionConfig, SolidarioConfig } from '../types';

// ─── Factory helpers ────────────────────────────────────────────────────────

function makeCoAprobConfig(overrides?: Partial<CoAprobacionConfig>): CoAprobacionConfig {
  return {
    k: 2,
    n: 3,
    ventanaConsenso: '15d',
    estatutosPermitenSinSesion: true,
    firmas: [
      { adminId: 'admin-1', fechaFirma: '2026-04-20T10:00:00Z', hashDocumento: 'hash1' },
      { adminId: 'admin-2', fechaFirma: '2026-04-20T11:00:00Z', hashDocumento: 'hash2' },
    ],
    ...overrides,
  };
}

function makeSolidarioConfig(overrides?: Partial<SolidarioConfig>): SolidarioConfig {
  return {
    adminActuante: 'admin-solid-1',
    restriccionesEstatutarias: [],
    vigenciaDesde: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

const ADMIN_VIGENTES = ['admin-1', 'admin-2', 'admin-3', 'admin-solid-1'];
const FECHA_ACUERDO = '2026-04-20T12:00:00Z';

// ─── CO_APROBACION ───────────────────────────────────────────────────────────

describe('evaluarCoAprobacion', () => {
  // CO-01
  it('CO-01: k=2 n=3, 2 firmas válidas → ok=true', () => {
    const result = evaluarCoAprobacion(makeCoAprobConfig(), ADMIN_VIGENTES, FECHA_ACUERDO);
    expect(result.ok).toBe(true);
    expect(result.severity).toBe('OK');
    expect(result.blocking_issues).toHaveLength(0);
  });

  // CO-02
  it('CO-02: k=2 n=3, solo 1 firma válida → ok=false FIRMAS_INSUFICIENTES', () => {
    const config = makeCoAprobConfig({
      k: 2,
      firmas: [{ adminId: 'admin-1', fechaFirma: '2026-04-20T10:00:00Z', hashDocumento: 'h1' }],
    });
    const result = evaluarCoAprobacion(config, ADMIN_VIGENTES, FECHA_ACUERDO);
    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain('co_aprobacion_firmas_insuficientes');
  });

  // CO-03
  it('CO-03: firma de admin no vigente se filtra → cuenta como insuficiente', () => {
    const config = makeCoAprobConfig({
      k: 2,
      firmas: [
        { adminId: 'admin-UNKNOWN', fechaFirma: '2026-04-20T10:00:00Z', hashDocumento: 'h1' },
        { adminId: 'admin-1', fechaFirma: '2026-04-20T11:00:00Z', hashDocumento: 'h2' },
      ],
    });
    // solo admin-1 es vigente, admin-UNKNOWN no → 1 válida < k=2
    const result = evaluarCoAprobacion(config, ADMIN_VIGENTES, FECHA_ACUERDO);
    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain('co_aprobacion_firmas_insuficientes');
  });

  // CO-04
  it('CO-04: estatutos no permiten sin sesión → ok=false', () => {
    const config = makeCoAprobConfig({ estatutosPermitenSinSesion: false });
    const result = evaluarCoAprobacion(config, ADMIN_VIGENTES, FECHA_ACUERDO);
    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain('co_aprobacion_no_permitida_estatutos');
  });

  // CO-05
  it('CO-05: k=1 n=1 caso mínimo → ok=true', () => {
    const config = makeCoAprobConfig({
      k: 1,
      n: 1,
      firmas: [{ adminId: 'admin-1', fechaFirma: '2026-04-20T10:00:00Z', hashDocumento: 'h1' }],
    });
    const result = evaluarCoAprobacion(config, ADMIN_VIGENTES, FECHA_ACUERDO);
    expect(result.ok).toBe(true);
  });

  // CO-06
  it('CO-06: mismo adminId en dos firmas → ok=false FIRMAS_DUPLICADAS', () => {
    const config = makeCoAprobConfig({
      k: 2,
      firmas: [
        { adminId: 'admin-1', fechaFirma: '2026-04-20T10:00:00Z', hashDocumento: 'h1' },
        { adminId: 'admin-1', fechaFirma: '2026-04-20T11:00:00Z', hashDocumento: 'h2' }, // duplicado
      ],
    });
    const result = evaluarCoAprobacion(config, ADMIN_VIGENTES, FECHA_ACUERDO);
    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain('co_aprobacion_firmas_duplicadas');
  });

  it('administradores mancomunados k=n exigen firma de todos los administradores conjuntos', () => {
    const config = makeCoAprobConfig({
      k: 2,
      n: 2,
      firmas: [{ adminId: 'admin-1', fechaFirma: '2026-04-20T10:00:00Z', hashDocumento: 'h1' }],
    });
    const result = evaluarCoAprobacion(config, ADMIN_VIGENTES, FECHA_ACUERDO);

    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain('co_aprobacion_firmas_insuficientes');
  });

  it('acta de co-aprobación puede reflejar ambas firmas QTSP como input estable', () => {
    const rendered = renderTemplate({
      template: 'ACTA_DECISION_CONJUNTA\nFirmas QTSP: {{firma1}} y {{firma2}}. QTSP: EAD Trust.',
      variables: { firma1: 'QES-admin-1', firma2: 'QES-admin-2' },
    });

    expect(rendered.ok).toBe(true);
    expect(rendered.text).toContain('QES-admin-1');
    expect(rendered.text).toContain('QES-admin-2');
    expect(rendered.text).toContain('EAD Trust');
  });
});

// ─── SOLIDARIO ───────────────────────────────────────────────────────────────

describe('evaluarSolidario', () => {
  // SO-01
  it('SO-01: admin vigente, materia no restringida → ok=true', () => {
    const result = evaluarSolidario(makeSolidarioConfig(), ADMIN_VIGENTES, 'DELEGACION_FACULTADES', FECHA_ACUERDO);
    expect(result.ok).toBe(true);
    expect(result.severity).toBe('OK');
  });

  // SO-02
  it('SO-02: admin no vigente → ok=false ADMIN_NO_VIGENTE', () => {
    const config = makeSolidarioConfig({ adminActuante: 'admin-UNKNOWN' });
    const result = evaluarSolidario(config, ADMIN_VIGENTES, 'DELEGACION_FACULTADES', FECHA_ACUERDO);
    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain('solidario_admin_no_vigente');
  });

  // SO-03
  it('SO-03: materia restringida requiere cofirma, cofirma ausente → ok=false', () => {
    const config = makeSolidarioConfig({
      restriccionesEstatutarias: [{
        materia: 'FUSION',
        requiereCofirma: true,
        cofirmantes: ['admin-2'],
      }],
    });
    // firmasPresentes is [] → cofirma ausente
    const result = evaluarSolidario(config, ADMIN_VIGENTES, 'FUSION', FECHA_ACUERDO, []);
    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain('solidario_cofirma_ausente');
  });

  // SO-04
  it('SO-04: materia no restringida (restricción es para otra materia) → ok=true', () => {
    const config = makeSolidarioConfig({
      restriccionesEstatutarias: [{
        materia: 'FUSION',
        requiereCofirma: true,
        cofirmantes: ['admin-2'],
      }],
    });
    // materia=DELEGACION_FACULTADES → no restricted
    const result = evaluarSolidario(config, ADMIN_VIGENTES, 'DELEGACION_FACULTADES', FECHA_ACUERDO);
    expect(result.ok).toBe(true);
  });

  it('adopción SOLIDARIO permite actuación individual y documenta administrador actuante', () => {
    const result = evaluarSolidario(makeSolidarioConfig({ adminActuante: 'admin-solid-1' }), ADMIN_VIGENTES, 'APROBACION_OPERACION', FECHA_ACUERDO);
    const rendered = renderTemplate({
      template: 'ACTA_ORGANO_ADMIN\nAdministrador actuante: {{adminActuante}}.\nCertificación: {{certificacion}}.',
      variables: {
        adminActuante: 'admin-solid-1',
        certificacion: `Certifica acuerdo adoptado por ${result.ok ? 'admin-solid-1' : 'NO_VALIDO'}`,
      },
    });

    expect(result.ok).toBe(true);
    expect(rendered.text).toContain('admin-solid-1');
  });
});
