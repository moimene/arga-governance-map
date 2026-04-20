// ============================================================
// Oleada 2 — Rule Pack Definitions Tests
// Verifica que los 13 modelos de acuerdo producen salidas correctas
// en evaluarMayoria y evaluarConstitucion.
// ============================================================

import { describe, it, expect } from 'vitest';
import { evaluarMayoria } from '../majority-evaluator';
import { evaluarConstitucion } from '../constitucion-engine';
import type { RulePack, MajoritySpec, VotosInput, ConstitucionInput } from '../types';

// ===== Helpers para construir RulePacks =====

function makePackOrdinario(materia: string, inscribible = false): RulePack {
  return {
    id: materia,
    materia,
    clase: 'ORDINARIA',
    organoTipo: 'JUNTA_GENERAL',
    modosAdopcionPermitidos: ['MEETING'],
    convocatoria: {
      antelacionDias: {
        SA: { valor: 15, fuente: 'LEY' },
        SL: { valor: 15, fuente: 'LEY' },
        SLU: { valor: 0, fuente: 'LEY' },
        SAU: { valor: 0, fuente: 'LEY' },
      },
      canales: { SA: ['BORME'], SL: ['NOTIFICACION'], SLU: [], SAU: [] },
      contenidoMinimo: [],
    },
    constitucion: {
      quorum: {
        SA_1a: { valor: 0.25, fuente: 'LEY', referencia: 'art. 189 LSC' },
        SA_2a: { valor: 0, fuente: 'LEY', referencia: 'art. 189 LSC' },
        SL: { valor: 0, fuente: 'LEY', referencia: 'art. 201 LSC' },
        CONSEJO: { valor: 'mayoria_miembros', fuente: 'LEY' },
      },
    },
    votacion: {
      mayoria: {
        SA: { formula: 'favor > contra', fuente: 'LEY', referencia: 'art. 201 LSC' },
        SL: { formula: 'favor > contra', fuente: 'LEY', referencia: 'art. 198 LSC' },
        CONSEJO: { formula: 'mayoria_consejeros', fuente: 'LEY' },
      },
      abstenciones: 'no_cuentan',
    },
    documentacion: { obligatoria: [] },
    acta: {
      tipoActaPorModo: {},
      contenidoMinimo: { sesion: [], consignacion: [], acuerdoEscrito: [] },
      requiereTranscripcionLibroActas: false,
      requiereConformidadConjunta: false,
    },
    plazosMateriales: {},
    postAcuerdo: {
      inscribible,
      instrumentoRequerido: inscribible ? 'ESCRITURA' : 'NINGUNO',
      publicacionRequerida: false,
    },
  };
}

function makePackEstatutario(materia: string): RulePack {
  return {
    ...makePackOrdinario(materia, true),
    clase: 'ESTATUTARIA',
    constitucion: {
      quorum: {
        SA_1a: { valor: 0.50, fuente: 'LEY', referencia: 'art. 194 LSC' },
        SA_2a: { valor: 0.25, fuente: 'LEY', referencia: 'art. 194 LSC' },
        SL: { valor: 0, fuente: 'LEY' },
        CONSEJO: { valor: 'mayoria_miembros', fuente: 'LEY' },
      },
    },
    votacion: {
      mayoria: {
        SA: { formula: 'favor >= 2/3_emitidos', fuente: 'LEY', referencia: 'art. 194 LSC' },
        SL: { formula: 'favor >= 2/3_emitidos', fuente: 'LEY', referencia: 'art. 199 LSC' },
        CONSEJO: { formula: 'mayoria_consejeros', fuente: 'LEY' },
      },
      abstenciones: 'no_cuentan',
    },
    postAcuerdo: {
      inscribible: true,
      instrumentoRequerido: 'ESCRITURA',
      publicacionRequerida: true,
    },
  };
}

function makePackConsejo(materia: string, inscribible = false): RulePack {
  return {
    ...makePackOrdinario(materia, inscribible),
    organoTipo: 'CONSEJO',
    modosAdopcionPermitidos: ['MEETING', 'NO_SESSION'],
  };
}

