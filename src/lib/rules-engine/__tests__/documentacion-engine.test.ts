// ============================================================
// Tests — Motor de Documentación
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  evaluarDocumentacion,
  evaluarActa,
} from '../documentacion-engine';
import type {
  DocumentacionInput,
  RulePack,
  TipoActa,
} from '../types';

// Mock RulePack para tests
const mockPackOrdinaria: RulePack = {
  id: 'pack-ordinaria',
  materia: 'Aprobación de cuentas',
  clase: 'ORDINARIA',
  organoTipo: 'JUNTA_GENERAL',
  modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL', 'NO_SESSION'],
  convocatoria: {
    antelacionDias: { SA: { valor: 30, fuente: 'LEY' }, SL: { valor: 0, fuente: 'LEY' } },
    canales: { SA: ['BORME'], SL: ['PERSONALIZADA'] },
    contenidoMinimo: ['orden_del_dia', 'balance'],
    documentosObligatorios: [
      { id: 'DOC001', nombre: 'Balance de cuentas' },
      { id: 'DOC002', nombre: 'Informe de auditoría', condicion: 'si_auditada' },
      { id: 'DOC003', nombre: 'Estado de cambios en el patrimonio neto' },
    ],
  },
  constitucion: {
    quorum: {
      SA_1a: { valor: 0.25, fuente: 'LEY' },
      SA_2a: { valor: 0, fuente: 'LEY' },
      SL: { valor: 0, fuente: 'LEY' },
      CONSEJO: { valor: 'mayoria_miembros', fuente: 'LEY' },
    },
  },
  votacion: {
    mayoria: {
      SA: {
        formula: 'favor > contra',
        fuente: 'LEY',
      },
      SL: {
        formula: 'favor > contra',
        fuente: 'LEY',
      },
      CONSEJO: {
        formula: 'mayoria_miembros',
        fuente: 'LEY',
      },
    },
    abstenciones: 'no_cuentan',
  },
  documentacion: {
    obligatoria: [
      { id: 'DOC001', nombre: 'Balance de cuentas' },
      { id: 'DOC002', nombre: 'Informe de auditoría', condicion: 'si_auditada' },
      { id: 'DOC003', nombre: 'Estado de cambios en el patrimonio neto' },
    ],
    ventanaDisponibilidad: { dias: 5, fuente: 'LEY' },
  },
  acta: {
    tipoActaPorModo: {
      MEETING: 'ACTA_JUNTA',
      UNIVERSAL: 'ACTA_JUNTA',
      NO_SESSION: 'ACTA_ACUERDO_ESCRITO',
      UNIPERSONAL_SOCIO: 'ACTA_CONSIGNACION_SOCIO',
      UNIPERSONAL_ADMIN: 'ACTA_CONSIGNACION_ADMIN',
    },
    contenidoMinimo: {
      sesion: ['asistentes', 'orden_dia', 'deliberaciones', 'votaciones', 'resultado'],
      consignacion: ['identidad_decisor', 'texto_decision', 'fecha', 'firma'],
      acuerdoEscrito: [
        'propuesta_texto',
        'relacion_respuestas',
        'sentido_cada_socio',
        'capital_participacion',
        'firma_qes_ref',
        'resultado_evaluacion',
        'condicion_adopcion',
        'fecha_cierre',
        'ventana_inicio',
        'ventana_fin',
        'notificaciones_certificadas',
        'snapshot_hash',
      ],
    },
    requiereTranscripcionLibroActas: true,
    requiereConformidadConjunta: false,
  },
  plazosMateriales: {},
  postAcuerdo: {
    inscribible: false,
    instrumentoRequerido: 'NINGUNO',
    publicacionRequerida: false,
  },
};

const mockPackMancomunado: RulePack = {
  ...mockPackOrdinaria,
  id: 'pack-mancomunado',
  acta: {
    ...mockPackOrdinaria.acta,
    requiereConformidadConjunta: true,
  },
};

