/**
 * Motor de Verificación de Plantillas (Gate PRE)
 *
 * Sistema que verifica si una plantilla documentaria es conforme a los
 * requisitos de gobernanza ANTES de (PRE) que sea usada.
 *
 * Modes:
 * - DISABLED: siempre retorna ok=true (sin validación)
 * - STRICT: exige plantilla exacta ACTIVA o APROBADA (no fallbacks)
 * - FALLBACK: intenta exacta, si no hay usa fallback, si no hay → BLOCKING
 *
 * Pure function — sin side effects, sin DB, sin imports React/Supabase.
 */

export type AdoptionMode =
  | 'MEETING'
  | 'UNIVERSAL'
  | 'NO_SESSION'
  | 'UNIPERSONAL_SOCIO'
  | 'UNIPERSONAL_ADMIN';

export type EvalSeverity = 'BLOCKING' | 'WARNING' | 'CRITICAL' | 'INFO';

export interface ExplainNode {
  step: string;
  result: boolean;
  detail: string;
}

export interface PlantillaProtegida {
  id: string;
  tipo: string; // ACTA_SESION, ACTA_CONSIGNACION, CERTIFICACION, etc.
  adoption_mode?: string; // comma-separated o null
  organo_tipo?: string; // CDA, CAU, etc. o null (aplica a todos)
  status: 'BORRADOR' | 'ACTIVA' | 'APROBADA' | 'ARCHIVADA';
  variables: Array<{ key: string; source: 'USUARIO' | 'MOTOR_REGLAS'; required: boolean }>;
  protecciones?: {
    secciones_inmutables?: string[];
    hash_contenido?: string;
  };
  ruleset_snapshot_id?: string;
}

export interface PlantillaGateRule {
  id: string;
  tipo_requerido: string; // ACTA_SESION, CERTIFICACION, etc.
  adoption_modes: string[]; // ['MEETING'] or ['MEETING', 'UNIVERSAL']
  organo_tipos?: string[]; // null = todos, o ['CDA', 'CAU']
  modo: 'STRICT' | 'FALLBACK' | 'DISABLED';
  fallback_tipo?: string; // si modo=FALLBACK, qué tipo usar
}

export interface PlantillaGateConfig {
  rules: PlantillaGateRule[];
  default_mode: 'STRICT' | 'FALLBACK' | 'DISABLED';
}

export interface PlantillaEvalInput {
  adoptionMode: AdoptionMode;
  organoTipo: string; // CDA, CAU, etc.
  tipoActaRequerido: string; // ACTA_SESION, CERTIFICACION, etc.
  plantillasDisponibles: PlantillaProtegida[];
  variablesResueltas: Record<string, unknown>;
  gateConfig: PlantillaGateConfig;
  rulesetSnapshotId?: string;
  tipoSocial?: 'SA' | 'SL'; // DL-4: para selección automática de plantilla convocatoria
}

export interface PlantillaEvalOutput {
  ok: boolean;
  severity: EvalSeverity;
  plantillaUsada?: string;
  plantillaEsperada?: string;
  esFallback: boolean;
  explain: ExplainNode[];
  blocking_issues: string[];
  warnings: string[];
}

/**
 * Calcula un ID de snapshot del ruleset de forma determinística.
 * Usa hash simple (djb2) de JSON canonizado para mantener sincronía
 * entre cliente y servidor.
 *
 * @param params - parámetros base
 * @param overrides - sobrescrituras opcionales
 * @returns hash hexadecimal determinístico
 */
