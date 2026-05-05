// ============================================================
// Tests — Orquestador Principal
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import {
  determinarAdoptionMode,
  componerPerfilSesion,
  evaluarAcuerdoCompleto,
} from '../orquestador';
import type {
  RulePack,
  ConvocatoriaInput,
  ConstitucionInput,
  VotacionInput,
  DocumentacionInput,
} from '../types';

// Mock RulePacks para tests
const mockPackOrdinaria: RulePack = {
  id: 'pack-ordinaria',
  materia: 'Aprobación de cuentas',
  clase: 'ORDINARIA',
  organoTipo: 'JUNTA_GENERAL',
  modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL', 'NO_SESSION'],
  convocatoria: {
    antelacionDias: { SA: { valor: 30, fuente: 'LEY' }, SL: { valor: 0, fuente: 'LEY' } },
    canales: { SA: ['BORME'], SL: ['PERSONALIZADA'] },
    contenidoMinimo: ['orden_del_dia'],
    documentosObligatorios: [{ id: 'DOC001', nombre: 'Balance' }],
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
      SA: { formula: 'favor > contra', fuente: 'LEY' },
      SL: { formula: 'favor > contra', fuente: 'LEY' },
      CONSEJO: { formula: 'mayoria_miembros', fuente: 'LEY' },
    },
    abstenciones: 'no_cuentan',
  },
  documentacion: {
    obligatoria: [{ id: 'DOC001', nombre: 'Balance' }],
  },
  acta: {
    tipoActaPorModo: {
      MEETING: 'ACTA_JUNTA',
      UNIVERSAL: 'ACTA_JUNTA',
      UNIPERSONAL_SOCIO: 'ACTA_CONSIGNACION_SOCIO',
      NO_SESSION: 'ACTA_ACUERDO_ESCRITO',
    },
    contenidoMinimo: {
      sesion: ['asistentes', 'orden_dia', 'votaciones', 'resultado'],
      consignacion: ['identidad_decisor', 'texto_decision', 'fecha', 'firma'],
      acuerdoEscrito: ['propuesta_texto', 'relacion_respuestas', 'snapshot_hash'],
    },
    requiereTranscripcionLibroActas: false,
    requiereConformidadConjunta: false,
  },
  plazosMateriales: {},
  postAcuerdo: {
    inscribible: false,
    instrumentoRequerido: 'NINGUNO',
    publicacionRequerida: false,
  },
};

const mockPackReforzada: RulePack = {
  ...mockPackOrdinaria,
  id: 'pack-reforzada',
  materia: 'Modificación de estatutos',
  clase: 'ESTATUTARIA',
  modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
  convocatoria: {
    ...mockPackOrdinaria.convocatoria,
    antelacionDias: { SA: { valor: 60, fuente: 'LEY' }, SL: { valor: 15, fuente: 'LEY' } },
  },
  constitucion: {
    quorum: {
      SA_1a: { valor: 0.5, fuente: 'LEY' },
      SA_2a: { valor: 0.25, fuente: 'LEY' },
      SL: { valor: 0.5, fuente: 'LEY' },
      CONSEJO: { valor: 'mayoria_miembros', fuente: 'LEY' },
    },
  },
};

const mockPackConsejo: RulePack = {
  ...mockPackOrdinaria,
  id: 'pack-consejo',
  organoTipo: 'CONSEJO',
  modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL', 'UNIPERSONAL_ADMIN'],
  constitucion: {
    quorum: {
      SA_1a: { valor: 0.25, fuente: 'LEY' },
      SA_2a: { valor: 0, fuente: 'LEY' },
      SL: { valor: 0, fuente: 'LEY' },
      CONSEJO: { valor: 'mayoria_miembros', fuente: 'LEY' },
    },
  },
};

