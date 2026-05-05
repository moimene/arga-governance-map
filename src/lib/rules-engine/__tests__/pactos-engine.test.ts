import { describe, it, expect } from 'vitest';
import { evaluarPactosParasociales } from '../pactos-engine';
import type { PactoParasocial, PactosEvalInput } from '../pactos-engine';

// ─── Factory helpers ─────────────────────────────────────────────────────────

function makeInput(overrides?: Partial<PactosEvalInput>): PactosEvalInput {
  return {
    materias: ['FUSION'],
    capitalPresente: 1000,
    capitalTotal: 1000,
    votosFavor: 800,
    votosContra: 200,
    consentimientosPrevios: [],
    vetoRenunciado: [],
    ...overrides,
  };
}

function makePactoVeto(overrides?: Partial<PactoParasocial>): PactoParasocial {
  return {
    id: 'veto-1',
    titulo: 'Veto Fundación ARGA',
    tipo_clausula: 'VETO',
    firmantes: [{ nombre: 'Fundación ARGA', tipo: 'SOCIO', capital_pct: 69.69 }],
    materias_aplicables: ['FUSION', 'ESCISION', 'DISOLUCION'],
    titular_veto: 'Fundación ARGA',
    estado: 'VIGENTE',
    ...overrides,
  };
}

function makePactoMayoria(overrides?: Partial<PactoParasocial>): PactoParasocial {
  return {
    id: 'mayoria-1',
    titulo: 'Mayoría Reforzada 75%',
    tipo_clausula: 'MAYORIA_REFORZADA_PACTADA',
    firmantes: [{ nombre: 'Fundación ARGA', tipo: 'SOCIO', capital_pct: 69.69 }],
    materias_aplicables: ['FUSION', 'VENTA_ACTIVOS'],
    umbral_activacion: 0.75,
    estado: 'VIGENTE',
    ...overrides,
  };
}

function makePactoConsentimiento(overrides?: Partial<PactoParasocial>): PactoParasocial {
  return {
    id: 'consentimiento-1',
    titulo: 'Consentimiento Inversor',
    tipo_clausula: 'CONSENTIMIENTO_INVERSOR',
    firmantes: [{ nombre: 'Fundación ARGA', tipo: 'SOCIO', capital_pct: 69.69 }],
    materias_aplicables: ['FUSION', 'ESCISION'],
    titular_veto: 'Fundación ARGA',
    capital_minimo_pct: 30,
    estado: 'VIGENTE',
    ...overrides,
  };
}

// ─── VETO ────────────────────────────────────────────────────────────────────

describe('evaluarPactosParasociales — VETO', () => {
  it('sin pactos → pacto_ok true, todo vacío', () => {
    const out = evaluarPactosParasociales([], makeInput());
    expect(out.pacto_ok).toBe(true);
    expect(out.pactos_evaluados).toBe(0);
    expect(out.blocking_issues).toHaveLength(0);
  });

  it('veto no aplica cuando la materia no coincide', () => {
    const pacto = makePactoVeto({ materias_aplicables: ['MOD_ESTATUTOS'] });
    const out = evaluarPactosParasociales([pacto], makeInput({ materias: ['DIVIDENDO'] }));
    expect(out.pacto_ok).toBe(true);
    const r = out.resultados[0];
    expect(r.aplica).toBe(false);
    expect(r.cumple).toBe(true);
  });

  it('veto activo y no renunciado → BLOCKING', () => {
    const pacto = makePactoVeto();
    const out = evaluarPactosParasociales([pacto], makeInput({ materias: ['FUSION'] }));
    expect(out.pacto_ok).toBe(false);
    expect(out.blocking_issues).toHaveLength(1);
    const r = out.resultados[0];
    expect(r.aplica).toBe(true);
    expect(r.cumple).toBe(false);
    expect(r.severity).toBe('BLOCKING');
  });

  it('veto renunciado → cumple OK', () => {
    const pacto = makePactoVeto();
    const out = evaluarPactosParasociales([pacto], makeInput({ vetoRenunciado: ['veto-1'] }));
    expect(out.pacto_ok).toBe(true);
    const r = out.resultados[0];
    expect(r.aplica).toBe(true);
    expect(r.cumple).toBe(true);
    expect(r.severity).toBe('OK');
  });

  it('pacto no VIGENTE se ignora', () => {
    const pacto = makePactoVeto({ estado: 'SUSPENDIDO' });
    const out = evaluarPactosParasociales([pacto], makeInput());
    expect(out.pactos_evaluados).toBe(0);
    expect(out.pacto_ok).toBe(true);
  });
});