export function calcularRulesetSnapshotId(
  params: unknown,
  overrides?: unknown[]
): string {
  // Canonizar a JSON ordenado (garantiza determinismo)
  const canonical = JSON.stringify(
    { params, overrides },
    (_, v) => {
      if (typeof v !== 'object' || v === null) return v;
      if (Array.isArray(v)) return v;
      // Para objetos, retornar con claves ordenadas
      return Object.keys(v)
        .sort()
        .reduce((acc, k) => {
          acc[k] = v[k];
          return acc;
        }, {} as Record<string, unknown>);
    }
  );

  // djb2 hash (simple pero determinístico)
  let hash = 5381;
  for (let i = 0; i < canonical.length; i++) {
    hash = (hash * 33) ^ canonical.charCodeAt(i);
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Función principal de evaluación de plantillas.
 *
 * @param input - parámetros de evaluación
 * @returns resultado de evaluación con detalles
 */
export function evaluarPlantillaProtegida(
  input: PlantillaEvalInput
): PlantillaEvalOutput {
  const explain: ExplainNode[] = [];
  const blocking_issues: string[] = [];
  const warnings: string[] = [];
  let plantillaUsada: string | undefined;
  let plantillaEsperada: string | undefined;
  let esFallback = false;
  let ok = false;
  let severity: EvalSeverity = 'INFO';

  // Paso 1: Buscar rule en config
  explain.push({
    step: 'lookup_rule',
    result: true,
    detail: `Buscando rule para tipo="${input.tipoActaRequerido}", adoption="${input.adoptionMode}", organo="${input.organoTipo}"`,
  });

  const applicableRule = input.gateConfig.rules.find((rule) => {
    const tipoMatch = rule.tipo_requerido === input.tipoActaRequerido;
    const adoptionMatch = rule.adoption_modes.includes(input.adoptionMode);
    const organoMatch =
      !rule.organo_tipos || rule.organo_tipos.includes(input.organoTipo);
    return tipoMatch && adoptionMatch && organoMatch;
  });

  const modoGate = applicableRule?.modo || input.gateConfig.default_mode;

  explain.push({
    step: 'apply_mode',
    result: true,
    detail: `Modo de gate: ${modoGate}${
      applicableRule ? ` (rule.id=${applicableRule.id})` : ' (default)'
    }`,
  });

  // Paso 1b: DL-4 — Auto-selección de plantilla convocatoria por tipo social
  const autoSeleccion = resolverPlantillaConvocatoria(
    input.tipoSocial,
    input.tipoActaRequerido
  );
  const tipoActaEfectivo = autoSeleccion.tipoResuelto;
  if (autoSeleccion.autoSeleccionada) {
    explain.push({
      step: 'auto_select_convocatoria',
      result: true,
      detail: `DL-4: Auto-selección tipo_social=${input.tipoSocial}: "${input.tipoActaRequerido}" → "${tipoActaEfectivo}". ${autoSeleccion.motivo || ''}`,
    });
    warnings.push(
      `Plantilla auto-seleccionada por tipo social (${input.tipoSocial}): ${tipoActaEfectivo}. Override manual requiere justificación en audit log.`
    );
  }

  // Paso 2: DISABLED mode → siempre OK
  if (modoGate === 'DISABLED') {
    explain.push({
      step: 'disabled_mode',
      result: true,
      detail: 'Gate en modo DISABLED: validación deshabilitada',
    });
    return {
      ok: true,
      severity: 'INFO',
      esFallback: false,
      explain,
      blocking_issues: [],
      warnings: [],
    };
  }

  // Paso 3: Buscar plantilla exacta (status ACTIVA o APROBADA)
  plantillaEsperada = tipoActaEfectivo;
  const plantillaExacta = input.plantillasDisponibles.find((p) => {
    const tipoMatch = p.tipo === tipoActaEfectivo;
    const statusOk = p.status === 'ACTIVA' || p.status === 'APROBADA';
    const adoptionMatch =
      !p.adoption_mode ||
      p.adoption_mode.split(',').some((m) => m.trim() === input.adoptionMode);
    const organoMatch =
      !p.organo_tipo || p.organo_tipo === input.organoTipo;
    return tipoMatch && statusOk && adoptionMatch && organoMatch;
  });

  if (plantillaExacta) {
    explain.push({
      step: 'find_exact',
      result: true,
      detail: `Plantilla exacta encontrada: "${plantillaExacta.id}" (tipo=${tipoActaEfectivo}, status=${plantillaExacta.status})`,
    });
    plantillaUsada = plantillaExacta.id;
    // Validar variables
    const validacionVariables = validarVariables(
      plantillaExacta,
      input.variablesResueltas
    );
    if (!validacionVariables.ok) {
      blocking_issues.push(...validacionVariables.issues);
      explain.push({
        step: 'validate_variables',
        result: false,
        detail: `Variables incompletas: ${validacionVariables.issues.join(', ')}`,
      });
      severity = 'BLOCKING';
      ok = false;
    } else {
      explain.push({
        step: 'validate_variables',
        result: true,
        detail: 'Todas las variables requeridas resueltas',
      });
      // Validar protecciones
      const validacionProtecciones = validarProtecciones(
        plantillaExacta,
        input.rulesetSnapshotId
      );
      if (!validacionProtecciones.ok) {
        blocking_issues.push(...validacionProtecciones.issues);
        explain.push({
          step: 'validate_protecciones',
          result: false,
          detail: `Protecciones violadas: ${validacionProtecciones.issues.join(', ')}`,
        });
        severity = 'BLOCKING';
        ok = false;
      } else {
        explain.push({
          step: 'validate_protecciones',
          result: true,
          detail: 'Protecciones validadas',
        });
        ok = true;
      }
    }
    return {
      ok,
      severity,
      plantillaUsada,
      plantillaEsperada,
      esFallback,
      explain,
      blocking_issues,
      warnings,
    };
  }

  // Paso 4: Plantilla exacta no encontrada
  explain.push({
    step: 'find_exact',
    result: false,
    detail: `Plantilla exacta NO encontrada para tipo="${tipoActaEfectivo}"`,
  });

  // Modo STRICT → error
  if (modoGate === 'STRICT') {
    blocking_issues.push(
      `Plantilla requerida "${tipoActaEfectivo}" no encontrada en estado ACTIVA o APROBADA (modo STRICT).`
    );
    explain.push({
      step: 'strict_no_fallback',
      result: false,
      detail: 'Modo STRICT: no se permiten fallbacks',
    });
    return {
      ok: false,
      severity: 'BLOCKING',
      plantillaUsada: undefined,
      plantillaEsperada,
      esFallback: false,
      explain,
      blocking_issues,
      warnings,
    };
  }

  // Modo FALLBACK → buscar fallback
  if (modoGate === 'FALLBACK' && applicableRule?.fallback_tipo) {
    explain.push({
      step: 'try_fallback',
      result: true,
      detail: `Intentando fallback a tipo="${applicableRule.fallback_tipo}"`,
    });

    const plantillaFallback = input.plantillasDisponibles.find((p) => {
      const tipoMatch = p.tipo === applicableRule.fallback_tipo;
      const statusOk = p.status === 'ACTIVA' || p.status === 'APROBADA';
      return tipoMatch && statusOk;
    });

    if (plantillaFallback) {
      explain.push({
        step: 'find_fallback',
        result: true,
        detail: `Plantilla fallback encontrada: "${plantillaFallback.id}" (status=${plantillaFallback.status})`,
      });

      plantillaUsada = plantillaFallback.id;
      esFallback = true;
      warnings.push(
        `Usando plantilla fallback "${applicableRule.fallback_tipo}" en lugar de "${tipoActaEfectivo}".`
      );

      const validacionVariables = validarVariables(
        plantillaFallback,
        input.variablesResueltas
      );
      if (!validacionVariables.ok) {
        blocking_issues.push(...validacionVariables.issues);
        explain.push({
          step: 'validate_variables',
          result: false,
          detail: `Variables incompletas: ${validacionVariables.issues.join(', ')}`,
        });
        severity = 'BLOCKING';
        ok = false;
      } else {
        explain.push({
          step: 'validate_variables',
          result: true,
          detail: 'Todas las variables requeridas resueltas',
        });
        ok = true;
        severity = 'WARNING';
      }

      return {
        ok,
        severity,
        plantillaUsada,
        plantillaEsperada,
        esFallback,
        explain,
        blocking_issues,
        warnings,
      };
    }

    explain.push({
      step: 'find_fallback',
      result: false,
      detail: `Plantilla fallback "${applicableRule.fallback_tipo}" tampoco encontrada`,
    });
  }

  // Paso 5: Ni exacta ni fallback disponibles → BLOCKING
  blocking_issues.push(
    `Ninguna plantilla disponible (tipo="${tipoActaEfectivo}"${
      applicableRule?.fallback_tipo ? ` ni fallback "${applicableRule.fallback_tipo}"` : ''
    }).`
  );

  return {
    ok: false,
    severity: 'BLOCKING',
    plantillaUsada: undefined,
    plantillaEsperada,
    esFallback: false,
    explain,
    blocking_issues,
    warnings,
  };
}

/**
 * Valida que todas las variables requeridas (source=USUARIO) estén resueltas.
 * Las variables con source=MOTOR_REGLAS se ignoran.
 */
function validarVariables(
  plantilla: PlantillaProtegida,
  variablesResueltas: Record<string, unknown>
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];

  for (const v of plantilla.variables) {
    // Saltar variables MOTOR_REGLAS
    if (v.source === 'MOTOR_REGLAS') continue;

    // Si requerida y no resuelta → issue
    if (v.required && !(v.key in variablesResueltas)) {
      issues.push(`Variable requerida "${v.key}" no resuelta`);
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Valida que las protecciones de la plantilla no hayan sido violadas.
 */
function validarProtecciones(
  plantilla: PlantillaProtegida,
  rulesetSnapshotId?: string
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!plantilla.protecciones) return { ok: true, issues: [] };

  // Si hay ruleset_snapshot_id y config proporciona uno, deben coincidir
  if (plantilla.ruleset_snapshot_id && rulesetSnapshotId) {
    if (plantilla.ruleset_snapshot_id !== rulesetSnapshotId) {
      issues.push(
        `Ruleset mismatch: esperado "${plantilla.ruleset_snapshot_id}", recibido "${rulesetSnapshotId}"`
      );
    }
  }

  // Nota: hash_contenido se verificaría contra el contenido real en tiempo de ejecución,
  // pero aquí solo hacemos validación de metadatos.

  return { ok: issues.length === 0, issues };
}

/**
 * DL-4: Selección automática de plantilla de convocatoria por tipo social.
 * SA → CONVOCATORIA (Plantilla 6: BORME + web, derecho información art. 197 LSC)
 * SL → CONVOCATORIA_SL_NOTIFICACION (Plantilla 9: notificación individual art. 173.2 LSC)
 *
 * @param tipoSocial - 'SA' | 'SL'
 * @param tipoActaRequerido - tipo original solicitado
 * @returns tipo de plantilla resuelto + flag indicando si hubo auto-selección
 */
export function resolverPlantillaConvocatoria(
  tipoSocial: 'SA' | 'SL' | undefined,
  tipoActaRequerido: string
): { tipoResuelto: string; autoSeleccionada: boolean; motivo?: string } {
  // Solo aplica a materias de convocatoria
  const esConvocatoria =
    tipoActaRequerido === 'CONVOCATORIA' ||
    tipoActaRequerido === 'CONVOCATORIA_SL_NOTIFICACION';

  if (!esConvocatoria || !tipoSocial) {
    return { tipoResuelto: tipoActaRequerido, autoSeleccionada: false };
  }

  if (tipoSocial === 'SA') {
    return {
      tipoResuelto: 'CONVOCATORIA',
      autoSeleccionada: tipoActaRequerido !== 'CONVOCATORIA',
      motivo: tipoActaRequerido !== 'CONVOCATORIA'
        ? 'DL-4: Entidad SA requiere Convocatoria con publicación BORME + web (art. 173.1 LSC)'
        : undefined,
    };
  }

  if (tipoSocial === 'SL') {
    return {
      tipoResuelto: 'CONVOCATORIA_SL_NOTIFICACION',
      autoSeleccionada: tipoActaRequerido !== 'CONVOCATORIA_SL_NOTIFICACION',
      motivo: tipoActaRequerido !== 'CONVOCATORIA_SL_NOTIFICACION'
        ? 'DL-4: Entidad SL requiere notificación individual certificada (art. 173.2 LSC)'
        : undefined,
    };
  }

  return { tipoResuelto: tipoActaRequerido, autoSeleccionada: false };
}

/**
 * Configuración de Gate para Go Live.
 * Exportar como constante reutilizable.
 */
export const GO_LIVE_CONFIG: PlantillaGateConfig = {
  rules: [
    {
      id: 'rule_acta_sesion_junta',
      tipo_requerido: 'ACTA_SESION',
      adoption_modes: ['MEETING'],
      organo_tipos: undefined, // todos
      modo: 'STRICT',
    },
    {
      id: 'rule_acta_sesion_consejo',
      tipo_requerido: 'ACTA_SESION',
      adoption_modes: ['MEETING'],
      organo_tipos: ['CONSEJO_ADMINISTRACION'],
      modo: 'STRICT',
    },
    {
      id: 'rule_acta_consignacion_socio',
      tipo_requerido: 'ACTA_CONSIGNACION_SOCIO',
      adoption_modes: ['UNIPERSONAL_SOCIO'],
      modo: 'STRICT',
    },
    {
      id: 'rule_acta_consignacion_admin',
      tipo_requerido: 'ACTA_CONSIGNACION_ADMIN',
      adoption_modes: ['UNIPERSONAL_ADMIN'],
      modo: 'STRICT',
    },
    {
      id: 'rule_certificacion',
      tipo_requerido: 'CERTIFICACION',
      adoption_modes: ['MEETING', 'UNIVERSAL', 'NO_SESSION'],
      modo: 'STRICT',
    },
    {
      id: 'rule_convocatoria',
      tipo_requerido: 'CONVOCATORIA',
      adoption_modes: ['MEETING'],
      modo: 'STRICT',
    },
    {
      id: 'rule_acta_acuerdo_escrito_fallback',
      tipo_requerido: 'ACTA_ACUERDO_ESCRITO',
      adoption_modes: ['NO_SESSION'],
      modo: 'FALLBACK',
      fallback_tipo: 'ACTA_ACUERDO_ESCRITO_GENERICO',
    },
    {
      id: 'rule_acta_sesion_comision',
      tipo_requerido: 'ACTA_SESION',
      adoption_modes: ['MEETING'],
      organo_tipos: ['COMISION_DELEGADA'],
      modo: 'STRICT',
    },
    {
      id: 'rule_convocatoria_sl',
      tipo_requerido: 'CONVOCATORIA_SL_NOTIFICACION',
      adoption_modes: ['MEETING'],
      modo: 'STRICT',
    },
  ],
  default_mode: 'STRICT',
};
