// ============================================================
// Motor de Reglas LSC — Etapa de Documentación
// Spec: docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md §7
// ============================================================

import type {
  DocumentacionInput,
  DocumentacionOutput,
  RulePack,
  ExplainNode,
  TipoActa,
  AdoptionMode,
  EvalSeverity,
} from './types';

/**
 * Evalúa la completitud de documentación pre-sesión y la validez del acta.
 *
 * Pre-sesión:
 * - Obtiene union de documentos obligatorios de todos los packs
 * - Verifica que cada documento requerido esté en documentosDisponibles
 * - Valida ventanas de disponibilidad si aplican
 * - Ignora documentos condicionales cuya condición no se cumple
 *
 * Acta:
 * - Verifica tipo de acta esperado para el modo de adopción
 * - Valida contenido mínimo según tipo de acta
 * - Comprueba transcripción y conformidad si requeridas
 */
export function evaluarDocumentacion(
  input: DocumentacionInput,
  packs: RulePack[]
): DocumentacionOutput {
  const explain: ExplainNode[] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  // ===== FASE 1: Recopilar documentos obligatorios =====
  const documentosRequeridos = new Set<string>();
  const documentosMetadata = new Map<string, { nombre: string; condicion?: string }>();

  for (const pack of packs) {
    for (const doc of pack.documentacion.obligatoria) {
      documentosRequeridos.add(doc.id);
      if (!documentosMetadata.has(doc.id)) {
        documentosMetadata.set(doc.id, { nombre: doc.nombre, condicion: doc.condicion });
      }
    }
  }

  // ===== FASE 2: Validar disponibilidad de documentos pre-sesión =====
  const documentosDisponiblesIds = new Set(input.documentosDisponibles.map((d) => d.id));
  const documentosFaltantes: Array<{ id: string; nombre: string }> = [];

  for (const docId of documentosRequeridos) {
    const meta = documentosMetadata.get(docId);
    if (!meta) continue;

    // Si hay condición, evaluar si se aplica (simplificado: si contiene "si_" es condicional)
    const tieneCondicion = meta.condicion && meta.condicion.startsWith('si_');
    if (tieneCondicion) {
      // En V1, ignorar documentos condicionales — no son requeridos si no hay contexto
      continue;
    }

    if (!documentosDisponiblesIds.has(docId)) {
      documentosFaltantes.push({ id: docId, nombre: meta.nombre });
      blockingIssues.push(`Documento obligatorio faltante: ${meta.nombre} (${docId})`);
    } else {
      // Validar ventana si existe
      const docData = input.documentosDisponibles.find((d) => d.id === docId);
      if (docData?.disponible_desde && packs[0]?.documentacion.ventanaDisponibilidad) {
        const ventana = packs[0].documentacion.ventanaDisponibilidad;
        const dispDesde = new Date(docData.disponible_desde);
        const ahora = new Date();
        const diasDesde = Math.floor(
          (ahora.getTime() - dispDesde.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diasDesde < ventana.dias) {
          warnings.push(
            `Documento ${meta.nombre} disponible pero fuera de ventana (${diasDesde}/${ventana.dias} días)`
          );
          explain.push({
            regla: 'ventana_disponibilidad_documento',
            fuente: ventana.fuente,
            valor: `${diasDesde} días`,
            umbral: ventana.dias,
            resultado: 'WARNING',
            mensaje: `Documento ${meta.nombre} no cumple ventana mínima`,
          });
        }
      }
    }
  }

  // Explicación de documentación
  explain.push({
    regla: 'completitud_documentacion',
    fuente: 'LEY',
    referencia: 'art. 188 LSC',
    resultado: documentosFaltantes.length === 0 ? 'OK' : 'BLOCKING',
    mensaje:
      documentosFaltantes.length === 0
        ? `Todos ${documentosRequeridos.size} documentos disponibles`
        : `${documentosFaltantes.length} documento(s) faltante(s)`,
    hijos: documentosFaltantes.map((d) => ({
      regla: 'documento_faltante',
      fuente: 'LEY',
      resultado: 'BLOCKING' as EvalSeverity,
      mensaje: `${d.nombre} (${d.id})`,
    })),
  });

  // ===== FASE 3: Validar acta =====
  let actaValida = true;
  let actaTipoEsperado: TipoActa = 'ACTA_JUNTA';

  if (input.actaDatos) {
    // Determinar tipo esperado y pack de referencia para acta
    let actaPack: RulePack | undefined;
    for (const pack of packs) {
      const tipoEsperado = pack.acta.tipoActaPorModo[input.adoptionMode];
      if (tipoEsperado) {
        actaTipoEsperado = tipoEsperado;
        actaPack = pack;
        break;
      }
    }
    // Fallback al primer pack si ninguno tiene tipo específico
    if (!actaPack && packs.length > 0) {
      actaPack = packs[0];
    }

    // Validar tipo
    if (input.actaDatos.tipoActa !== actaTipoEsperado) {
      actaValida = false;
      blockingIssues.push(
        `Tipo acta incorrecto: esperado ${actaTipoEsperado}, obtenido ${input.actaDatos.tipoActa}`
      );
      explain.push({
        regla: 'tipo_acta_correcto',
        fuente: 'LEY',
        resultado: 'BLOCKING',
        mensaje: `Tipo acta incorrecto para modo ${input.adoptionMode}`,
      });
    }

    // Validar contenido mínimo según tipo y modo
    if (actaPack) {
      const contentMinimo = actaPack.acta.contenidoMinimo;
      let camposRequeridos: string[] = [];

      if (
        input.adoptionMode === 'MEETING' ||
        input.adoptionMode === 'UNIVERSAL'
      ) {
        camposRequeridos = contentMinimo.sesion;
      } else if (
        input.adoptionMode === 'UNIPERSONAL_SOCIO' ||
        input.adoptionMode === 'UNIPERSONAL_ADMIN'
      ) {
        camposRequeridos = contentMinimo.consignacion;
      } else if (input.adoptionMode === 'NO_SESSION') {
        camposRequeridos = contentMinimo.acuerdoEscrito;
      }

      const camposFaltantes: string[] = [];
      for (const campo of camposRequeridos) {
        if (!input.actaDatos.campos[campo]) {
          camposFaltantes.push(campo);
        }
      }

      if (camposFaltantes.length > 0) {
        actaValida = false;
        blockingIssues.push(
          `Campos de acta faltantes: ${camposFaltantes.join(', ')}`
        );
        explain.push({
          regla: 'contenido_minimo_acta',
          fuente: 'LEY',
          resultado: 'BLOCKING',
          mensaje: `Acta incompleta: campos faltantes ${camposFaltantes.join(', ')}`,
        });
      } else {
        explain.push({
          regla: 'contenido_minimo_acta',
          fuente: 'LEY',
          resultado: 'OK',
          mensaje: `Acta completa con ${camposRequeridos.length} campos requeridos`,
        });
      }

      // Validar transcripción si requerida
      if (actaPack.acta.requiereTranscripcionLibroActas && !input.actaDatos.transcripcionRealizada) {
        warnings.push(
          'Acta requiere transcripción a libro obligatorio pero aún no realizada'
        );
        explain.push({
          regla: 'transcripcion_libro_obligatoria',
          fuente: 'LEY',
          referencia: 'art. 208 LSC',
          resultado: 'WARNING',
          mensaje: 'Transcripción a libro obligatorio pendiente',
        });
      }

      // Validar conformidad conjunta si requerida
      if (
        actaPack.acta.requiereConformidadConjunta &&
        !input.actaDatos.conformidadConjuntaObtenida
      ) {
        actaValida = false;
        blockingIssues.push('Conformidad conjunta requerida pero no obtenida');
        explain.push({
          regla: 'conformidad_conjunta_requerida',
          fuente: 'ESTATUTOS',
          resultado: 'BLOCKING',
          mensaje: 'Acta requiere conformidad conjunta de administradores',
        });
      }
    }
  }

  return {
    etapa: 'documentacion',
    ok: blockingIssues.length === 0,
    severity: blockingIssues.length > 0 ? 'BLOCKING' : warnings.length > 0 ? 'WARNING' : 'OK',
    explain,
    blocking_issues: blockingIssues,
    warnings,
    documentosFaltantes,
    actaValida,
    actaTipoEsperado,
  };
}

/**
 * Evaluación especializada de acta (exportada por si es necesaria de forma aislada)
 */
export function evaluarActa(
  tipoActa: TipoActa,
  adoptionMode: AdoptionMode,
  campos: Record<string, boolean>,
  pack: RulePack
): { valida: boolean; explain: ExplainNode[]; blocking: string[] } {
  const explain: ExplainNode[] = [];
  const blocking: string[] = [];

  const tipoEsperado = pack.acta.tipoActaPorModo[adoptionMode];
  if (tipoEsperado && tipoActa !== tipoEsperado) {
    blocking.push(`Tipo acta incorrecto: esperado ${tipoEsperado}, obtenido ${tipoActa}`);
    explain.push({
      regla: 'tipo_acta_correcto',
      fuente: 'LEY',
      resultado: 'BLOCKING',
      mensaje: `Tipo acta incorrecto para ${adoptionMode}`,
    });
  }

  let contentMinimo: string[] = [];
  if (adoptionMode === 'MEETING' || adoptionMode === 'UNIVERSAL') {
    contentMinimo = pack.acta.contenidoMinimo.sesion;
  } else if (adoptionMode === 'UNIPERSONAL_SOCIO' || adoptionMode === 'UNIPERSONAL_ADMIN') {
    contentMinimo = pack.acta.contenidoMinimo.consignacion;
  } else if (adoptionMode === 'NO_SESSION') {
    contentMinimo = pack.acta.contenidoMinimo.acuerdoEscrito;
  }

  const camposFaltantes: string[] = [];
  for (const campo of contentMinimo) {
    if (!campos[campo]) {
      camposFaltantes.push(campo);
    }
  }

  if (camposFaltantes.length > 0) {
    blocking.push(`Campos faltantes: ${camposFaltantes.join(', ')}`);
    explain.push({
      regla: 'contenido_minimo_acta',
      fuente: 'LEY',
      resultado: 'BLOCKING',
      mensaje: `Campos faltantes: ${camposFaltantes.join(', ')}`,
    });
  }

  return {
    valida: blocking.length === 0,
    explain,
    blocking,
  };
}