// ─── MAYORIA_REFORZADA_PACTADA ────────────────────────────────────────────────

describe('evaluarPactosParasociales — MAYORIA_REFORZADA_PACTADA', () => {
  it('umbral alcanzado → OK', () => {
    const pacto = makePactoMayoria({ umbral_activacion: 0.75 });
    // 800/1000 = 80% ≥ 75%
    const out = evaluarPactosParasociales([pacto], makeInput({ votosFavor: 800, capitalPresente: 1000 }));
    expect(out.pacto_ok).toBe(true);
    const r = out.resultados[0];
    expect(r.cumple).toBe(true);
    expect(r.severity).toBe('OK');
  });

  it('umbral no alcanzado → BLOCKING', () => {
    const pacto = makePactoMayoria({ umbral_activacion: 0.85 });
    // 800/1000 = 80% < 85%
    const out = evaluarPactosParasociales([pacto], makeInput({ votosFavor: 800, capitalPresente: 1000 }));
    expect(out.pacto_ok).toBe(false);
    const r = out.resultados[0];
    expect(r.cumple).toBe(false);
    expect(r.severity).toBe('BLOCKING');
  });

  it('materia no aplica → no evalúa umbral', () => {
    const pacto = makePactoMayoria({ materias_aplicables: ['DISOLUCION'] });
    const out = evaluarPactosParasociales([pacto], makeInput({ materias: ['DIVIDENDO'] }));
    expect(out.pacto_ok).toBe(true);
    expect(out.resultados[0].aplica).toBe(false);
  });

  it('capitalPresente 0 → porcentaje 0, BLOCKING si umbral > 0', () => {
    const pacto = makePactoMayoria({ umbral_activacion: 0.75 });
    const out = evaluarPactosParasociales([pacto], makeInput({ capitalPresente: 0, votosFavor: 0 }));
    expect(out.pacto_ok).toBe(false);
    expect(out.resultados[0].explain.valor).toBe(0);
  });

  it('umbral exactamente igual al porcentaje → cumple', () => {
    const pacto = makePactoMayoria({ umbral_activacion: 0.8 });
    // 800/1000 = 0.8 exactamente
    const out = evaluarPactosParasociales([pacto], makeInput({ votosFavor: 800, capitalPresente: 1000 }));
    expect(out.pacto_ok).toBe(true);
  });
});

// ─── CONSENTIMIENTO_INVERSOR ──────────────────────────────────────────────────

describe('evaluarPactosParasociales — CONSENTIMIENTO_INVERSOR', () => {
  it('sin consentimiento → BLOCKING', () => {
    const pacto = makePactoConsentimiento();
    const out = evaluarPactosParasociales([pacto], makeInput({ consentimientosPrevios: [] }));
    expect(out.pacto_ok).toBe(false);
    const r = out.resultados[0];
    expect(r.cumple).toBe(false);
    expect(r.severity).toBe('BLOCKING');
  });

  it('con consentimiento previo → OK', () => {
    const pacto = makePactoConsentimiento();
    const out = evaluarPactosParasociales([pacto], makeInput({ consentimientosPrevios: ['consentimiento-1'] }));
    expect(out.pacto_ok).toBe(true);
    const r = out.resultados[0];
    expect(r.cumple).toBe(true);
    expect(r.aplica).toBe(true);
  });

  it('materia no aplica → no requiere consentimiento', () => {
    const pacto = makePactoConsentimiento({ materias_aplicables: ['VENTA_ACTIVOS'] });
    const out = evaluarPactosParasociales([pacto], makeInput({ materias: ['DIVIDENDO'] }));
    expect(out.pacto_ok).toBe(true);
    expect(out.resultados[0].aplica).toBe(false);
  });
});

// ─── Combinados ───────────────────────────────────────────────────────────────