// ===== Helper para inputs de constitución =====

function makeConstitucionInput(
  tipoSocial: 'SA' | 'SL',
  primeraConvocatoria: boolean,
  materiaClase: 'ORDINARIA' | 'ESTATUTARIA' | 'ESTRUCTURAL',
  capitalTotal: number,
  capitalPresente: number
): ConstitucionInput {
  return {
    tipoSocial,
    organoTipo: 'JUNTA_GENERAL',
    adoptionMode: 'MEETING',
    primeraConvocatoria,
    materiaClase,
    capitalConDerechoVoto: capitalTotal,
    capitalPresenteRepresentado: capitalPresente,
  };
}

// ===== Helper para votos simples =====

function makeVotos(favor: number, contra: number, abstenciones = 0, en_blanco = 0): VotosInput {
  return {
    favor,
    contra,
    abstenciones,
    en_blanco,
    capital_presente: favor + contra + abstenciones + en_blanco,
    capital_total: favor + contra + abstenciones + en_blanco,
  };
}

// ============================================================
// MODIFICACION_ESTATUTOS — ESTATUTARIA — 2/3 mayoría, 50%/25% quórum
// ============================================================

describe('MODIFICACION_ESTATUTOS', () => {
  const pack = makePackEstatutario('MODIFICACION_ESTATUTOS');
  const spec: MajoritySpec = pack.votacion.mayoria['SA'];

  it('mayoría 2/3: 55 votos de 100 NO alcanza', () => {
    const votos = makeVotos(55, 45);
    const result = evaluarMayoria(spec, votos, 'no_cuentan');
    expect(result.alcanzada).toBe(false);
  });

  it('mayoría 2/3: 67 votos de 100 SÍ alcanza', () => {
    const votos = makeVotos(67, 33);
    const result = evaluarMayoria(spec, votos, 'no_cuentan');
    expect(result.alcanzada).toBe(true);
  });

  it('quórum estatutario SA 1ª conv: 49% NO constituye', () => {
    const input = makeConstitucionInput('SA', true, 'ESTATUTARIA', 100, 49);
    const result = evaluarConstitucion(input, [pack]);
    expect(result.ok).toBe(false);
    expect(result.quorumCubierto).toBe(false);
  });

  it('quórum estatutario SA 1ª conv: 51% SÍ constituye', () => {
    const input = makeConstitucionInput('SA', true, 'ESTATUTARIA', 100, 51);
    const result = evaluarConstitucion(input, [pack]);
    expect(result.ok).toBe(true);
    expect(result.quorumCubierto).toBe(true);
  });
});

// ============================================================
// APROBACION_CUENTAS — ORDINARIA — mayoría simple, 25%/0% quórum
// ============================================================

describe('APROBACION_CUENTAS', () => {
  const pack = makePackOrdinario('APROBACION_CUENTAS', false);

  it('quórum ordinario SA 1ª conv: 24% NO constituye', () => {
    const input = makeConstitucionInput('SA', true, 'ORDINARIA', 100, 24);
    const result = evaluarConstitucion(input, [pack]);
    expect(result.ok).toBe(false);
    expect(result.quorumCubierto).toBe(false);
  });

  it('quórum ordinario SA 1ª conv: 26% SÍ constituye', () => {
    const input = makeConstitucionInput('SA', true, 'ORDINARIA', 100, 26);
    const result = evaluarConstitucion(input, [pack]);
    expect(result.ok).toBe(true);
    expect(result.quorumCubierto).toBe(true);
  });
});

// ============================================================
// DISTRIBUCION_DIVIDENDOS — ORDINARIA — mayoría simple
// ============================================================

