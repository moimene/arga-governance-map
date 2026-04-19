#!/usr/bin/env bun

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hzqwefkwsxopwrmtksbg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

interface RulePackPayload {
  id: string;
  materia: string;
  clase: 'ORDINARIA' | 'ESTATUTARIA' | 'ESTRUCTURAL';
  organoTipo: 'JUNTA_GENERAL' | 'CONSEJO';
  modosAdopcionPermitidos: string[];
  convocatoria: {
    antelacionDias: {
      SA: { valor: number; fuente: string };
      SL: { valor: number; fuente: string };
    };
    canales: { SA: string[]; SL: string[] };
    contenidoMinimo: string[];
  };
  constitucion: {
    quorum: {
      SA_1a?: { valor: number; fuente: string };
      SA_2a?: { valor: number; fuente: string };
      SL?: { valor: number; fuente: string };
      CONSEJO?: { valor: string; fuente: string };
    };
  };
  votacion: {
    mayoria: {
      SA?: { formula: string; fuente: string; dobleCondicional?: { umbral: number; mayoriaAlternativa: string } };
      SL?: { formula: string; fuente: string };
      CONSEJO?: { formula: string; fuente: string };
    };
    unanimidad?: { requerida: boolean; ambito: string; fuente: string };
    abstenciones: string;
  };
  documentacion: {
    obligatoria: Array<{ id: string; nombre: string; condicion?: string }>;
  };
  acta: {
    tipoActaPorModo: Record<string, string>;
    contenidoMinimo: {
      sesion: string[];
      consignacion: string[];
      acuerdoEscrito: string[];
    };
    requiereTranscripcionLibroActas: boolean;
    requiereConformidadConjunta: boolean;
  };
  noSession?: {
    habilitado_por_estatutos: { valor: boolean; fuente: string };
    habilitado_por_reglamento: { valor: boolean; fuente: string };
    condicion_junta_sl: string;
    condicion_consejo: string;
    ventana_minima_dias: { valor: number; fuente: string };
    ventana_fuente: string;
    canal_requerido_junta_sl: { valor: string[]; fuente: string };
    canal_requerido_consejo: { valor: string[]; fuente: string };
    silencio_equivale_a: string;
    cierre_anticipado: boolean;
    contenido_minimo_propuesta: string[];
  };
  plazosMateriales: {
    inscripcion?: { plazo_dias: number; fuente: string };
    publicacion?: string[];
    oposicion_acreedores?: { plazo_dias: number; fuente: string };
  };
  postAcuerdo: {
    inscribible: boolean;
    instrumentoRequerido: 'ESCRITURA' | 'INSTANCIA' | 'NINGUNO';
    publicacionRequerida: boolean;
    plazoInscripcion?: { dias: number; fuente: string };
  };
}

// Helper functions to reduce repetition

function createConvocatoriaStandard() {
  return {
    antelacionDias: {
      SA: { valor: 30, fuente: 'art. 176.1 LSC' },
      SL: { valor: 15, fuente: 'art. 176.2 LSC' },
    },
    canales: {
      SA: ['BORME', 'DIARIO', 'WEB_SOCIEDAD'],
      SL: ['COMUNICACION_INDIVIDUAL'],
    },
    contenidoMinimo: [
      'denominacion_social',
      'fecha_hora_lugar',
      'orden_dia',
      'derecho_informacion',
    ],
  };
}

