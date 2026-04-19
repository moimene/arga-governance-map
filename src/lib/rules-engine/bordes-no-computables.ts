/**
 * Motor de Evaluación de Bordes No-Computables (LSC)
 *
 * Función pura que evalúa 7 "bordes" (edge cases) que el motor determinístico
 * no puede resolver completamente sin intervención externa.
 *
 * Reglas No-Computables:
 * 1. Cotizadas → WARNING (evalúa LSC + advertencias LMV) — DL-2 resuelta 2026-04-19
 * 2. Consentimiento de clase → BLOCKING si no resuelto
 * 3. Suficiencia de liquidez → BLOCKING si REPARTO_DIVIDENDOS sin verificación
 * 4. Indelegabilidad fina → WARNING si no verificado
 * 5. Junta telemática → BLOCKING si sin checklist
 * 6. Evidencia publicación SA → WARNING si sin evidencia
 * 7. Evidencia notificación SL → WARNING si sin evidencia
 */

export type EvalSeverity = 'BLOCKING' | 'WARNING' | 'CRITICAL' | 'INFO';
export type BordeStatus = 'RESUELTO' | 'PENDIENTE' | 'FUERA_DE_ALCANCE';

export interface ReglaNoComputable {
  id: string;
  nombre: string;
  condicion: string;
  aplica: boolean;
  status: BordeStatus;
  severity: EvalSeverity;
  resolucion?: string;
}

export interface BordeInput {
  esCotizada: boolean;
  tipoSocial: 'SA' | 'SL';
  materias: string[];
  // Optional resolution flags
  consentimientoClaseResuelto?: boolean;
  perimetroClaseDefinido?: boolean;
  liquidezVerificada?: boolean;
  indelegabilidadVerificada?: boolean;
  juntaTelematicaChecklist?: boolean;
  evidenciaPublicacionSA?: boolean;
  evidenciaNotificacionSL?: boolean;
}

/**
 * Evalúa los 7 bordes no-computables y retorna array de ReglaNoComputable.
 * Pure function — sin side effects, sin DB, sin imports React/Supabase.
 *
 * @param input - parámetros de evaluación
 * @returns array de ReglaNoComputable (vacío si ninguno aplica)
 */