describe('DISTRIBUCION_DIVIDENDOS', () => {
  const pack = makePackOrdinario('DISTRIBUCION_DIVIDENDOS', false);
  const spec: MajoritySpec = pack.votacion.mayoria['SA'];

  it('mayoría simple: favor=10 contra=10 NO alcanza (empate)', () => {
    const votos = makeVotos(10, 10);
    const result = evaluarMayoria(spec, votos, 'no_cuentan');
    expect(result.alcanzada).toBe(false);
  });

  it('mayoría simple: favor=11 contra=10 SÍ alcanza', () => {
    const votos = makeVotos(11, 10);
    const result = evaluarMayoria(spec, votos, 'no_cuentan');
    expect(result.alcanzada).toBe(true);
  });
});

// ============================================================
// NOMBRAMIENTO_CONSEJERO — ORDINARIA — inscribible
// ============================================================

describe('NOMBRAMIENTO_CONSEJERO', () => {
  const pack = makePackOrdinario('NOMBRAMIENTO_CONSEJERO', true);

  it('inscribible: true', () => {
    expect(pack.postAcuerdo.inscribible).toBe(true);
  });

  it('quórum ordinario SA 2ª conv: 1% SÍ constituye (sin mínimo en 2ª)', () => {
    const input = makeConstitucionInput('SA', false, 'ORDINARIA', 100, 1);
    const result = evaluarConstitucion(input, [pack]);
    expect(result.ok).toBe(true);
    expect(result.quorumRequerido).toBe(0);
  });
});

// ============================================================
// CESE_CONSEJERO — ORDINARIA — inscribible + mayoría simple
// ============================================================

describe('CESE_CONSEJERO', () => {
  const pack = makePackOrdinario('CESE_CONSEJERO', true);
  const spec: MajoritySpec = pack.votacion.mayoria['SA'];

  it('inscribible: true', () => {
    expect(pack.postAcuerdo.inscribible).toBe(true);
  });

  it('mayoría simple: favor=50 contra=49 SÍ alcanza', () => {
    const votos = makeVotos(50, 49);
    const result = evaluarMayoria(spec, votos, 'no_cuentan');
    expect(result.alcanzada).toBe(true);
  });
});

// ============================================================
// DELEGACION_FACULTADES — CONSEJO — organoTipo + inscribible
// ============================================================

describe('DELEGACION_FACULTADES', () => {
  const pack = makePackConsejo('DELEGACION_FACULTADES', true);

  it('organoTipo es CONSEJO', () => {
    expect(pack.organoTipo).toBe('CONSEJO');
  });

  it('inscribible: true', () => {
    expect(pack.postAcuerdo.inscribible).toBe(true);
  });
});

// ============================================================
// AUMENTO_CAPITAL — ESTATUTARIA — 2/3 mayoría, 25% quórum SA 2ª
// ============================================================

describe('AUMENTO_CAPITAL', () => {
  const pack = makePackEstatutario('AUMENTO_CAPITAL');
  const spec: MajoritySpec = pack.votacion.mayoria['SA'];

  it('mayoría 2/3: 66 votos de 100 NO alcanza (66 < 66.67)', () => {
    // emitidos = 66 + 34 = 100; requerido = 2/3 * 100 = 66.666...
    const votos = makeVotos(66, 34);
    const result = evaluarMayoria(spec, votos, 'no_cuentan');
    expect(result.alcanzada).toBe(false);
  });

  it('quórum estatutario SA 2ª conv: 26% SÍ constituye (mínimo 25%)', () => {
    const input = makeConstitucionInput('SA', false, 'ESTATUTARIA', 100, 26);
    const result = evaluarConstitucion(input, [pack]);
    expect(result.ok).toBe(true);
    expect(result.quorumRequerido).toBe(0.25);
  });
});

// ============================================================
// REDUCCION_CAPITAL — ESTATUTARIA — 2/3 mayoría, 25% quórum SA 2ª
// ============================================================

