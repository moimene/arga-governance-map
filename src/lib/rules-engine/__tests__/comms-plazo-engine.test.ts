import { describe, it, expect } from 'vitest';
import { calcularPlazoComunicacion, subtractOneMonthFechaAFecha, type NormativeProfile } from '../comms-plazo-engine';

const baseProfile: NormativeProfile = {
  tipo_social: 'SA',
  es_cotizada: false,
  jurisdiction: 'ES',
};

describe('comms-plazo-engine', () => {
  it('CONVOCATORIA JG SA returns 30 days natural', () => {
    const result = calcularPlazoComunicacion({
      tipo_comunicacion: 'CONVOCATORIA',
      organo_tipo: 'JUNTA_GENERAL',
      entity_id: 'e1',
      fecha_evento_referenciado: new Date('2026-07-01T10:00:00Z'),
      normative_profile: baseProfile,
      template_id: null,
    });
    expect(result.plazo_dias).toBe(30);
    expect(result.unidad).toBe('NATURAL');
    expect(result.referencia_legal).toMatch(/176/);
    expect(result.min_envio_date).not.toBeNull();
  });

  it('CONVOCATORIA JG SL returns 15 days', () => {
    const result = calcularPlazoComunicacion({
      tipo_comunicacion: 'CONVOCATORIA',
      organo_tipo: 'JUNTA_GENERAL',
      entity_id: 'e1',
      fecha_evento_referenciado: new Date('2026-07-01T10:00:00Z'),
      normative_profile: { ...baseProfile, tipo_social: 'SL' },
      template_id: null,
    });
    expect(result.plazo_dias).toBe(15);
  });

  it('cotizada adds warning art. 516 LSC', () => {
    const result = calcularPlazoComunicacion({
      tipo_comunicacion: 'CONVOCATORIA',
      organo_tipo: 'JUNTA_GENERAL',
      entity_id: 'e1',
      fecha_evento_referenciado: new Date('2026-07-01T10:00:00Z'),
      normative_profile: { ...baseProfile, es_cotizada: true },
      template_id: null,
    });
    expect(result.warnings).toContainEqual(expect.stringMatching(/516/));
  });

  it('CONVOCATORIA CdA returns ESTATUTOS resolution', () => {
    const result = calcularPlazoComunicacion({
      tipo_comunicacion: 'CONVOCATORIA',
      organo_tipo: 'CONSEJO_ADMIN',
      entity_id: 'e1',
      fecha_evento_referenciado: new Date('2026-07-01T10:00:00Z'),
      normative_profile: baseProfile,
      template_id: null,
    });
    expect(result.fuente_resolucion).toBe('ESTATUTOS');
    expect(result.min_envio_date).toBeNull();
  });

  it('non-convocatoria without config returns null min_envio_date', () => {
    const result = calcularPlazoComunicacion({
      tipo_comunicacion: 'NOTIFICACION_ACUERDO',
      organo_tipo: 'CONSEJO_ADMIN',
      entity_id: 'e1',
      fecha_evento_referenciado: null,
      normative_profile: baseProfile,
      template_id: null,
    });
    expect(result.min_envio_date).toBeNull();
    expect(result.plazo_dias).toBe(0);
  });

  it('non-convocatoria WITH comunicacion_config uses configured plazo', () => {
    const result = calcularPlazoComunicacion({
      tipo_comunicacion: 'NOTIFICACION_CARGO',
      organo_tipo: 'CONSEJO_ADMIN',
      entity_id: 'e1',
      fecha_evento_referenciado: new Date('2026-07-01T10:00:00Z'),
      normative_profile: baseProfile,
      template_id: 'tpl_1',
      comunicacion_config: { plazo_legal_dias: 15, referencia_legal: 'Art. 249 LSC' },
    });
    expect(result.plazo_dias).toBe(15);
    expect(result.fuente_resolucion).toBe('COMUNICACION_CONFIG');
    expect(result.referencia_legal).toBe('Art. 249 LSC');
  });

  it('non-ES jurisdiction returns out-of-scope warning', () => {
    const result = calcularPlazoComunicacion({
      tipo_comunicacion: 'CONVOCATORIA',
      organo_tipo: 'JUNTA_GENERAL',
      entity_id: 'e1',
      fecha_evento_referenciado: null,
      normative_profile: { ...baseProfile, jurisdiction: 'BR' },
      template_id: null,
    });
    expect(result.warnings.some((w) => w.includes('BR'))).toBe(true);
    expect(result.referencia_legal).toMatch(/Multi-jurisdicción/);
  });
});

describe("ITEM-024 — cómputo y citas del plazo de convocatoria de junta", () => {
  const baseInput = {
    tipo_comunicacion: "CONVOCATORIA" as const,
    organo_tipo: "JUNTA_GENERAL" as const,
    entity_id: "e-1",
    template_id: null,
  };

  it("SL cita el art. 176.1 LSC (el 173 regula la forma, no el plazo)", () => {
    const result = calcularPlazoComunicacion({
      ...baseInput,
      fecha_evento_referenciado: new Date("2026-09-20T10:00:00Z"),
      normative_profile: { tipo_social: "SL", es_cotizada: false, jurisdiction: "ES" },
    });
    expect(result.plazo_dias).toBe(15);
    expect(result.referencia_legal).toBe("Art. 176.1 LSC");
  });

  it("SA computa un mes de fecha a fecha: junta 31/07 → límite 30/06 (no 01/07)", () => {
    const result = calcularPlazoComunicacion({
      ...baseInput,
      fecha_evento_referenciado: new Date(2026, 6, 31, 10, 0, 0), // 31 julio 2026
      normative_profile: { tipo_social: "SA", es_cotizada: false, jurisdiction: "ES" },
    });
    expect(result.min_envio_date?.getMonth()).toBe(5); // junio
    expect(result.min_envio_date?.getDate()).toBe(30);
  });

  it("subtractOneMonthFechaAFecha: casos de borde", () => {
    // 31/03 → 28/02 (2026 no bisiesto)
    const a = subtractOneMonthFechaAFecha(new Date(2026, 2, 31));
    expect([a.getMonth(), a.getDate()]).toEqual([1, 28]);
    // 15/05 → 15/04 (caso normal de fecha a fecha)
    const b = subtractOneMonthFechaAFecha(new Date(2026, 4, 15));
    expect([b.getMonth(), b.getDate()]).toEqual([3, 15]);
    // 01/01 → 01/12 año anterior
    const c = subtractOneMonthFechaAFecha(new Date(2026, 0, 1));
    expect([c.getFullYear(), c.getMonth(), c.getDate()]).toEqual([2025, 11, 1]);
  });
});