export function evaluarBordesNoComputables(input: BordeInput): ReglaNoComputable[] {
  const resultado: ReglaNoComputable[] = [];

  // 1. BORDE_COTIZADA — entidad cotizada → WARNING (evaluar LSC + advertir LMV)
  // DL-2 resuelta (2026-04-19): NO bloquear cotizadas. ARGA Seguros es SA cotizada.
  // El motor evalúa LSC normalmente y añade advertencias LMV como WARNING.
  if (input.esCotizada) {
    resultado.push({
      id: 'BORDE_COTIZADA_LMV_HECHO_RELEVANTE',
      nombre: 'Cotizada — Verificar hecho relevante CNMV',
      condicion: 'esCotizada === true',
      aplica: true,
      status: 'PENDIENTE',
      severity: 'WARNING',
      resolucion: 'Verificar si el acuerdo constituye hecho relevante (art. 228 LMV). Comunicar a CNMV si procede.',
    });
    resultado.push({
      id: 'BORDE_COTIZADA_LMV_IPDD',
      nombre: 'Cotizada — Información privilegiada (MAR art. 17)',
      condicion: 'esCotizada === true',
      aplica: true,
      status: 'PENDIENTE',
      severity: 'WARNING',
      resolucion: 'Evaluar si el acuerdo constituye información privilegiada (IPDD). Publicar antes de apertura de mercado si aplica.',
    });

    // Operaciones vinculadas — solo si hay materias que lo impliquen
    const materiasOperacionesVinculadas = [
      'AUTORIZACION_TRANSACCION',
      'APROBACION_PRESUPUESTOS',
      'REPARTO_DIVIDENDOS',
    ];
    if (input.materias.some((m) => materiasOperacionesVinculadas.includes(m))) {
      resultado.push({
        id: 'BORDE_COTIZADA_OPERACIONES_VINCULADAS',
        nombre: 'Cotizada — Operaciones vinculadas (art. 231 LSC)',
        condicion: 'esCotizada === true && materiasOperacionesVinculadas',
        aplica: true,
        status: 'PENDIENTE',
        severity: 'WARNING',
        resolucion: 'Verificar si la transacción implica partes vinculadas. Requiere informe favorable del Comité de Auditoría.',
      });
    }

    resultado.push({
      id: 'BORDE_COTIZADA_IAGC',
      nombre: 'Cotizada — Informe Anual Gobierno Corporativo',
      condicion: 'esCotizada === true',
      aplica: true,
      status: 'PENDIENTE',
      severity: 'INFO',
      resolucion: 'Verificar si el acuerdo debe reflejarse en el IAGC (art. 540 LSC cotizadas).',
    });
    // NO return early — el motor continúa evaluando los bordes restantes (2-7)
  }

  // 2. BORDE_CONSENTIMIENTO_CLASE — consentimiento de clase
  const materiasConClaseImpacto = [
    'MOD_ESTATUTOS',
    'AUMENTO_CAPITAL',
    'REDUCCION_CAPITAL',
    'AMPLIACION_CAPITAL',
    'EMISION_BONOS_CONVERTIBLES',
    'DIVISION_SOCIEDAD',
    'FUSION_SOCIEDAD',
    'TRANSFORMACION_SOCIEDAD',
  ];

  const tieneMateriasClase = input.materias.some((m) =>
    materiasConClaseImpacto.includes(m)
  );

  if (tieneMateriasClase) {
    if (input.perimetroClaseDefinido === false) {
      resultado.push({
        id: 'BORDE_CONSENTIMIENTO_CLASE_SIN_PERIMETRO',
        nombre: 'Consentimiento de Clase — Perímetro no definido',
        condicion: 'tieneMateriasClase && perimetroClaseDefinido === false',
        aplica: true,
        status: 'PENDIENTE',
        severity: 'BLOCKING',
        resolucion:
          'Definir perímetro de clases afectadas antes de proceder a consentimiento.',
      });
    } else if (input.perimetroClaseDefinido === true && input.consentimientoClaseResuelto === false) {
      resultado.push({
        id: 'BORDE_CONSENTIMIENTO_CLASE_NO_RESUELTO',
        nombre: 'Consentimiento de Clase — No resuelto',
        condicion: 'perimetroClaseDefinido === true && consentimientoClaseResuelto === false',
        aplica: true,
        status: 'PENDIENTE',
        severity: 'BLOCKING',
        resolucion: 'Obtener consentimiento de los accionistas afectados (art. 305 LSC).',
      });
    } else if (input.perimetroClaseDefinido === true && input.consentimientoClaseResuelto === true) {
      resultado.push({
        id: 'BORDE_CONSENTIMIENTO_CLASE_RESUELTO',
        nombre: 'Consentimiento de Clase — Resuelto',
        condicion: 'perimetroClaseDefinido === true && consentimientoClaseResuelto === true',
        aplica: true,
        status: 'RESUELTO',
        severity: 'INFO',
      });
    }
  }

  // 3. BORDE_LIQUIDEZ — suficiencia de liquidez para reparto de dividendos
  const incluyeRepartoDividendos = input.materias.includes('REPARTO_DIVIDENDOS');

  if (incluyeRepartoDividendos && input.liquidezVerificada === false) {
    resultado.push({
      id: 'BORDE_LIQUIDEZ_NO_VERIFICADA',
      nombre: 'Suficiencia de Liquidez — No verificada',
      condicion: 'incluyeRepartoDividendos && liquidezVerificada === false',
      aplica: true,
      status: 'PENDIENTE',
      severity: 'BLOCKING',
      resolucion: 'Verificar suficiencia de liquidez (art. 273 LSC) antes de acuerdo de reparto.',
    });
  } else if (incluyeRepartoDividendos && input.liquidezVerificada === true) {
    resultado.push({
      id: 'BORDE_LIQUIDEZ_VERIFICADA',
      nombre: 'Suficiencia de Liquidez — Verificada',
      condicion: 'incluyeRepartoDividendos && liquidezVerificada === true',
      aplica: true,
      status: 'RESUELTO',
      severity: 'INFO',
    });
  }

  // 4. BORDE_INDELEGABILIDAD — indelegabilidad fina (future check, not fully implemented)
  // Por ahora, simplemente advertir si hay materias y no se ha verificado
  const materiasConRiesgoIndelegabilidad = [
    'NOMBRAMIENTO_CESE_ADMIN',
    'AUTORIZACION_TRANSACCION',
    'APROBACION_PRESUPUESTOS',
  ];

  const tieneMateriasIndelegables = input.materias.some((m) =>
    materiasConRiesgoIndelegabilidad.includes(m)
  );

  if (tieneMateriasIndelegables && input.indelegabilidadVerificada === false) {
    resultado.push({
      id: 'BORDE_INDELEGABILIDAD_NO_VERIFICADA',
      nombre: 'Indelegabilidad Fina — No verificada',
      condicion: 'tieneMateriasIndelegables && indelegabilidadVerificada === false',
      aplica: true,
      status: 'PENDIENTE',
      severity: 'WARNING',
      resolucion: 'Verificar que materia no puede ser delegada en órgano de menor rango.',
    });
  } else if (tieneMateriasIndelegables && input.indelegabilidadVerificada === true) {
    resultado.push({
      id: 'BORDE_INDELEGABILIDAD_VERIFICADA',
      nombre: 'Indelegabilidad Fina — Verificada',
      condicion: 'tieneMateriasIndelegables && indelegabilidadVerificada === true',
      aplica: true,
      status: 'RESUELTO',
      severity: 'INFO',
    });
  }

  // 5. BORDE_JUNTA_TELEMATICA — junta telemática requiere previsión estatutaria (art. 182 LSC)
  const esJuntaGral = input.materias.some((m) =>
    ['JUNTA_GENERAL', 'JUNTA_GENERAL_EXTRAORDINARIA'].includes(m)
  );

  if (esJuntaGral && input.juntaTelematicaChecklist === false) {
    resultado.push({
      id: 'BORDE_JUNTA_TELEMATICA_SIN_CHECKLIST',
      nombre: 'Junta Telemática — Checklist incompleto',
      condicion: 'esJuntaGral && juntaTelematicaChecklist === false',
      aplica: true,
      status: 'PENDIENTE',
      severity: 'BLOCKING',
      resolucion:
        'Completar checklist de junta telemática (art. 182 LSC): previsión estatutaria, medios técnicos, acceso accionistas.',
    });
  } else if (esJuntaGral && input.juntaTelematicaChecklist === true) {
    resultado.push({
      id: 'BORDE_JUNTA_TELEMATICA_OK',
      nombre: 'Junta Telemática — Checklist completado',
      condicion: 'esJuntaGral && juntaTelematicaChecklist === true',
      aplica: true,
      status: 'RESUELTO',
      severity: 'INFO',
    });
  }

  // 6. BORDE_EVIDENCIA_PUBLICACION_SA — SA requiere publicación en BORME (art. 224 LSC)
  if (input.tipoSocial === 'SA') {
    const esConvocatoria = input.materias.some((m) =>
      ['CONVOCATORIA_JUNTA', 'CONVOCATORIA_JUNTA_GOR'].includes(m)
    );

    if (esConvocatoria && input.evidenciaPublicacionSA === false) {
      resultado.push({
        id: 'BORDE_PUBLICACION_SA_SIN_EVIDENCIA',
        nombre: 'Publicación SA (BORME) — Sin evidencia',
        condicion: 'tipoSocial === "SA" && esConvocatoria && evidenciaPublicacionSA === false',
        aplica: true,
        status: 'PENDIENTE',
        severity: 'WARNING',
        resolucion: 'Verificar publicación en BORME (art. 224 LSC) y documentar prueba.',
      });
    } else if (esConvocatoria && input.evidenciaPublicacionSA === true) {
      resultado.push({
        id: 'BORDE_PUBLICACION_SA_CON_EVIDENCIA',
        nombre: 'Publicación SA (BORME) — Con evidencia',
        condicion: 'tipoSocial === "SA" && esConvocatoria && evidenciaPublicacionSA === true',
        aplica: true,
        status: 'RESUELTO',
        severity: 'INFO',
      });
    }
  }

  // 7. BORDE_EVIDENCIA_NOTIFICACION_SL — SL requiere notificación individual (art. 213 LSC)
  if (input.tipoSocial === 'SL') {
    const esConvocatoria = input.materias.some((m) =>
      ['CONVOCATORIA_JUNTA', 'CONVOCATORIA_JUNTA_GOR'].includes(m)
    );

    if (esConvocatoria && input.evidenciaNotificacionSL === false) {
      resultado.push({
        id: 'BORDE_NOTIFICACION_SL_SIN_EVIDENCIA',
        nombre: 'Notificación SL — Sin evidencia',
        condicion: 'tipoSocial === "SL" && esConvocatoria && evidenciaNotificacionSL === false',
        aplica: true,
        status: 'PENDIENTE',
        severity: 'WARNING',
        resolucion: 'Verificar notificación individual a socios (art. 213 LSC) y documentar prueba de entrega.',
      });
    } else if (esConvocatoria && input.evidenciaNotificacionSL === true) {
      resultado.push({
        id: 'BORDE_NOTIFICACION_SL_CON_EVIDENCIA',
        nombre: 'Notificación SL — Con evidencia',
        condicion: 'tipoSocial === "SL" && esConvocatoria && evidenciaNotificacionSL === true',
        aplica: true,
        status: 'RESUELTO',
        severity: 'INFO',
      });
    }
  }

  return resultado;
}
