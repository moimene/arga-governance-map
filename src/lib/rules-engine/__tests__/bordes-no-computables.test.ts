/**
 * Test suite para evaluarBordesNoComputables()
 *
 * 8+ test cases covering the 7 "non-computable edges":
 * 1. Cotizadas → WARNING (evalúa LSC + advertencias LMV) — DL-2
 * 2. Consentimiento de clase
 * 3. Suficiencia de liquidez
 * 4. Indelegabilidad fina
 * 5. Junta telemática
 * 6. Evidencia publicación SA
 * 7. Evidencia notificación SL
 */

import { describe, it, expect } from 'vitest';
import {
  evaluarBordesNoComputables,
  BordeInput,
  ReglaNoComputable,
} from '../bordes-no-computables';

describe('evaluarBordesNoComputables', () => {
  // Test 1: Cotizada → WARNING LMV (no bloqueo) + continúa evaluando bordes restantes
  it('should return LMV warnings when esCotizada=true and continue evaluating other bordes', () => {
    const input: BordeInput = {
      esCotizada: true,
      tipoSocial: 'SA',
      materias: ['NOMBRAMIENTO_CESE_ADMIN'],
      indelegabilidadVerificada: false,
    };

    const result = evaluarBordesNoComputables(input);

    // Should have LMV warnings (hecho relevante + IPDD + IAGC) + indelegabilidad borde
    expect(result.length).toBeGreaterThanOrEqual(3);

    const ids = result.map((r) => r.id);
    expect(ids).toContain('BORDE_COTIZADA_LMV_HECHO_RELEVANTE');
    expect(ids).toContain('BORDE_COTIZADA_LMV_IPDD');
    expect(ids).toContain('BORDE_COTIZADA_IAGC');

    // LMV bordes are WARNING, not CRITICAL/BLOCKING
    const lmvBordes = result.filter((r) => r.id.startsWith('BORDE_COTIZADA_'));
    lmvBordes.forEach((b) => {
      expect(['WARNING', 'INFO']).toContain(b.severity);
      expect(b.status).toBe('PENDIENTE');
    });

    // Motor continues: indelegabilidad borde should also appear
    expect(ids).toContain('BORDE_INDELEGABILIDAD_NO_VERIFICADA');
  });

  // Test 1b: Cotizada con operaciones vinculadas → adds extra WARNING
  it('should add operaciones vinculadas warning for cotizada with relevant materias', () => {
    const input: BordeInput = {
      esCotizada: true,
      tipoSocial: 'SA',
      materias: ['AUTORIZACION_TRANSACCION'],
    };

    const result = evaluarBordesNoComputables(input);

    const ids = result.map((r) => r.id);
    expect(ids).toContain('BORDE_COTIZADA_OPERACIONES_VINCULADAS');
  });

  // Test 1c: Cotizada sin materias vinculadas → no operaciones vinculadas warning
  it('should NOT add operaciones vinculadas warning for cotizada without relevant materias', () => {
    const input: BordeInput = {
      esCotizada: true,
      tipoSocial: 'SA',
      materias: ['MOD_ESTATUTOS'],
    };

    const result = evaluarBordesNoComputables(input);

    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('BORDE_COTIZADA_OPERACIONES_VINCULADAS');
    // But should still have the base LMV warnings
    expect(ids).toContain('BORDE_COTIZADA_LMV_HECHO_RELEVANTE');
  });

  // Test 2: Consentimiento de clase sin perimetro → BLOCKING
  it('should flag BORDE_CONSENTIMIENTO_CLASE_SIN_PERIMETRO when materias include clase-impactantes and perimetroClaseDefinido=false', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SA',
      materias: ['MOD_ESTATUTOS', 'AUMENTO_CAPITAL'],
      perimetroClaseDefinido: false,
    };

    const result = evaluarBordesNoComputables(input);

    const consentimientoBorde = result.find(
      (r) => r.id === 'BORDE_CONSENTIMIENTO_CLASE_SIN_PERIMETRO'
    );
    expect(consentimientoBorde).toBeDefined();
    expect(consentimientoBorde?.status).toBe('PENDIENTE');
    expect(consentimientoBorde?.severity).toBe('BLOCKING');
  });

  // Test 3: Consentimiento de clase con perimetro pero no resuelto → BLOCKING
  it('should flag BORDE_CONSENTIMIENTO_CLASE_NO_RESUELTO when perimetroClaseDefinido=true and consentimientoClaseResuelto=false', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SL',
      materias: ['REDUCCION_CAPITAL'],
      perimetroClaseDefinido: true,
      consentimientoClaseResuelto: false,
    };

    const result = evaluarBordesNoComputables(input);

    const consentimientoBorde = result.find(
      (r) => r.id === 'BORDE_CONSENTIMIENTO_CLASE_NO_RESUELTO'
    );
    expect(consentimientoBorde).toBeDefined();
    expect(consentimientoBorde?.status).toBe('PENDIENTE');
    expect(consentimientoBorde?.severity).toBe('BLOCKING');
  });

  // Test 4: Consentimiento de clase resuelto → RESUELTO
  it('should mark BORDE_CONSENTIMIENTO_CLASE_RESUELTO when perimetroClaseDefinido=true and consentimientoClaseResuelto=true', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SA',
      materias: ['AUMENTO_CAPITAL'],
      perimetroClaseDefinido: true,
      consentimientoClaseResuelto: true,
    };

    const result = evaluarBordesNoComputables(input);

    const consentimientoBorde = result.find(
      (r) => r.id === 'BORDE_CONSENTIMIENTO_CLASE_RESUELTO'
    );
    expect(consentimientoBorde).toBeDefined();
    expect(consentimientoBorde?.status).toBe('RESUELTO');
    expect(consentimientoBorde?.severity).toBe('INFO');
  });

  // Test 5: Liquidez no verificada con REPARTO_DIVIDENDOS → BLOCKING
  it('should flag BORDE_LIQUIDEZ_NO_VERIFICADA when REPARTO_DIVIDENDOS present and liquidezVerificada=false', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SA',
      materias: ['REPARTO_DIVIDENDOS'],
      liquidezVerificada: false,
    };

    const result = evaluarBordesNoComputables(input);

    const liquidezBorde = result.find(
      (r) => r.id === 'BORDE_LIQUIDEZ_NO_VERIFICADA'
    );
    expect(liquidezBorde).toBeDefined();
    expect(liquidezBorde?.status).toBe('PENDIENTE');
    expect(liquidezBorde?.severity).toBe('BLOCKING');
  });

  // Test 6: Liquidez verificada → RESUELTO
  it('should mark BORDE_LIQUIDEZ_VERIFICADA when REPARTO_DIVIDENDOS present and liquidezVerificada=true', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SL',
      materias: ['REPARTO_DIVIDENDOS'],
      liquidezVerificada: true,
    };

    const result = evaluarBordesNoComputables(input);

    const liquidezBorde = result.find((r) => r.id === 'BORDE_LIQUIDEZ_VERIFICADA');
    expect(liquidezBorde).toBeDefined();
    expect(liquidezBorde?.status).toBe('RESUELTO');
    expect(liquidezBorde?.severity).toBe('INFO');
  });

  // Test 7: Junta telemática sin checklist → BLOCKING
  it('should flag BORDE_JUNTA_TELEMATICA_SIN_CHECKLIST when JUNTA_GENERAL present and juntaTelematicaChecklist=false', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SA',
      materias: ['JUNTA_GENERAL'],
      juntaTelematicaChecklist: false,
    };

    const result = evaluarBordesNoComputables(input);

    const juntaBorde = result.find(
      (r) => r.id === 'BORDE_JUNTA_TELEMATICA_SIN_CHECKLIST'
    );
    expect(juntaBorde).toBeDefined();
    expect(juntaBorde?.status).toBe('PENDIENTE');
    expect(juntaBorde?.severity).toBe('BLOCKING');
  });

  // Test 8: Junta telemática con checklist → RESUELTO
  it('should mark BORDE_JUNTA_TELEMATICA_OK when JUNTA_GENERAL present and juntaTelematicaChecklist=true', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SL',
      materias: ['JUNTA_GENERAL_EXTRAORDINARIA'],
      juntaTelematicaChecklist: true,
    };

    const result = evaluarBordesNoComputables(input);

    const juntaBorde = result.find((r) => r.id === 'BORDE_JUNTA_TELEMATICA_OK');
    expect(juntaBorde).toBeDefined();
    expect(juntaBorde?.status).toBe('RESUELTO');
    expect(juntaBorde?.severity).toBe('INFO');
  });

  // Test 9: Publicación SA sin evidencia → WARNING
  it('should flag BORDE_PUBLICACION_SA_SIN_EVIDENCIA when SA with convocatoria and evidenciaPublicacionSA=false', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SA',
      materias: ['CONVOCATORIA_JUNTA'],
      evidenciaPublicacionSA: false,
    };

    const result = evaluarBordesNoComputables(input);

    const publicacionBorde = result.find(
      (r) => r.id === 'BORDE_PUBLICACION_SA_SIN_EVIDENCIA'
    );
    expect(publicacionBorde).toBeDefined();
    expect(publicacionBorde?.status).toBe('PENDIENTE');
    expect(publicacionBorde?.severity).toBe('WARNING');
  });

  // Test 10: Notificación SL sin evidencia → WARNING
  it('should flag BORDE_NOTIFICACION_SL_SIN_EVIDENCIA when SL with convocatoria and evidenciaNotificacionSL=false', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SL',
      materias: ['CONVOCATORIA_JUNTA'],
      evidenciaNotificacionSL: false,
    };

    const result = evaluarBordesNoComputables(input);

    const notificacionBorde = result.find(
      (r) => r.id === 'BORDE_NOTIFICACION_SL_SIN_EVIDENCIA'
    );
    expect(notificacionBorde).toBeDefined();
    expect(notificacionBorde?.status).toBe('PENDIENTE');
    expect(notificacionBorde?.severity).toBe('WARNING');
  });

  // Test 11: Entidad normal sin bordes aplicables → empty array
  it('should return empty array when no edges apply', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SA',
      materias: ['NOMBRAMIENTO_CESE_ADMIN'], // no class-impacting, no dividends, no convocation
    };

    const result = evaluarBordesNoComputables(input);

    expect(result).toHaveLength(0);
  });

  // Test 12: Indelegabilidad no verificada → WARNING
  it('should flag BORDE_INDELEGABILIDAD_NO_VERIFICADA when materias include risky items and indelegabilidadVerificada=false', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SL',
      materias: ['NOMBRAMIENTO_CESE_ADMIN'],
      indelegabilidadVerificada: false,
    };

    const result = evaluarBordesNoComputables(input);

    const indelegBorde = result.find(
      (r) => r.id === 'BORDE_INDELEGABILIDAD_NO_VERIFICADA'
    );
    expect(indelegBorde).toBeDefined();
    expect(indelegBorde?.status).toBe('PENDIENTE');
    expect(indelegBorde?.severity).toBe('WARNING');
  });

  // Test 13: Multiple bordes en el mismo input
  it('should return multiple applicable bordes in single call', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SA',
      materias: [
        'AUMENTO_CAPITAL', // clase-impactante
        'REPARTO_DIVIDENDOS', // liquidez
        'JUNTA_GENERAL', // junta telemática
        'CONVOCATORIA_JUNTA', // publicación
      ],
      perimetroClaseDefinido: false,
      liquidezVerificada: false,
      juntaTelematicaChecklist: false,
      evidenciaPublicacionSA: false,
    };

    const result = evaluarBordesNoComputables(input);

    expect(result.length).toBeGreaterThan(1);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('BORDE_CONSENTIMIENTO_CLASE_SIN_PERIMETRO');
    expect(ids).toContain('BORDE_LIQUIDEZ_NO_VERIFICADA');
    expect(ids).toContain('BORDE_JUNTA_TELEMATICA_SIN_CHECKLIST');
    expect(ids).toContain('BORDE_PUBLICACION_SA_SIN_EVIDENCIA');
  });

  // Test 14: Fusion/Transformacion materias también activan clase
  it('should recognize FUSION_SOCIEDAD and TRANSFORMACION_SOCIEDAD as class-impacting materias', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SA',
      materias: ['FUSION_SOCIEDAD'],
      perimetroClaseDefinido: false,
    };

    const result = evaluarBordesNoComputables(input);

    expect(
      result.some((r) => r.id === 'BORDE_CONSENTIMIENTO_CLASE_SIN_PERIMETRO')
    ).toBe(true);
  });

  // Test 15: Pure function check — deterministic output
  it('should produce deterministic output for same input', () => {
    const input: BordeInput = {
      esCotizada: false,
      tipoSocial: 'SL',
      materias: ['REPARTO_DIVIDENDOS'],
      liquidezVerificada: false,
    };

    const result1 = evaluarBordesNoComputables(input);
    const result2 = evaluarBordesNoComputables(input);

    expect(result1).toEqual(result2);
  });
});
