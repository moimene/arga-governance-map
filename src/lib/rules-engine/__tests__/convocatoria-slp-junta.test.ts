// ============================================================
// Motor de Reglas LSC — Convocatoria de Junta de Socios SLP (G3 Task 5)
// Pack GARR_JUNTA_SOCIOS v1.1.0 — referencias estatutarias FIRMES de
// convocatoria (docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md,
// sección "COTEJO CON EL TEXTO VIGENTE DE LOS ESTATUTOS", 2026-08-05).
//
// El fragmento `convocatoria` de abajo es el mismo valor que
// `JUNTA_SOCIOS_V110_PAYLOAD.convocatoria` en
// scripts/seed-garrigues-rule-packs.ts y que el payload embebido en
// supabase/migrations/20260805100000_g3_junta_socios_pack_v110.sql
// (verificado por JSON round-trip al generar esa migración desde el mismo
// objeto TS). No se importa el script de seed directamente: es un
// entrypoint bun con `main()` autoejecutado y una guarda que puede llamar
// `process.exit(1)` — acoplar un test unitario del motor a esos efectos de
// proceso sería frágil. Se fixturiza aquí, siguiendo el patrón de
// `createTestPack` ya usado en convocatoria-engine.test.ts.
// ============================================================

import { describe, it, expect } from 'vitest';
import { evaluarConvocatoria } from '../convocatoria-engine';
import type { RulePack, ConvocatoriaInput, ReglaConvocatoria } from '../types';

/**
 * createTestPack — mismo helper que convocatoria-engine.test.ts: pack
 * mínimo válido con overrides dirigidos.
 */