describe('documentacion-engine', () => {
  // Test 1: Todos los documentos disponibles
  it('should return OK when all required documents are available', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'MEETING',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001', disponible_desde: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'DOC003', disponible_desde: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
      ],
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.ok).toBe(true);
    expect(result.severity).toBe('OK');
    expect(result.documentosFaltantes).toHaveLength(0);
  });

  // Test 2: Documento obligatorio faltante
  it('should return BLOCKING when a required document is missing', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'MEETING',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001', disponible_desde: new Date().toISOString() },
        // DOC003 faltante
      ],
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.ok).toBe(false);
    expect(result.severity).toBe('BLOCKING');
    expect(result.documentosFaltantes).toContainEqual({
      id: 'DOC003',
      nombre: 'Estado de cambios en el patrimonio neto',
    });
    expect(result.blocking_issues.length).toBeGreaterThan(0);
  });

  // Test 3: Documento condicional no requerido
  it('should skip conditional documents when condition does not apply', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'MEETING',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001', disponible_desde: new Date().toISOString() },
        { id: 'DOC003', disponible_desde: new Date().toISOString() },
        // DOC002 (si_auditada) no incluido deliberadamente
      ],
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.ok).toBe(true);
    expect(result.documentosFaltantes).not.toContainEqual({ id: 'DOC002', nombre: expect.any(String) });
  });

  // Test 4: Multi-materia: unión de documentos
  it('should union documents from multiple packs', () => {
    const mockPackEstructural: RulePack = {
      ...mockPackOrdinaria,
      id: 'pack-estructural',
      materia: 'Modificación de estatutos',
      clase: 'ESTRUCTURAL',
      documentacion: {
        obligatoria: [
          { id: 'DOC004', nombre: 'Proyecto de modificación' },
          { id: 'DOC005', nombre: 'Certificado de depósito' },
        ],
        ventanaDisponibilidad: { dias: 5, fuente: 'LEY' },
      },
    };

    const input: DocumentacionInput = {
      adoptionMode: 'MEETING',
      materias: ['Aprobación de cuentas', 'Modificación de estatutos'],
      documentosDisponibles: [
        { id: 'DOC001', disponible_desde: new Date().toISOString() },
        { id: 'DOC003', disponible_desde: new Date().toISOString() },
        { id: 'DOC004', disponible_desde: new Date().toISOString() },
        { id: 'DOC005', disponible_desde: new Date().toISOString() },
      ],
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria, mockPackEstructural]);
    expect(result.ok).toBe(true);
    expect(result.documentosFaltantes).toHaveLength(0);
  });

  // Test 5: Validación de ventana de disponibilidad
  it('should warn when document is outside availability window', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'MEETING',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001', disponible_desde: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }, // Hace 2 días, ventana es 5 días
        { id: 'DOC003', disponible_desde: new Date().toISOString() },
      ],
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.severity).toBe('WARNING');
  });

  // Test 6: Acta sesión: todos los campos presentes
  it('should validate acta sesion with all required fields present', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'MEETING',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001' },
        { id: 'DOC003' },
      ],
      actaDatos: {
        tipoActa: 'ACTA_JUNTA',
        campos: {
          asistentes: true,
          orden_dia: true,
          deliberaciones: true,
          votaciones: true,
          resultado: true,
        },
        transcripcionRealizada: true,
        conformidadConjuntaObtenida: false,
      },
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.actaValida).toBe(true);
    expect(result.ok).toBe(true);
  });

  // Test 7: Acta sesión: campo faltante
  it('should fail when acta sesion has missing required fields', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'MEETING',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001' },
        { id: 'DOC003' },
      ],
      actaDatos: {
        tipoActa: 'ACTA_JUNTA',
        campos: {
          asistentes: true,
          orden_dia: false, // Faltante
          deliberaciones: true,
          votaciones: true,
          resultado: true,
        },
      },
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.actaValida).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.blocking_issues.length).toBeGreaterThan(0);
  });

  // Test 8: Acta consignación: todos los campos
  it('should validate acta consignacion with all required fields', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'UNIPERSONAL_SOCIO',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001' },
        { id: 'DOC003' },
      ],
      actaDatos: {
        tipoActa: 'ACTA_CONSIGNACION_SOCIO',
        campos: {
          identidad_decisor: true,
          texto_decision: true,
          fecha: true,
          firma: true,
        },
      },
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.actaValida).toBe(true);
  });

  // Test 9: Acta consignación: campo faltante
  it('should fail when acta consignacion has missing required fields', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'UNIPERSONAL_SOCIO',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001' },
        { id: 'DOC003' },
      ],
      actaDatos: {
        tipoActa: 'ACTA_CONSIGNACION_SOCIO',
        campos: {
          identidad_decisor: true,
          texto_decision: false, // Faltante
          fecha: true,
          firma: true,
        },
      },
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.actaValida).toBe(false);
    expect(result.blocking_issues.length).toBeGreaterThan(0);
  });

  // Test 10: Acta acuerdo escrito (NO_SESSION): completa
  it('should validate acta acuerdo escrito with all required fields', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'NO_SESSION',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001' },
        { id: 'DOC003' },
      ],
      actaDatos: {
        tipoActa: 'ACTA_ACUERDO_ESCRITO',
        campos: {
          propuesta_texto: true,
          relacion_respuestas: true,
          sentido_cada_socio: true,
          capital_participacion: true,
          firma_qes_ref: true,
          resultado_evaluacion: true,
          condicion_adopcion: true,
          fecha_cierre: true,
          ventana_inicio: true,
          ventana_fin: true,
          notificaciones_certificadas: true,
          snapshot_hash: true,
        },
      },
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.actaValida).toBe(true);
  });

  // Test 11: Transcripción libro requerida pero no realizada → WARNING
  it('should warn when transcripcion libro is required but not done', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'MEETING',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001' },
        { id: 'DOC003' },
      ],
      actaDatos: {
        tipoActa: 'ACTA_JUNTA',
        campos: {
          asistentes: true,
          orden_dia: true,
          deliberaciones: true,
          votaciones: true,
          resultado: true,
        },
        transcripcionRealizada: false, // No realizada pero requerida
        conformidadConjuntaObtenida: false,
      },
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('transcripción');
  });

  // Test 12: Conformidad conjunta requerida pero no obtenida → BLOCKING
  it('should fail when conformidad conjunta is required but not obtained', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'MEETING',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001' },
        { id: 'DOC003' },
      ],
      actaDatos: {
        tipoActa: 'ACTA_JUNTA',
        campos: {
          asistentes: true,
          orden_dia: true,
          deliberaciones: true,
          votaciones: true,
          resultado: true,
        },
        transcripcionRealizada: true,
        conformidadConjuntaObtenida: false, // Requerida pero no obtenida
      },
    };

    const result = evaluarDocumentacion(input, [mockPackMancomunado]);
    expect(result.ok).toBe(false);
    expect(result.actaValida).toBe(false);
    expect(result.blocking_issues.length).toBeGreaterThan(0);
  });

  // Test 13: Tipo acta incorrecto para modo
  it('should fail when acta type does not match adoption mode', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'MEETING',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [
        { id: 'DOC001' },
        { id: 'DOC003' },
      ],
      actaDatos: {
        tipoActa: 'ACTA_CONSIGNACION_SOCIO', // Incorrecto para MEETING
        campos: {
          asistentes: true,
          orden_dia: true,
          deliberaciones: true,
          votaciones: true,
          resultado: true,
        },
      },
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.ok).toBe(false);
    expect(result.actaValida).toBe(false);
    expect(result.blocking_issues.length).toBeGreaterThan(0);
  });

  // Test 14: evaluarActa función standalone
  it('should evaluate acta standalone function correctly', () => {
    const campos = {
      asistentes: true,
      orden_dia: true,
      deliberaciones: true,
      votaciones: true,
      resultado: true,
    };

    const result = evaluarActa('ACTA_JUNTA', 'MEETING', campos, mockPackOrdinaria);
    expect(result.valida).toBe(true);
    expect(result.blocking).toHaveLength(0);
  });

  // Test 15: evaluarActa con tipo incorrecto
  it('should fail in evaluarActa when type is incorrect', () => {
    const campos = {
      asistentes: true,
      orden_dia: true,
      deliberaciones: true,
      votaciones: true,
      resultado: true,
    };

    const result = evaluarActa('ACTA_CONSIGNACION_SOCIO', 'MEETING', campos, mockPackOrdinaria);
    expect(result.valida).toBe(false);
    expect(result.blocking.length).toBeGreaterThan(0);
  });

  // Test 16: Múltiples documentos faltantes
  it('should list all missing documents in one evaluation', () => {
    const input: DocumentacionInput = {
      adoptionMode: 'MEETING',
      materias: ['Aprobación de cuentas'],
      documentosDisponibles: [], // Ninguno disponible
    };

    const result = evaluarDocumentacion(input, [mockPackOrdinaria]);
    expect(result.documentosFaltantes.length).toBeGreaterThan(1);
    expect(result.severity).toBe('BLOCKING');
  });
});