describe('orquestador', () => {
  describe('determinarAdoptionMode', () => {
    // Test 1: Decisión socio único en Junta General
    it('should return UNIPERSONAL_SOCIO when esUnipersonal=true and organo=JUNTA_GENERAL', () => {
      const mode = determinarAdoptionMode(
        'ADMINISTRADOR_UNICO',
        'JUNTA_GENERAL',
        true // esUnipersonal
      );
      expect(mode).toBe('UNIPERSONAL_SOCIO');
    });

    // Test 2: Decisión admin único en Consejo
    it('should return UNIPERSONAL_ADMIN when forma=ADMINISTRADOR_UNICO and organo=CONSEJO', () => {
      const mode = determinarAdoptionMode(
        'ADMINISTRADOR_UNICO',
        'CONSEJO',
        false
      );
      expect(mode).toBe('UNIPERSONAL_ADMIN');
    });

    // Test 3: Modo solicitado válido
    it('should return modoSolicitado if valid and in permitted modes', () => {
      const mode = determinarAdoptionMode(
        'ADMINISTRADOR_UNICO',
        'JUNTA_GENERAL',
        false,
        'UNIVERSAL',
        ['MEETING', 'UNIVERSAL', 'NO_SESSION']
      );
      expect(mode).toBe('UNIVERSAL');
    });

    // Test 4: Modo solicitado no válido → default
    it('should return MEETING if modoSolicitado is not in permitted modes', () => {
      const mode = determinarAdoptionMode(
        'ADMINISTRADOR_UNICO',
        'JUNTA_GENERAL',
        false,
        'NO_SESSION',
        ['MEETING', 'UNIVERSAL'] // NO_SESSION no permitido
      );
      expect(mode).toBe('MEETING');
    });

    // Test 5: Default MEETING
    it('should return MEETING as default', () => {
      const mode = determinarAdoptionMode(
        'ADMINISTRADORES_SOLIDARIOS',
        'JUNTA_GENERAL',
        false
      );
      expect(mode).toBe('MEETING');
    });

    // Test 6: Admin mancomunado (no unipersonal)
    it('should return MEETING for mancomunados', () => {
      const mode = determinarAdoptionMode(
        'ADMINISTRADORES_MANCOMUNADOS',
        'CONSEJO',
        false
      );
      expect(mode).toBe('MEETING');
    });
  });

  describe('componerPerfilSesion', () => {
    // Test 7: Multi-materia: perfil más exigente
    it('should compose the most demanding profile from multiple packs', () => {
      const profile = componerPerfilSesion(
        [mockPackOrdinaria, mockPackReforzada],
        [],
        'SA'
      );

      // antelacionMax debe ser 60 (máximo entre 30 y 60)
      expect(profile.antelacionMax).toBe(60);
      // quorumMax debe ser 0.5 (máximo entre 0.25 y 0.5)
      expect(profile.quorumMax).toBe(0.5);
      // documentosUnion debe tener al menos 1 documento
      expect(profile.documentosUnion.length).toBeGreaterThanOrEqual(1);
    });

    // Test 8: Single materia
    it('should return profile for single pack', () => {
      const profile = componerPerfilSesion(
        [mockPackOrdinaria],
        [],
        'SA'
      );
      expect(profile.antelacionMax).toBe(30);
      expect(profile.quorumMax).toBe(0.25);
    });

    // Test 9: Override antelación
    it('should apply overrides to antelacion', () => {
      const profile = componerPerfilSesion(
        [mockPackOrdinaria],
        [
          {
            id: 'ovr-1',
            entity_id: 'ent-1',
            materia: 'Aprobación de cuentas',
            clave: 'antelacion_dias',
            valor: 45,
            fuente: 'ESTATUTOS',
          },
        ],
        'SA'
      );
      expect(profile.antelacionMax).toBe(45);
    });

    // Test 10: Override quórum
    it('should apply overrides to quorum', () => {
      const profile = componerPerfilSesion(
        [mockPackOrdinaria],
        [
          {
            id: 'ovr-1',
            entity_id: 'ent-1',
            materia: 'Aprobación de cuentas',
            clave: 'quorum',
            valor: 0.75,
            fuente: 'ESTATUTOS',
          },
        ],
        'SA'
      );
      expect(profile.quorumMax).toBe(0.75);
    });
  });

  describe('evaluarAcuerdoCompleto - Flow A (MEETING/UNIVERSAL)', () => {
    // Test 11: Flow A simple (1 materia ordinaria)
    it('should evaluate flow A (MEETING) with single ordinary matter', () => {
      const result = evaluarAcuerdoCompleto(
        'MEETING',
        [mockPackOrdinaria],
        [],
        {
          convocatoria: {
            tipoSocial: 'SA',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'MEETING',
            fechaJunta: '2026-05-15',
            esCotizada: false,
            webInscrita: false,
            primeraConvocatoria: true,
            esJuntaUniversal: false,
            materias: ['Aprobación de cuentas'],
          },
          constitucion: {
            tipoSocial: 'SA',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'MEETING',
            primeraConvocatoria: true,
            materiaClase: 'ORDINARIA',
            capitalConDerechoVoto: 100,
            capitalPresenteRepresentado: 30,
          },
          votacion: {
            tipoSocial: 'SA',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'MEETING',
            materiaClase: 'ORDINARIA',
            materias: ['Aprobación de cuentas'],
            votos: {
              favor: 25,
              contra: 5,
              abstenciones: 0,
              en_blanco: 0,
              capital_presente: 30,
              capital_total: 100,
            },
          },
          documentacion: {
            adoptionMode: 'MEETING',
            materias: ['Aprobación de cuentas'],
            documentosDisponibles: [{ id: 'DOC001' }],
            actaDatos: {
              tipoActa: 'ACTA_JUNTA',
              campos: {
                asistentes: true,
                orden_dia: true,
                votaciones: true,
                resultado: true,
              },
            },
          },
        }
      );

      expect(result.path).toBe('A');
      expect(result.etapas.length).toBe(4); // convocatoria, constitucion, votacion, documentacion
    });

    // Test 12: Flow A multi-materia (ordinaria + reforzada)
    it('should evaluate flow A with multiple matters (ordinary + reinforced)', () => {
      const result = evaluarAcuerdoCompleto(
        'MEETING',
        [mockPackOrdinaria, mockPackReforzada],
        [],
        {
          constitucion: {
            tipoSocial: 'SA',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'MEETING',
            primeraConvocatoria: true,
            materiaClase: 'ESTATUTARIA',
            capitalConDerechoVoto: 100,
            capitalPresenteRepresentado: 50, // 0.5 = 50% quórum reforzado
          },
          votacion: {
            tipoSocial: 'SA',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'MEETING',
            materiaClase: 'ESTATUTARIA',
            materias: ['Aprobación de cuentas', 'Modificación de estatutos'],
            votos: {
              favor: 45,
              contra: 5,
              abstenciones: 0,
              en_blanco: 0,
              capital_presente: 50,
              capital_total: 100,
            },
          },
        }
      );

      expect(result.path).toBe('A');
    });

    // Test 13: Flow A junta universal
    it('should evaluate flow A for junta universal', () => {
      const result = evaluarAcuerdoCompleto(
        'UNIVERSAL',
        [mockPackOrdinaria],
        [],
        {
          convocatoria: {
            tipoSocial: 'SA',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'UNIVERSAL',
            fechaJunta: '2026-05-15',
            esCotizada: false,
            webInscrita: false,
            primeraConvocatoria: true,
            esJuntaUniversal: true,
            materias: ['Aprobación de cuentas'],
          },
          constitucion: {
            tipoSocial: 'SA',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'UNIVERSAL',
            primeraConvocatoria: true,
            materiaClase: 'ORDINARIA',
            capitalConDerechoVoto: 100,
            capitalPresenteRepresentado: 100,
            esJuntaUniversal: true,
            aceptacionUnanimeCelebracion: true,
          },
          votacion: {
            tipoSocial: 'SA',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'UNIVERSAL',
            materiaClase: 'ORDINARIA',
            materias: ['Aprobación de cuentas'],
            votos: {
              favor: 70,
              contra: 5,
              abstenciones: 0,
              en_blanco: 0,
              capital_presente: 75,
              capital_total: 100,
            },
          },
        }
      );

      expect(result.path).toBe('A');
    });
  });

  describe('evaluarAcuerdoCompleto - Flow B (UNIPERSONAL)', () => {
    // Test 14: Flow B decisión socio único
    it('should evaluate flow B (UNIPERSONAL_SOCIO) with decision signed', () => {
      const result = evaluarAcuerdoCompleto(
        'UNIPERSONAL_SOCIO',
        [mockPackOrdinaria],
        [],
        {
          votacion: {
            tipoSocial: 'SA',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'UNIPERSONAL_SOCIO',
            materiaClase: 'ORDINARIA',
            materias: ['Aprobación de cuentas'],
            votos: {
              favor: 0,
              contra: 0,
              abstenciones: 0,
              en_blanco: 0,
              capital_presente: 0,
              capital_total: 0,
            },
            decisionFirmada: true,
          },
          documentacion: {
            adoptionMode: 'UNIPERSONAL_SOCIO',
            materias: ['Aprobación de cuentas'],
            documentosDisponibles: [{ id: 'DOC001' }],
            actaDatos: {
              tipoActa: 'ACTA_CONSIGNACION_SOCIO',
              campos: {
                identidad_decisor: true,
                texto_decision: true,
                fecha: true,
                firma: true,
              },
            },
          },
        }
      );

      expect(result.path).toBe('B');
      // Debe tener skip de convocatoria y constitución + votación + documentación
      expect(result.etapas.filter((e) => e.etapa.includes('skip'))).toHaveLength(2);
    });

    // Test 15: Flow B decisión admin único
    it('should evaluate flow B (UNIPERSONAL_ADMIN) correctly', () => {
      const result = evaluarAcuerdoCompleto(
        'UNIPERSONAL_ADMIN',
        [mockPackConsejo],
        [],
        {
          votacion: {
            tipoSocial: 'SA',
            organoTipo: 'CONSEJO',
            adoptionMode: 'UNIPERSONAL_ADMIN',
            materiaClase: 'ORDINARIA',
            materias: ['Aprobación de cuentas'],
            votos: {
              favor: 0,
              contra: 0,
              abstenciones: 0,
              en_blanco: 0,
              capital_presente: 0,
              capital_total: 0,
            },
            decisionFirmada: true,
          },
          documentacion: {
            adoptionMode: 'UNIPERSONAL_ADMIN',
            materias: ['Aprobación de cuentas'],
            documentosDisponibles: [{ id: 'DOC001' }],
            actaDatos: {
              tipoActa: 'ACTA_CONSIGNACION_ADMIN',
              campos: {
                identidad_decisor: true,
                texto_decision: true,
                fecha: true,
                firma: true,
              },
            },
          },
        }
      );

      expect(result.path).toBe('B');
    });

    // Test 16: Flow B admin mancomunado (requiere conformidad conjunta)
    it('should evaluate flow B with admin mancomunados', () => {
      const result = evaluarAcuerdoCompleto(
        'UNIPERSONAL_ADMIN',
        [mockPackConsejo],
        [],
        {
          votacion: {
            tipoSocial: 'SA',
            organoTipo: 'CONSEJO',
            adoptionMode: 'UNIPERSONAL_ADMIN',
            materiaClase: 'ORDINARIA',
            materias: ['Aprobación de cuentas'],
            votos: {
              favor: 0,
              contra: 0,
              abstenciones: 0,
              en_blanco: 0,
              capital_presente: 0,
              capital_total: 0,
            },
            decisionFirmada: false, // No firmada
          },
          documentacion: {
            adoptionMode: 'UNIPERSONAL_ADMIN',
            materias: ['Aprobación de cuentas'],
            documentosDisponibles: [{ id: 'DOC001' }],
          },
        }
      );

      expect(result.path).toBe('B');
    });
  });

  describe('evaluarAcuerdoCompleto - Flow C (NO_SESSION)', () => {
    // Test 17: Flow C unanimidad SL completa
    it('should evaluate flow C (NO_SESSION) with complete SL unanimity', () => {
      const result = evaluarAcuerdoCompleto(
        'NO_SESSION',
        [mockPackOrdinaria],
        [],
        {
          votacion: {
            tipoSocial: 'SL',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'NO_SESSION',
            materiaClase: 'ORDINARIA',
            materias: ['Aprobación de cuentas'],
            votos: {
              favor: 3,
              contra: 0,
              abstenciones: 0,
              en_blanco: 0,
              capital_presente: 100,
              capital_total: 100,
            },
            noSessionInput: {
              tipoProceso: 'UNANIMIDAD_ESCRITA_SL',
              condicionAdopcion: 'UNANIMIDAD_CAPITAL',
              organoTipo: 'JUNTA_GENERAL',
              tipoSocial: 'SL',
              respuestas: [
                {
                  person_id: 'p1',
                  capital_participacion: 50,
                  porcentaje_capital: 50,
                  es_consejero: false,
                  sentido: 'CONSENTIMIENTO',
                  firma_qes_ref: 'qes-1',
                },
                {
                  person_id: 'p2',
                  capital_participacion: 50,
                  porcentaje_capital: 50,
                  es_consejero: false,
                  sentido: 'CONSENTIMIENTO',
                  firma_qes_ref: 'qes-2',
                },
              ],
              notificaciones: [
                {
                  person_id: 'p1',
                  canal: 'NOTIFICACION_CERTIFICADA',
                  estado: 'ENTREGADA',
                },
                {
                  person_id: 'p2',
                  canal: 'NOTIFICACION_CERTIFICADA',
                  estado: 'ENTREGADA',
                },
              ],
              totalDestinatarios: 2,
              totalCapitalSocial: 100,
              ventana: {
                inicio: '2026-05-10',
                fin: '2026-05-17',
                ahora: '2026-05-15',
              },
              propuestaTexto: 'Aprobación de cuentas',
            },
          },
          documentacion: {
            adoptionMode: 'NO_SESSION',
            materias: ['Aprobación de cuentas'],
            documentosDisponibles: [{ id: 'DOC001' }],
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
          },
        }
      );

      expect(result.path).toBe('C');
      expect(result.etapas.filter((e) => e.etapa.includes('skip'))).toHaveLength(2);
    });

    // Test 18: Flow C circulación consejo aprobada
    it('should evaluate flow C (NO_SESSION) for consejo circulation', () => {
      const result = evaluarAcuerdoCompleto(
        'NO_SESSION',
        [mockPackConsejo],
        [],
        {
          votacion: {
            tipoSocial: 'SA',
            organoTipo: 'CONSEJO',
            adoptionMode: 'NO_SESSION',
            materiaClase: 'ORDINARIA',
            materias: ['Aprobación de cuentas'],
            votos: {
              favor: 5,
              contra: 0,
              abstenciones: 1,
              en_blanco: 0,
              capital_presente: 0,
              capital_total: 0,
              total_miembros: 6,
              miembros_presentes: 6,
            },
            noSessionInput: {
              tipoProceso: 'CIRCULACION_CONSEJO',
              condicionAdopcion: 'MAYORIA_CONSEJEROS_ESCRITA',
              organoTipo: 'CONSEJO',
              tipoSocial: 'SA',
              respuestas: [
                {
                  person_id: 'c1',
                  capital_participacion: 0,
                  porcentaje_capital: 0,
                  es_consejero: true,
                  sentido: 'CONSENTIMIENTO',
                  firma_qes_ref: 'qes-c1',
                },
              ],
              notificaciones: [
                {
                  person_id: 'c1',
                  canal: 'EMAIL_CON_ACUSE',
                  estado: 'ENTREGADA',
                },
              ],
              totalDestinatarios: 6,
              totalCapitalSocial: 0,
              ventana: {
                inicio: '2026-05-10',
                fin: '2026-05-17',
                ahora: '2026-05-15',
              },
              propuestaTexto: 'Aprobación de cuentas',
            },
          },
        }
      );

      expect(result.path).toBe('C');
    });

    // Test 19: Flow C circulación con objeción procedimiento → reconducción a sesión
    it('should evaluate flow C with procedimiento objection (reconduction needed)', () => {
      const result = evaluarAcuerdoCompleto(
        'NO_SESSION',
        [mockPackOrdinaria],
        [],
        {
          votacion: {
            tipoSocial: 'SL',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'NO_SESSION',
            materiaClase: 'ORDINARIA',
            materias: ['Aprobación de cuentas'],
            votos: {
              favor: 1,
              contra: 0,
              abstenciones: 0,
              en_blanco: 0,
              capital_presente: 50,
              capital_total: 100,
            },
            noSessionInput: {
              tipoProceso: 'UNANIMIDAD_ESCRITA_SL',
              condicionAdopcion: 'UNANIMIDAD_CAPITAL',
              organoTipo: 'JUNTA_GENERAL',
              tipoSocial: 'SL',
              respuestas: [
                {
                  person_id: 'p1',
                  capital_participacion: 50,
                  porcentaje_capital: 50,
                  es_consejero: false,
                  sentido: 'CONSENTIMIENTO',
                  firma_qes_ref: 'qes-1',
                },
                {
                  person_id: 'p2',
                  capital_participacion: 50,
                  porcentaje_capital: 50,
                  es_consejero: false,
                  sentido: 'OBJECION_PROCEDIMIENTO', // Objeción de procedimiento
                  firma_qes_ref: 'qes-2',
                },
              ],
              notificaciones: [],
              totalDestinatarios: 2,
              totalCapitalSocial: 100,
              ventana: {
                inicio: '2026-05-10',
                fin: '2026-05-17',
                ahora: '2026-05-15',
              },
              propuestaTexto: 'Aprobación de cuentas',
            },
          },
        }
      );

      expect(result.path).toBe('C');
      // Puede haber WARNING sobre reconducción (depende de evaluarProcesoSinSesion)
    });

    // Test 20: Flow C decisión socio único
    it('should evaluate flow C for single socio decision', () => {
      const result = evaluarAcuerdoCompleto(
        'NO_SESSION',
        [mockPackOrdinaria],
        [],
        {
          votacion: {
            tipoSocial: 'SL',
            organoTipo: 'JUNTA_GENERAL',
            adoptionMode: 'NO_SESSION',
            materiaClase: 'ORDINARIA',
            materias: ['Aprobación de cuentas'],
            votos: {
              favor: 1,
              contra: 0,
              abstenciones: 0,
              en_blanco: 0,
              capital_presente: 100,
              capital_total: 100,
            },
            noSessionInput: {
              tipoProceso: 'DECISION_SOCIO_UNICO_SL',
              condicionAdopcion: 'DECISION_UNICA',
              organoTipo: 'JUNTA_GENERAL',
              tipoSocial: 'SL',
              respuestas: [
                {
                  person_id: 'p1',
                  capital_participacion: 100,
                  porcentaje_capital: 100,
                  es_consejero: false,
                  sentido: 'CONSENTIMIENTO',
                  firma_qes_ref: 'qes-1',
                },
              ],
              notificaciones: [],
              totalDestinatarios: 1,
              totalCapitalSocial: 100,
              ventana: {
                inicio: '2026-05-10',
                fin: '2026-05-17',
                ahora: '2026-05-15',
              },
              propuestaTexto: 'Aprobación de cuentas',
            },
          },
        }
      );

      expect(result.path).toBe('C');
    });
  });

  describe('path indicator', () => {
    // Test 21: Path A correctly indicated
    it('should indicate path A in result', () => {
      const result = evaluarAcuerdoCompleto(
        'MEETING',
        [mockPackOrdinaria],
        [],
        {}
      );
      expect(result.path).toBe('A');
    });

    // Test 22: Path B correctly indicated
    it('should indicate path B in result', () => {
      const result = evaluarAcuerdoCompleto(
        'UNIPERSONAL_SOCIO',
        [mockPackOrdinaria],
        [],
        {}
      );
      expect(result.path).toBe('B');
    });

    // Test 23: Path C correctly indicated
    it('should indicate path C in result', () => {
      const result = evaluarAcuerdoCompleto(
        'NO_SESSION',
        [mockPackOrdinaria],
        [],
        {}
      );
      expect(result.path).toBe('C');
    });
  });

  describe('explain nodes', () => {
    // Test 24: Explain contiene path information
    it('should include path information in explain nodes', () => {
      const result = evaluarAcuerdoCompleto(
        'MEETING',
        [mockPackOrdinaria],
        [],
        {}
      );
      expect(result.explain.length).toBeGreaterThan(0);
      // Debe haber nodos skip que indican path A
      const skipNodes = result.explain.filter((n) =>
        n.regla.includes('skip')
      );
      // Para Flow A, no debería haber skip nodes inicialmente
    });
  });
});