function createTestPack(overrides?: Partial<RulePack>): RulePack {
  const baseId = Math.random().toString(36).substr(2, 9);

  return {
    id: `pack-${baseId}`,
    materia: 'PRUEBA',
    clase: 'ORDINARIA',
    organoTipo: 'JUNTA_GENERAL',
    modosAdopcionPermitidos: ['MEETING'],
    convocatoria: {
      antelacionDias: {
        SA: { valor: 30, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
        SL: { valor: 15, fuente: 'LEY', referencia: 'art. 176.2 LSC' },
        SAU: { valor: 30, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
        SLU: { valor: 15, fuente: 'LEY', referencia: 'art. 176.2 LSC' },
        SLP: { valor: 15, fuente: 'LEY', referencia: 'art. 176.2 LSC' },
      },
      canales: {
        SA: ['BORME', 'WEB_SOCIEDAD'],
        SL: ['BUROFAX', 'EMAIL_CERTIFICADO'],
        SAU: ['BORME', 'WEB_SOCIEDAD'],
        SLU: ['BUROFAX', 'EMAIL_CERTIFICADO'],
        SLP: ['BUROFAX', 'EMAIL_CERTIFICADO'],
      },
      contenidoMinimo: ['Orden del día', 'Lugar', 'Hora', 'Fecha'],
      documentosObligatorios: [
        { id: 'doc-001', nombre: 'Informe de gestión', condicion: 'Si se revisan cuentas' },
      ],
    },
    constitucion: {
      quorum: {
        SA_1a: { valor: 0.25, fuente: 'LEY', referencia: 'art. 187 LSC' },
        SA_2a: { valor: 0, fuente: 'LEY', referencia: 'art. 187 LSC' },
        SL: { valor: 0, fuente: 'LEY', referencia: 'art. 197 LSC' },
        CONSEJO: { valor: 'mayoria_miembros', fuente: 'LEY', referencia: 'art. 240 LSC' },
      },
    },
    votacion: {
      mayoria: {
        SA: { formula: 'favor > contra', fuente: 'LEY', referencia: 'art. 189 LSC' },
        SL: { formula: 'favor > contra', fuente: 'LEY', referencia: 'art. 199 LSC' },
        CONSEJO: { formula: 'mayoria_miembros', fuente: 'LEY', referencia: 'art. 242 LSC' },
      },
      abstenciones: 'no_cuentan',
    },
    documentacion: {
      obligatoria: [{ id: 'doc-001', nombre: 'Informe de gestión' }],
      ventanaDisponibilidad: { dias: 30, fuente: 'LEY' },
    },
    acta: {
      tipoActaPorModo: { MEETING: 'ACTA_JUNTA' },
      contenidoMinimo: {
        sesion: ['Fecha y hora', 'Asistentes', 'Orden del día', 'Acuerdos adoptados'],
        consignacion: ['Propuesta', 'Decisión'],
        acuerdoEscrito: ['Propuesta', 'Aceptaciones', 'Rechazo'],
      },
      requiereTranscripcionLibroActas: true,
      requiereConformidadConjunta: false,
    },
    plazosMateriales: {
      inscripcion: { plazo_dias: 30, fuente: 'LEY', referencia: 'art. 215 LSC' },
    },
    postAcuerdo: {
      inscribible: false,
      instrumentoRequerido: 'NINGUNO',
      publicacionRequerida: false,
    },
    ...overrides,
  };
}

// Fragmento `convocatoria` de GARR_JUNTA_SOCIOS v1.1.0 (SA no cambia en la
// subida de versión — se conserva por completitud del pack real, aunque este
// test no lo ejercita).
const JUNTA_SOCIOS_V110_CONVOCATORIA: ReglaConvocatoria = {
  canales: {
    SA: ['BORME', 'WEB_INSCRITA'],
    SL: ['COMUNICACION_INDIVIDUAL_CON_ACUSE'],
    SLP: ['COMUNICACION_INDIVIDUAL_CON_ACUSE'],
    // Unipersonales: mismo canal que su tipo de origen. El pack real de
    // Garrigues es SLP; SAU y SLU estan por completitud del Record.
    SAU: ['BORME', 'WEB_INSCRITA'],
    SLU: ['COMUNICACION_INDIVIDUAL_CON_ACUSE'],
  },
  antelacionDias: {
    SA: { valor: 30, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
    SL: { valor: 15, fuente: 'ESTATUTOS', referencia: 'arts. 27.4 Estatutos y 176 LSC (supletoria)' },
    SLP: { valor: 15, fuente: 'ESTATUTOS', referencia: 'arts. 27.4 Estatutos y 176 LSC (supletoria)' },
    SAU: { valor: 30, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
    SLU: { valor: 15, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
  },
  contenidoMinimo: ['Fecha hora y lugar', 'Orden del día', 'Texto íntegro de la propuesta cuando proceda'],
  documentosObligatorios: [
    { id: 'propuesta', nombre: 'Texto íntegro de la propuesta', condicion: 'SIEMPRE' },
    { id: 'informe_admin', nombre: 'Informe del administrador único', condicion: 'SIEMPRE' },
  ],
};

function createGarrJuntaSociosV110Pack(): RulePack {
  return createTestPack({
    id: 'GARR_JUNTA_SOCIOS',
    materia: 'GARR_JUNTA_SOCIOS',
    clase: 'ESTATUTARIA',
    organoTipo: 'JUNTA_GENERAL',
    modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
    convocatoria: JUNTA_SOCIOS_V110_CONVOCATORIA,
  });
}

describe('evaluarConvocatoria — Junta de Socios SLP (GARR_JUNTA_SOCIOS v1.1.0)', () => {
  const baseInput: ConvocatoriaInput = {
    tipoSocial: 'SLP',
    organoTipo: 'JUNTA_GENERAL',
    adoptionMode: 'MEETING',
    fechaJunta: '2026-09-15',
    esCotizada: false,
    webInscrita: false,
    primeraConvocatoria: true,
    esJuntaUniversal: false,
    materias: ['NOMBRAMIENTO_ADMINISTRADOR_UNICO'],
  };

  it('exige 15 días de antelación y el canal de comunicación individual con acuse (arts. 27.3/27.4 Estatutos)', () => {
    const pack = createGarrJuntaSociosV110Pack();

    const result = evaluarConvocatoria(baseInput, [pack], []);

    expect(result.antelacionDiasRequerida).toBe(15);
    expect(result.canalesExigidos).toContain('COMUNICACION_INDIVIDUAL_CON_ACUSE');
    expect(result.ok).toBe(true);
    expect(result.severity).toBe('OK');
    // SLP no es SA: no hereda los canales de publicación pública de junta.
    expect(result.canalesExigidos).not.toContain('BORME');
    expect(result.canalesExigidos).not.toContain('WEB_INSCRITA');
  });

  it('el pack v1.1.0 cita la antelación como estatutaria firme, no solo LSC supletoria (cotejo 2026-08-05)', () => {
    const pack = createGarrJuntaSociosV110Pack();
    const antelacionSlp = pack.convocatoria.antelacionDias.SLP;

    expect(antelacionSlp.fuente).toBe('ESTATUTOS');
    expect(antelacionSlp.referencia).toBe('arts. 27.4 Estatutos y 176 LSC (supletoria)');
    // Corrección de cita obligada (Comité Legal 2026-08-04): la antelación
    // nunca cita Ley 2/2007, que no regula plazos de convocatoria.
    expect(antelacionSlp.referencia).not.toContain('Ley 2/2007');
  });
});