function createActaStandard() {
  return {
    tipoActaPorModo: {
      MEETING: 'ACTA_JUNTA',
      UNIVERSAL: 'ACTA_JUNTA',
      UNIPERSONAL_SOCIO: 'ACTA_CONSIGNACION_SOCIO',
      UNIPERSONAL_ADMIN: 'ACTA_CONSIGNACION_ADMIN',
      NO_SESSION: 'ACTA_ACUERDO_ESCRITO',
    },
    contenidoMinimo: {
      sesion: [
        'asistentes',
        'orden_dia',
        'deliberaciones',
        'votaciones',
        'resultado',
      ],
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
  };
}

function createNoSessionOrdinaria() {
  return {
    habilitado_por_estatutos: {
      valor: true,
      fuente: 'art. 159.2 LSC',
    },
    habilitado_por_reglamento: {
      valor: false,
      fuente: 'N/A',
    },
    condicion_junta_sl: 'UNANIMIDAD_CAPITAL',
    condicion_consejo: 'MAYORIA_SIN_OPOSICION',
    ventana_minima_dias: {
      valor: 10,
      fuente: 'art. 159.2 LSC',
    },
    ventana_fuente: 'LEY',
    canal_requerido_junta_sl: {
      valor: ['NOTIFICACION_CERTIFICADA', 'BUROFAX'],
      fuente: 'art. 159.2 LSC',
    },
    canal_requerido_consejo: {
      valor: ['NOTIFICACION_CERTIFICADA', 'EMAIL_CON_ACUSE'],
      fuente: 'Reglamento',
    },
    silencio_equivale_a: 'NADA',
    cierre_anticipado: true,
    contenido_minimo_propuesta: [
      'materia',
      'texto_propuesta',
      'documentacion_adjunta',
      'plazo_respuesta',
      'instrucciones_firma',
    ],
  };
}

function createNoSessionEstatutaria() {
  return {
    habilitado_por_estatutos: {
      valor: true,
      fuente: 'art. 159.2 LSC',
    },
    habilitado_por_reglamento: {
      valor: false,
      fuente: 'N/A',
    },
    condicion_junta_sl: 'UNANIMIDAD_CAPITAL',
    condicion_consejo: 'NO_APLICABLE',
    ventana_minima_dias: {
      valor: 10,
      fuente: 'art. 159.2 LSC',
    },
    ventana_fuente: 'LEY',
    canal_requerido_junta_sl: {
      valor: ['NOTIFICACION_CERTIFICADA', 'BUROFAX'],
      fuente: 'art. 159.2 LSC',
    },
    canal_requerido_consejo: {
      valor: [],
      fuente: 'N/A',
    },
    silencio_equivale_a: 'NADA',
    cierre_anticipado: true,
    contenido_minimo_propuesta: [
      'materia',
      'texto_propuesta',
      'documentacion_adjunta',
      'plazo_respuesta',
      'instrucciones_firma',
    ],
  };
}

async function seedRulePacks() {
  console.log('🌱 Starting Motor de Reglas LSC seed script...\n');

  try {
    // Delete existing rule_pack_versions first (cascade delete via FK)
    console.log('🗑️  Cleaning existing rule packs...');
    const { error: deleteVersionsError } = await supabase
      .from('rule_pack_versions')
      .delete()
      .eq('tenant_id', DEMO_TENANT);

    if (deleteVersionsError) {
      console.warn('⚠️  Error deleting versions:', deleteVersionsError.message);
    }

    // Delete rule_packs
    const { error: deletePacksError } = await supabase
      .from('rule_packs')
      .delete()
      .eq('tenant_id', DEMO_TENANT);

    if (deletePacksError) {
      console.warn('⚠️  Error deleting packs:', deletePacksError.message);
    }

    const rulePacks: Array<{
      id: string;
      materia: string;
      organo_tipo: string;
      payload: RulePackPayload;
    }> = [
      // 1. FORMULACION_CUENTAS (Consejo only)
      {
        id: 'FORMULACION_CUENTAS',
        materia: 'FORMULACION_CUENTAS',
        organo_tipo: 'CONSEJO',
        payload: {
          id: 'FORMULACION_CUENTAS',
          materia: 'FORMULACION_CUENTAS',
          clase: 'ORDINARIA',
          organoTipo: 'CONSEJO',
          modosAdopcionPermitidos: ['MEETING', 'UNIPERSONAL_ADMIN'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              CONSEJO: { valor: 'Mayoría', fuente: 'Estatutos' },
            },
          },
          votacion: {
            mayoria: {
              CONSEJO: { formula: 'Mayoría', fuente: 'Estatutos' },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'borrador_cuentas',
                nombre: 'Borrador de Cuentas',
              },
            ],
          },
          acta: createActaStandard(),
          noSession: {
            habilitado_por_estatutos: {
              valor: false,
              fuente: 'N/A',
            },
            habilitado_por_reglamento: {
              valor: true,
              fuente: 'Reglamento del Consejo',
            },
            condicion_junta_sl: 'N/A',
            condicion_consejo: 'MAYORIA_SIN_OPOSICION',
            ventana_minima_dias: {
              valor: 5,
              fuente: 'Reglamento del Consejo',
            },
            ventana_fuente: 'REGLAMENTO',
            canal_requerido_junta_sl: {
              valor: [],
              fuente: 'N/A',
            },
            canal_requerido_consejo: {
              valor: ['EMAIL_CON_ACUSE'],
              fuente: 'Reglamento del Consejo',
            },
            silencio_equivale_a: 'ABSTENSION',
            cierre_anticipado: true,
            contenido_minimo_propuesta: [
              'texto_propuesta',
              'borrador_cuentas',
              'plazo_respuesta',
            ],
          },
          plazosMateriales: {},
          postAcuerdo: {
            inscribible: false,
            instrumentoRequerido: 'NINGUNO',
            publicacionRequerida: false,
          },
        },
      },

      // 2. APROBACION_CUENTAS (Junta)
      {
        id: 'APROBACION_CUENTAS',
        materia: 'APROBACION_CUENTAS',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'APROBACION_CUENTAS',
          materia: 'APROBACION_CUENTAS',
          clase: 'ORDINARIA',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: [
            'MEETING',
            'UNIVERSAL',
            'UNIPERSONAL_SOCIO',
            'NO_SESSION',
          ],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 25, fuente: 'art. 190 LSC' },
              SA_2a: { valor: 0, fuente: 'art. 190 LSC' },
              SL: { valor: 50, fuente: 'art. 196 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: 'Favor > Contra',
                fuente: 'art. 201.1 LSC',
              },
              SL: {
                formula: '> 1/2 capital presente',
                fuente: 'art. 198 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              { id: 'cuentas', nombre: 'Cuentas Anuales' },
              { id: 'informe_gestion', nombre: 'Informe de Gestión' },
              {
                id: 'informe_auditor',
                nombre: 'Informe de Auditor',
                condicion: 'si_auditada',
              },
              {
                id: 'propuesta_resultado',
                nombre: 'Propuesta de Distribución de Resultado',
              },
            ],
          },
          acta: createActaStandard(),
          noSession: createNoSessionOrdinaria(),
          plazosMateriales: {},
          postAcuerdo: {
            inscribible: false,
            instrumentoRequerido: 'NINGUNO',
            publicacionRequerida: false,
          },
        },
      },

      // 3. APLICACION_RESULTADO (Junta)
      {
        id: 'APLICACION_RESULTADO',
        materia: 'APLICACION_RESULTADO',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'APLICACION_RESULTADO',
          materia: 'APLICACION_RESULTADO',
          clase: 'ORDINARIA',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: [
            'MEETING',
            'UNIVERSAL',
            'UNIPERSONAL_SOCIO',
            'NO_SESSION',
          ],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 25, fuente: 'art. 190 LSC' },
              SA_2a: { valor: 0, fuente: 'art. 190 LSC' },
              SL: { valor: 50, fuente: 'art. 196 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: 'Favor > Contra',
                fuente: 'art. 201.1 LSC',
              },
              SL: {
                formula: '> 1/2 capital presente',
                fuente: 'art. 198 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'propuesta_aplicacion',
                nombre: 'Propuesta de Aplicación de Resultado',
              },
            ],
          },
          acta: createActaStandard(),
          noSession: createNoSessionOrdinaria(),
          plazosMateriales: {},
          postAcuerdo: {
            inscribible: false,
            instrumentoRequerido: 'NINGUNO',
            publicacionRequerida: false,
          },
        },
      },

      // 4. NOMBRAMIENTO_CESE (Junta)
      {
        id: 'NOMBRAMIENTO_CESE',
        materia: 'NOMBRAMIENTO_CESE',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'NOMBRAMIENTO_CESE',
          materia: 'NOMBRAMIENTO_CESE',
          clase: 'ORDINARIA',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: [
            'MEETING',
            'UNIVERSAL',
            'UNIPERSONAL_SOCIO',
            'NO_SESSION',
          ],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 25, fuente: 'art. 190 LSC' },
              SA_2a: { valor: 0, fuente: 'art. 190 LSC' },
              SL: { valor: 50, fuente: 'art. 196 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: 'Mayoría simple',
                fuente: 'art. 201 LSC',
              },
              SL: {
                formula: 'Mayoría simple',
                fuente: 'art. 198 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'informe_comision_nombramientos',
                nombre: 'Informe Comisión Nombramientos',
                condicion: 'si_cotizada',
              },
            ],
          },
          acta: createActaStandard(),
          noSession: createNoSessionOrdinaria(),
          plazosMateriales: {},
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'NINGUNO',
            publicacionRequerida: false,
          },
        },
      },

      // 5. MOD_ESTATUTOS (Junta, Estatutaria)
      {
        id: 'MOD_ESTATUTOS',
        materia: 'MOD_ESTATUTOS',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'MOD_ESTATUTOS',
          materia: 'MOD_ESTATUTOS',
          clase: 'ESTATUTARIA',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 50, fuente: 'art. 194 LSC' },
              SA_2a: { valor: 25, fuente: 'art. 194 LSC' },
              SL: { valor: 50, fuente: 'art. 197 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: '> 1/2 presente en 1ª; >= 2/3 emitidos si < 50% en 2ª',
                fuente: 'art. 201.2 LSC',
                dobleCondicional: {
                  umbral: 50,
                  mayoriaAlternativa: '2/3 emitidos',
                },
              },
              SL: {
                formula: '> 1/2 capital',
                fuente: 'art. 199 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'texto_integro',
                nombre: 'Texto Íntegro de Estatutos Propuestos',
              },
              {
                id: 'informe_admin',
                nombre: 'Informe del Administrador',
              },
            ],
          },
          acta: createActaStandard(),
          noSession: createNoSessionEstatutaria(),
          plazosMateriales: {},
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'ESCRITURA',
            publicacionRequerida: true,
          },
        },
      },

      // 6. AUMENTO_CAPITAL (Junta, Estatutaria)
      {
        id: 'AUMENTO_CAPITAL',
        materia: 'AUMENTO_CAPITAL',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'AUMENTO_CAPITAL',
          materia: 'AUMENTO_CAPITAL',
          clase: 'ESTATUTARIA',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 50, fuente: 'art. 194 LSC' },
              SA_2a: { valor: 25, fuente: 'art. 194 LSC' },
              SL: { valor: 50, fuente: 'art. 197 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: '> 1/2 presente en 1ª; >= 2/3 emitidos si < 50% en 2ª',
                fuente: 'art. 201.2 LSC',
                dobleCondicional: {
                  umbral: 50,
                  mayoriaAlternativa: '2/3 emitidos',
                },
              },
              SL: {
                formula: '> 1/2 capital',
                fuente: 'art. 199 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'texto_propuesta',
                nombre: 'Propuesta de Aumento de Capital',
              },
              {
                id: 'informe_admin',
                nombre: 'Informe del Administrador',
              },
            ],
          },
          acta: createActaStandard(),
          noSession: createNoSessionEstatutaria(),
          plazosMateriales: {
            inscripcion: { plazo_dias: 30, fuente: 'art. 305 LSC' },
          },
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'ESCRITURA',
            publicacionRequerida: true,
          },
        },
      },

      // 7. AUMENTO_CAPITAL_NO_DINERARIO (Junta, Estatutaria)
      {
        id: 'AUMENTO_CAPITAL_NO_DINERARIO',
        materia: 'AUMENTO_CAPITAL_NO_DINERARIO',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'AUMENTO_CAPITAL_NO_DINERARIO',
          materia: 'AUMENTO_CAPITAL_NO_DINERARIO',
          clase: 'ESTATUTARIA',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 50, fuente: 'art. 194 LSC' },
              SA_2a: { valor: 25, fuente: 'art. 194 LSC' },
              SL: { valor: 50, fuente: 'art. 197 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: '> 1/2 presente en 1ª; >= 2/3 emitidos si < 50% en 2ª',
                fuente: 'art. 201.2 LSC',
                dobleCondicional: {
                  umbral: 50,
                  mayoriaAlternativa: '2/3 emitidos',
                },
              },
              SL: {
                formula: '> 1/2 capital',
                fuente: 'art. 199 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'texto_propuesta',
                nombre: 'Propuesta de Aumento de Capital No Dinerario',
              },
              {
                id: 'informe_experto',
                nombre: 'Informe de Experto Independiente',
              },
            ],
          },
          acta: createActaStandard(),
          noSession: createNoSessionEstatutaria(),
          plazosMateriales: {
            inscripcion: { plazo_dias: 30, fuente: 'art. 305 LSC' },
          },
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'ESCRITURA',
            publicacionRequerida: true,
          },
        },
      },

      // 8. REDUCCION_CAPITAL (Junta, Estructural)
      {
        id: 'REDUCCION_CAPITAL',
        materia: 'REDUCCION_CAPITAL',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'REDUCCION_CAPITAL',
          materia: 'REDUCCION_CAPITAL',
          clase: 'ESTRUCTURAL',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 50, fuente: 'art. 194 LSC' },
              SA_2a: { valor: 25, fuente: 'art. 194 LSC' },
              SL: { valor: 50, fuente: 'art. 197 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: '>= 2/3 emitidos SIEMPRE',
                fuente: 'art. 201.2 LSC',
              },
              SL: {
                formula: '>= 2/3 capital',
                fuente: 'art. 199 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'texto_propuesta',
                nombre: 'Propuesta de Reducción de Capital',
              },
              {
                id: 'informe_admin',
                nombre: 'Informe del Administrador',
              },
            ],
          },
          acta: createActaStandard(),
          plazosMateriales: {
            oposicion_acreedores: {
              plazo_dias: 30,
              fuente: 'art. 334 LSC',
            },
            inscripcion: { plazo_dias: 30, fuente: 'art. 305 LSC' },
          },
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'ESCRITURA',
            publicacionRequerida: true,
          },
        },
      },

      // 9. SUPRESION_PREFERENTE (Junta, Estructural)
      {
        id: 'SUPRESION_PREFERENTE',
        materia: 'SUPRESION_PREFERENTE',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'SUPRESION_PREFERENTE',
          materia: 'SUPRESION_PREFERENTE',
          clase: 'ESTRUCTURAL',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 50, fuente: 'art. 194 LSC' },
              SA_2a: { valor: 25, fuente: 'art. 194 LSC' },
              SL: { valor: 50, fuente: 'art. 197 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: '>= 2/3 emitidos SIEMPRE',
                fuente: 'art. 201.2 LSC',
              },
              SL: {
                formula: '>= 2/3 capital',
                fuente: 'art. 199 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'informe_admin_reforzado',
                nombre: 'Informe del Administrador',
              },
              {
                id: 'informe_experto',
                nombre: 'Informe de Experto (Opcional)',
                condicion: 'opcional',
              },
            ],
          },
          acta: createActaStandard(),
          plazosMateriales: {},
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'ESCRITURA',
            publicacionRequerida: true,
          },
        },
      },

      // 10. FUSION (Junta, Estructural)
      {
        id: 'FUSION',
        materia: 'FUSION',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'FUSION',
          materia: 'FUSION',
          clase: 'ESTRUCTURAL',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 50, fuente: 'art. 194 LSC' },
              SA_2a: { valor: 25, fuente: 'art. 194 LSC' },
              SL: { valor: 50, fuente: 'art. 197 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: '>= 2/3 emitidos SIEMPRE',
                fuente: 'art. 201.2 LSC',
              },
              SL: {
                formula: '>= 2/3 capital',
                fuente: 'art. 199 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'proyecto_comun',
                nombre: 'Proyecto Común de Fusión',
              },
              {
                id: 'informe_admin',
                nombre: 'Informe del Administrador',
              },
              {
                id: 'informe_experto',
                nombre: 'Informe de Experto Independiente',
              },
              {
                id: 'cuentas_base',
                nombre: 'Cuentas Anuales Últimos Ejercicios',
              },
            ],
          },
          acta: createActaStandard(),
          plazosMateriales: {
            oposicion_acreedores: {
              plazo_dias: 30,
              fuente: 'art. 367 LSC',
            },
            inscripcion: { plazo_dias: 30, fuente: 'art. 305 LSC' },
          },
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'ESCRITURA',
            publicacionRequerida: true,
          },
        },
      },

      // 11. ESCISION (Junta, Estructural)
      {
        id: 'ESCISION',
        materia: 'ESCISION',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'ESCISION',
          materia: 'ESCISION',
          clase: 'ESTRUCTURAL',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 50, fuente: 'art. 194 LSC' },
              SA_2a: { valor: 25, fuente: 'art. 194 LSC' },
              SL: { valor: 50, fuente: 'art. 197 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: '>= 2/3 emitidos SIEMPRE',
                fuente: 'art. 201.2 LSC',
              },
              SL: {
                formula: '>= 2/3 capital',
                fuente: 'art. 199 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'proyecto',
                nombre: 'Proyecto de Escisión',
              },
              {
                id: 'informes',
                nombre: 'Informes de Administrador y Experto',
              },
              {
                id: 'cuentas_base',
                nombre: 'Cuentas Anuales Base',
              },
            ],
          },
          acta: createActaStandard(),
          plazosMateriales: {
            oposicion_acreedores: {
              plazo_dias: 30,
              fuente: 'art. 382 LSC',
            },
            inscripcion: { plazo_dias: 30, fuente: 'art. 305 LSC' },
          },
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'ESCRITURA',
            publicacionRequerida: true,
          },
        },
      },

      // 12. TRANSFORMACION (Junta, Estructural)
      {
        id: 'TRANSFORMACION',
        materia: 'TRANSFORMACION',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'TRANSFORMACION',
          materia: 'TRANSFORMACION',
          clase: 'ESTRUCTURAL',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 50, fuente: 'art. 194 LSC' },
              SA_2a: { valor: 25, fuente: 'art. 194 LSC' },
              SL: { valor: 50, fuente: 'art. 197 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: '>= 2/3 emitidos SIEMPRE',
                fuente: 'art. 201.2 LSC',
              },
              SL: {
                formula: '>= 2/3 capital',
                fuente: 'art. 199 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'proyecto',
                nombre: 'Proyecto de Transformación',
              },
              {
                id: 'balance',
                nombre: 'Balance de Situación',
              },
            ],
          },
          acta: createActaStandard(),
          plazosMateriales: {
            oposicion_acreedores: {
              plazo_dias: 30,
              fuente: 'art. 396 LSC',
            },
            inscripcion: { plazo_dias: 30, fuente: 'art. 305 LSC' },
          },
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'ESCRITURA',
            publicacionRequerida: true,
          },
        },
      },

      // 13. DISOLUCION (Junta, Estructural)
      {
        id: 'DISOLUCION',
        materia: 'DISOLUCION',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'DISOLUCION',
          materia: 'DISOLUCION',
          clase: 'ESTRUCTURAL',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 50, fuente: 'art. 194 LSC' },
              SA_2a: { valor: 25, fuente: 'art. 194 LSC' },
              SL: { valor: 50, fuente: 'art. 197 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: '>= 2/3 emitidos SIEMPRE',
                fuente: 'art. 201.2 LSC',
              },
              SL: {
                formula: '>= 2/3 capital',
                fuente: 'art. 199 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [],
          },
          acta: createActaStandard(),
          plazosMateriales: {
            inscripcion: { plazo_dias: 30, fuente: 'art. 305 LSC' },
          },
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'ESCRITURA',
            publicacionRequerida: true,
          },
        },
      },

      // 14. EMISION_OBLIGACIONES (Junta, Estatutaria)
      {
        id: 'EMISION_OBLIGACIONES',
        materia: 'EMISION_OBLIGACIONES',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'EMISION_OBLIGACIONES',
          materia: 'EMISION_OBLIGACIONES',
          clase: 'ESTATUTARIA',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 50, fuente: 'art. 194 LSC' },
              SA_2a: { valor: 25, fuente: 'art. 194 LSC' },
              SL: { valor: 50, fuente: 'art. 197 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: '> 1/2 presente en 1ª; >= 2/3 emitidos si < 50% en 2ª',
                fuente: 'art. 201.2 LSC',
                dobleCondicional: {
                  umbral: 50,
                  mayoriaAlternativa: '2/3 emitidos',
                },
              },
              SL: {
                formula: '> 1/2 capital',
                fuente: 'art. 199 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'condiciones_emision',
                nombre: 'Condiciones de Emisión',
              },
            ],
          },
          acta: createActaStandard(),
          noSession: createNoSessionEstatutaria(),
          plazosMateriales: {
            inscripcion: { plazo_dias: 30, fuente: 'art. 305 LSC' },
          },
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'ESCRITURA',
            publicacionRequerida: true,
          },
        },
      },

      // 15. RETRIBUCION_ADMIN (Junta, Ordinaria)
      {
        id: 'RETRIBUCION_ADMIN',
        materia: 'RETRIBUCION_ADMIN',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'RETRIBUCION_ADMIN',
          materia: 'RETRIBUCION_ADMIN',
          clase: 'ORDINARIA',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: [
            'MEETING',
            'UNIVERSAL',
            'UNIPERSONAL_SOCIO',
            'NO_SESSION',
          ],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 25, fuente: 'art. 190 LSC' },
              SA_2a: { valor: 0, fuente: 'art. 190 LSC' },
              SL: { valor: 50, fuente: 'art. 196 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: 'Mayoría simple',
                fuente: 'art. 201 LSC',
              },
              SL: {
                formula: 'Mayoría simple',
                fuente: 'art. 198 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'politica_retributiva',
                nombre: 'Política de Retribución de Órganos',
              },
            ],
          },
          acta: createActaStandard(),
          noSession: createNoSessionOrdinaria(),
          plazosMateriales: {},
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'INSTANCIA',
            publicacionRequerida: false,
          },
        },
      },

      // 16. CESION_GLOBAL_ACTIVO (Junta, Estructural)
      {
        id: 'CESION_GLOBAL_ACTIVO',
        materia: 'CESION_GLOBAL_ACTIVO',
        organo_tipo: 'JUNTA_GENERAL',
        payload: {
          id: 'CESION_GLOBAL_ACTIVO',
          materia: 'CESION_GLOBAL_ACTIVO',
          clase: 'ESTRUCTURAL',
          organoTipo: 'JUNTA_GENERAL',
          modosAdopcionPermitidos: ['MEETING', 'UNIVERSAL'],
          convocatoria: createConvocatoriaStandard(),
          constitucion: {
            quorum: {
              SA_1a: { valor: 50, fuente: 'art. 194 LSC' },
              SA_2a: { valor: 25, fuente: 'art. 194 LSC' },
              SL: { valor: 50, fuente: 'art. 197 LSC' },
            },
          },
          votacion: {
            mayoria: {
              SA: {
                formula: '>= 2/3 emitidos SIEMPRE',
                fuente: 'art. 201.2 LSC',
              },
              SL: {
                formula: '>= 2/3 capital',
                fuente: 'art. 199 LSC',
              },
            },
            abstenciones: 'no_cuentan',
          },
          documentacion: {
            obligatoria: [
              {
                id: 'proyecto',
                nombre: 'Proyecto de Cesión Global',
              },
              {
                id: 'informes',
                nombre: 'Informes Administrativos',
              },
            ],
          },
          acta: createActaStandard(),
          plazosMateriales: {
            inscripcion: { plazo_dias: 30, fuente: 'art. 305 LSC' },
          },
          postAcuerdo: {
            inscribible: true,
            instrumentoRequerido: 'ESCRITURA',
            publicacionRequerida: true,
          },
        },
      },
    ];

    console.log('📦 Inserting rule packs and versions...\n');

    let insertedCount = 0;

    for (const pack of rulePacks) {
      // Insert rule_pack
      const { data: packData, error: packError } = await supabase
        .from('rule_packs')
        .insert({
          id: pack.id,
          tenant_id: DEMO_TENANT,
          materia: pack.materia,
          organo_tipo: pack.organo_tipo,
          created_at: new Date().toISOString(),
        })
        .select();

      if (packError) {
        console.error(`❌ Error inserting pack ${pack.id}:`, packError.message);
        continue;
      }

      // Insert version
      const { data: versionData, error: versionError } = await supabase
        .from('rule_pack_versions')
        .insert({
          id: `${pack.id}_v1.0.0`,
          tenant_id: DEMO_TENANT,
          rule_pack_id: pack.id,
          version: 'v1.0.0',
          payload: pack.payload,
          created_at: new Date().toISOString(),
        })
        .select();

      if (versionError) {
        console.error(
          `❌ Error inserting version for ${pack.id}:`,
          versionError.message
        );
        continue;
      }

      console.log(
        `✅ ${pack.id} (${pack.organo_tipo}) — v1.0.0 inserted`
      );
      insertedCount++;
    }

    console.log(`\n🎉 Seed completed: ${insertedCount}/16 rule packs inserted`);
    process.exit(0);
  } catch (error) {
    console.error('🚨 Seed script error:', error);
    process.exit(1);
  }
}

seedRulePacks();