describe('evaluarPactosParasociales — Combinados', () => {
  it('múltiples pactos: todos cumplen → pacto_ok true', () => {
    const veto = makePactoVeto({ materias_aplicables: ['ESCISION'] });          // no aplica (materia FUSION)
    const mayoria = makePactoMayoria({ umbral_activacion: 0.75 });              // 80% ≥ 75% OK
    const consentimiento = makePactoConsentimiento({ materias_aplicables: ['DISOLUCION'] }); // no aplica
    const out = evaluarPactosParasociales(
      [veto, mayoria, consentimiento],
      makeInput({ materias: ['FUSION'], votosFavor: 800, capitalPresente: 1000 })
    );
    expect(out.pacto_ok).toBe(true);
    expect(out.blocking_issues).toHaveLength(0);
    expect(out.pactos_evaluados).toBe(3);
  });

  it('múltiples pactos: uno falla → pacto_ok false, un blocking_issue', () => {
    const veto = makePactoVeto();   // aplica FUSION, no renunciado → BLOCKING
    const mayoria = makePactoMayoria({ materias_aplicables: ['DISOLUCION'] }); // no aplica
    const out = evaluarPactosParasociales([veto, mayoria], makeInput());
    expect(out.pacto_ok).toBe(false);
    expect(out.blocking_issues).toHaveLength(1);
    expect(out.pactos_incumplidos).toBe(1);
  });

  it('TAG_ALONG genera warning contractual sin bloquear la operación societaria', () => {
    const tagAlong: PactoParasocial = {
      id: 'tag-1',
      titulo: 'Tag Along',
      tipo_clausula: 'TAG_ALONG',
      firmantes: [],
      materias_aplicables: ['TRANSMISION_PARTICIPACIONES'],
      estado: 'VIGENTE',
    };
    const out = evaluarPactosParasociales(
      [tagAlong],
      makeInput({ materias: ['TRANSMISION_PARTICIPACIONES'] })
    );
    expect(out.pacto_ok).toBe(true);
    expect(out.resultados[0].aplica).toBe(true);
    expect(out.resultados[0].severity).toBe('WARNING');
    expect(out.blocking_issues).toHaveLength(0);
    expect(out.warnings[0]).toContain('PACTO ADVERTENCIA');
  });

  it('SINDICACION_VOTO genera warning si hay pacto activo, pero no invalida el acuerdo', () => {
    const sindicacion: PactoParasocial = {
      id: 'sind-1',
      titulo: 'Sindicación de voto Fundación ARGA',
      tipo_clausula: 'SINDICACION_VOTO',
      firmantes: [{ nombre: 'Fundación ARGA', tipo: 'SOCIO', capital_pct: 69.69 }],
      materias_aplicables: ['APROBACION_CUENTAS'],
      estado: 'VIGENTE',
    };

    const out = evaluarPactosParasociales(
      [sindicacion],
      makeInput({ materias: ['APROBACION_CUENTAS'], votosFavor: 300, votosContra: 700 })
    );

    expect(out.pacto_ok).toBe(true);
    expect(out.resultados[0].severity).toBe('WARNING');
    expect(out.pactos_incumplidos).toBe(0);
    expect(out.warnings[0]).toContain('sindicacion');
  });

  it('DRAG_ALONG en transmisión avisa sobre derechos contractuales sin bloquear', () => {
    const dragAlong: PactoParasocial = {
      id: 'drag-1',
      titulo: 'Drag Along ARGA',
      tipo_clausula: 'DRAG_ALONG',
      firmantes: [],
      materias_aplicables: ['TRANSMISION_PARTICIPACIONES'],
      estado: 'VIGENTE',
    };

    const out = evaluarPactosParasociales(
      [dragAlong],
      makeInput({ materias: ['TRANSMISION_PARTICIPACIONES'] })
    );

    expect(out.pacto_ok).toBe(true);
    expect(out.resultados[0].severity).toBe('WARNING');
    expect(out.blocking_issues).toHaveLength(0);
    expect(out.warnings[0]).toContain('arrastre');
  });

  it('blocking_issues usa formato exacto: PACTO INCUMPLIDO: <titulo> (<tipo>)', () => {
    const pacto = makePactoVeto();
    const out = evaluarPactosParasociales([pacto], makeInput());
    expect(out.blocking_issues[0]).toBe('PACTO INCUMPLIDO: Veto Fundación ARGA (VETO)');
  });
});