describe('REDUCCION_CAPITAL', () => {
  const pack = makePackEstatutario('REDUCCION_CAPITAL');
  const spec: MajoritySpec = pack.votacion.mayoria['SA'];

  it('mayoría 2/3: 67 votos de 100 SÍ alcanza', () => {
    const votos = makeVotos(67, 33);
    const result = evaluarMayoria(spec, votos, 'no_cuentan');
    expect(result.alcanzada).toBe(true);
  });

  it('quórum estatutario SA 2ª conv: 24% NO constituye (mínimo 25%)', () => {
    const input = makeConstitucionInput('SA', false, 'ESTATUTARIA', 100, 24);
    const result = evaluarConstitucion(input, [pack]);
    expect(result.ok).toBe(false);
    expect(result.quorumCubierto).toBe(false);
  });
});

// ============================================================
// OPERACION_VINCULADA — ORDINARIA — abstenciones como contra
// ============================================================

describe('OPERACION_VINCULADA', () => {
  const packBase = makePackOrdinario('OPERACION_VINCULADA', false);
  const pack: RulePack = {
    ...packBase,
    votacion: {
      ...packBase.votacion,
      abstenciones: 'cuentan_como_contra',
    },
  };
  const spec: MajoritySpec = pack.votacion.mayoria['SA'];

  it('abstenciones: cuentan_como_contra', () => {
    expect(pack.votacion.abstenciones).toBe('cuentan_como_contra');
  });

  it('mayoría simple SA: 51 favor 49 contra SÍ alcanza', () => {
    const votos = makeVotos(51, 49);
    const result = evaluarMayoria(spec, votos, pack.votacion.abstenciones);
    expect(result.alcanzada).toBe(true);
  });
});

// ============================================================
// NOMBRAMIENTO_AUDITOR — ORDINARIA — inscribible + boundary quórum
// ============================================================

describe('NOMBRAMIENTO_AUDITOR', () => {
  const pack = makePackOrdinario('NOMBRAMIENTO_AUDITOR', true);

  it('inscribible: true', () => {
    expect(pack.postAcuerdo.inscribible).toBe(true);
  });

  it('quórum ordinario SA 1ª conv: 25% exacto SÍ constituye (frontera)', () => {
    // capitalConDerechoVoto = 100, capitalPresenteRepresentado = 25 → 25% = 25/100 = 0.25 exacto
    const input = makeConstitucionInput('SA', true, 'ORDINARIA', 100, 25);
    const result = evaluarConstitucion(input, [pack]);
    expect(result.ok).toBe(true);
    expect(result.quorumCubierto).toBe(true);
  });
});

// ============================================================
// APROBACION_PLAN_NEGOCIO — CONSEJO — organoTipo + no inscribible
// ============================================================

describe('APROBACION_PLAN_NEGOCIO', () => {
  const pack = makePackConsejo('APROBACION_PLAN_NEGOCIO', false);

  it('organoTipo es CONSEJO', () => {
    expect(pack.organoTipo).toBe('CONSEJO');
  });

  it('inscribible: false', () => {
    expect(pack.postAcuerdo.inscribible).toBe(false);
  });
});

// ============================================================
// AUTORIZACION_GARANTIA — ORDINARIA — mayoría simple
// ============================================================

describe('AUTORIZACION_GARANTIA', () => {
  const pack = makePackOrdinario('AUTORIZACION_GARANTIA', false);
  const spec: MajoritySpec = pack.votacion.mayoria['SA'];

  it('mayoría simple SA: 26 favor 24 contra SÍ alcanza', () => {
    const votos = makeVotos(26, 24);
    const result = evaluarMayoria(spec, votos, 'no_cuentan');
    expect(result.alcanzada).toBe(true);
  });
});

// ============================================================
// RATIFICACION_ACTOS — ORDINARIA — quórum SA 1ª conv
// ============================================================

describe('RATIFICACION_ACTOS', () => {
  const pack = makePackOrdinario('RATIFICACION_ACTOS', false);

  it('quórum SA 1ª conv: 25% exacto SÍ constituye', () => {
    const input = makeConstitucionInput('SA', true, 'ORDINARIA', 100, 25);
    const result = evaluarConstitucion(input, [pack]);
    expect(result.ok).toBe(true);
    expect(result.quorumCubierto).toBe(true);
  });
});
