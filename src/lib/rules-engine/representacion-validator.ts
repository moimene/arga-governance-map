// ITEM-099 — Validación legal de representaciones
/**
 * Motor de Validación de Representaciones (LSC)
 *
 * Función pura que valida dos figuras de representación distintas:
 *
 * A) PROXY DE JUNTA GENERAL (arts. 183-187 LSC):
 *    - SL (art. 183): círculo restringido de representantes (cónyuge,
 *      ascendiente/descendiente, otro socio, o apoderado con poder general
 *      en documento público). Representación con carácter especial para
 *      cada junta salvo poder general en documento público.
 *    - SA (art. 184): representación por escrito o por medios de comunicación
 *      a distancia, con carácter especial para cada junta. El representante
 *      puede ser cualquier persona (no limitado a socios).
 *    - Forma escrita y revocabilidad (art. 185): la representación siempre es
 *      revocable; la asistencia personal del representado revoca el poder.
 *    - Conflicto de intereses en cotizada (art. 523 LSC): cuando el
 *      representante esté en situación de conflicto, debe informar y contar
 *      con instrucciones de voto precisas.
 *
 * B) DELEGACIÓN EN CONSEJO DE ADMINISTRACIÓN (art. 529 quáter LSC, cotizada):
 *    - El consejero solo puede delegar su representación en otro consejero.
 *    - Los consejeros no ejecutivos solo pueden hacerlo en otro no ejecutivo.
 *
 * Función pura: sin side effects, sin DB, sin imports React/Supabase.
 */

export type RepresentacionSeverity = 'BLOCKING' | 'WARNING' | 'INFO';
export type RepresentacionStatus = 'VALIDA' | 'INVALIDA' | 'ADVERTENCIA';

export interface RepresentacionHallazgo {
  id: string;
  nombre: string;
  referenciaLegal: string;
  severity: RepresentacionSeverity;
  status: RepresentacionStatus;
  detalle: string;
}

export interface RepresentacionValidacionResult {
  valida: boolean;
  hallazgos: RepresentacionHallazgo[];
}

// ─── A) Proxy de junta general (arts. 183-187 LSC) ───────────────────────────

/** Vínculo del representante con el socio representado en junta SL (art. 183 LSC). */
export type VinculoRepresentanteSL =
  | 'CONYUGE'
  | 'ASCENDIENTE'
  | 'DESCENDIENTE'
  | 'OTRO_SOCIO'
  | 'APODERADO_GENERAL_DOC_PUBLICO'
  | 'TERCERO'; // no permitido en SL salvo previsión estatutaria

export interface ProxyJuntaInput {
  tipoSocial: 'SA' | 'SL';
  esCotizada?: boolean;
  /** Vínculo del representante con el socio (relevante para el círculo SL). */
  vinculoRepresentante?: VinculoRepresentanteSL;
  /** Existe documento de representación por escrito (arts. 183/184 LSC). */
  representacionPorEscrito?: boolean;
  /** El poder es especial para esta junta o general en documento público. */
  caracterEspecialOGeneralDocPublico?: boolean;
  /** El poder es revocable (siempre debe serlo — art. 185 LSC). */
  revocable?: boolean;
  /** En SL, los estatutos amplían el círculo del art. 183 a terceros. */
  estatutosAmplianCirculoSL?: boolean;
  /** En cotizada, el representante está en situación de conflicto (art. 523 LSC). */
  representanteEnConflicto?: boolean;
  /** En cotizada con conflicto, hay instrucciones de voto precisas (art. 523 LSC). */
  instruccionesVotoPrecisas?: boolean;
  /** Referencia documental del apoderamiento (rastro probatorio para el acta). */
  referenciaDocumentoRepresentacion?: string | null;
}

/**
 * Valida un proxy de representación en junta general según arts. 183-187 LSC.
 * Pure function.
 */
export function validarProxyJunta(
  input: ProxyJuntaInput
): RepresentacionValidacionResult {
  const hallazgos: RepresentacionHallazgo[] = [];

  // 1. Forma escrita (arts. 183.2 / 184.2 LSC)
  if (input.representacionPorEscrito === false) {
    hallazgos.push({
      id: 'PROXY_FORMA_ESCRITA_FALTA',
      nombre: 'Representación sin forma escrita',
      referenciaLegal:
        input.tipoSocial === 'SA' ? 'art. 184.2 LSC' : 'art. 183.2 LSC',
      severity: 'BLOCKING',
      status: 'INVALIDA',
      detalle:
        'La representación en junta debe conferirse por escrito (o por medios de comunicación a distancia en SA). Falta el documento de apoderamiento.',
    });
  }

  // 2. Carácter especial para cada junta (arts. 183.2 / 184.2 LSC)
  if (input.caracterEspecialOGeneralDocPublico === false) {
    hallazgos.push({
      id: 'PROXY_CARACTER_ESPECIAL_FALTA',
      nombre: 'Representación sin carácter especial para esta junta',
      referenciaLegal:
        input.tipoSocial === 'SA' ? 'art. 184.2 LSC' : 'art. 183.2 LSC',
      severity: 'BLOCKING',
      status: 'INVALIDA',
      detalle:
        'La representación debe ser especial para cada junta, salvo que se trate de poder general conferido en documento público con facultades para administrar el patrimonio.',
    });
  }

  // 3. Revocabilidad (art. 185 LSC)
  if (input.revocable === false) {
    hallazgos.push({
      id: 'PROXY_IRREVOCABLE',
      nombre: 'Representación pactada como irrevocable',
      referenciaLegal: 'art. 185 LSC',
      severity: 'BLOCKING',
      status: 'INVALIDA',
      detalle:
        'La representación es siempre revocable. La asistencia personal del representado a la junta revoca el poder otorgado.',
    });
  }

  // 4. Círculo de representantes en SL (art. 183 LSC)
  if (input.tipoSocial === 'SL' && input.vinculoRepresentante !== undefined) {
    const circuloPermitidoSL: VinculoRepresentanteSL[] = [
      'CONYUGE',
      'ASCENDIENTE',
      'DESCENDIENTE',
      'OTRO_SOCIO',
      'APODERADO_GENERAL_DOC_PUBLICO',
    ];
    if (!circuloPermitidoSL.includes(input.vinculoRepresentante)) {
      // Tercero fuera del círculo del art. 183: solo válido si los estatutos lo amplían
      if (input.estatutosAmplianCirculoSL === true) {
        hallazgos.push({
          id: 'PROXY_SL_TERCERO_AMPLIADO_ESTATUTOS',
          nombre: 'Representante fuera del círculo del art. 183 — ampliado por estatutos',
          referenciaLegal: 'art. 183.1 LSC',
          severity: 'WARNING',
          status: 'ADVERTENCIA',
          detalle:
            'El representante no pertenece al círculo legal del art. 183 LSC; se admite porque los estatutos amplían la facultad de representación. Verificar la cláusula estatutaria habilitante.',
        });
      } else {
        hallazgos.push({
          id: 'PROXY_SL_FUERA_CIRCULO',
          nombre: 'Representante fuera del círculo permitido en SL',
          referenciaLegal: 'art. 183.1 LSC',
          severity: 'BLOCKING',
          status: 'INVALIDA',
          detalle:
            'En la SL el socio solo puede hacerse representar por su cónyuge, ascendiente o descendiente, por otro socio o por apoderado con poder general en documento público, salvo previsión estatutaria que amplíe el círculo.',
        });
      }
    }
  }

  // 5. SA: el representante puede ser cualquier persona (art. 184 LSC) — nota informativa
  if (input.tipoSocial === 'SA' && input.vinculoRepresentante === 'TERCERO') {
    hallazgos.push({
      id: 'PROXY_SA_TERCERO_ADMITIDO',
      nombre: 'Representación por tercero admitida en SA',
      referenciaLegal: 'art. 184.1 LSC',
      severity: 'INFO',
      status: 'VALIDA',
      detalle:
        'En la SA el accionista puede hacerse representar por cualquier persona, aunque no sea accionista, salvo restricción estatutaria.',
    });
  }

  // 6. Conflicto de intereses en cotizada (art. 523 LSC)
  if (input.esCotizada === true && input.representanteEnConflicto === true) {
    if (input.instruccionesVotoPrecisas === true) {
      hallazgos.push({
        id: 'PROXY_COTIZADA_CONFLICTO_CON_INSTRUCCIONES',
        nombre: 'Conflicto del representante — con instrucciones de voto',
        referenciaLegal: 'art. 523 LSC',
        severity: 'WARNING',
        status: 'ADVERTENCIA',
        detalle:
          'El representante está en situación de conflicto de intereses; ejerce el voto conforme a instrucciones precisas del representado. Documentar la divulgación previa del conflicto.',
      });
    } else {
      hallazgos.push({
        id: 'PROXY_COTIZADA_CONFLICTO_SIN_INSTRUCCIONES',
        nombre: 'Conflicto del representante — sin instrucciones de voto',
        referenciaLegal: 'art. 523 LSC',
        severity: 'BLOCKING',
        status: 'INVALIDA',
        detalle:
          'En sociedad cotizada, si el representante está en conflicto de intereses no puede ejercer el voto sin instrucciones de voto precisas del representado para cada punto del orden del día (art. 523 LSC).',
      });
    }
  }

  // 7. Rastro probatorio del apoderamiento (referencia documental para el acta)
  const referencia = input.referenciaDocumentoRepresentacion;
  if (referencia === null || referencia === undefined || referencia.trim() === '') {
    hallazgos.push({
      id: 'PROXY_SIN_REFERENCIA_DOCUMENTAL',
      nombre: 'Representación sin referencia documental para el acta',
      referenciaLegal: 'art. 186 LSC',
      severity: 'WARNING',
      status: 'ADVERTENCIA',
      detalle:
        'No se ha capturado una referencia al documento de representación. El acta y el snapshot deben dejar rastro probatorio del apoderamiento que sustenta el quórum.',
    });
  }

  return {
    valida: !hallazgos.some((h) => h.severity === 'BLOCKING'),
    hallazgos,
  };
}

// ─── B) Delegación en consejo (art. 529 quáter LSC, cotizada) ─────────────────

/** Carácter del consejero a efectos de delegación (art. 529 quáter LSC). */
export type CaracterConsejero = 'EJECUTIVO' | 'NO_EJECUTIVO';

export interface DelegacionConsejoInput {
  esCotizada: boolean;
  /** Carácter del consejero que delega (representado). */
  caracterDelegante?: CaracterConsejero;
  /** Carácter del consejero en quien se delega (delegado). */
  caracterDelegado?: CaracterConsejero;
  /** El delegado es miembro del propio consejo de administración. */
  delegadoEsConsejero?: boolean;
  /** Referencia documental de la delegación (rastro probatorio para el acta). */
  referenciaDocumentoDelegacion?: string | null;
}

/**
 * Valida una delegación de representación en el consejo de administración
 * según el art. 529 quáter LSC (sociedad cotizada).
 * Pure function.
 */
export function validarDelegacionConsejo(
  input: DelegacionConsejoInput
): RepresentacionValidacionResult {
  const hallazgos: RepresentacionHallazgo[] = [];

  // 1. El delegado debe ser otro consejero (regla general de delegación en consejo)
  if (input.delegadoEsConsejero === false) {
    hallazgos.push({
      id: 'CONSEJO_DELEGADO_NO_ES_CONSEJERO',
      nombre: 'Delegación en quien no es consejero',
      referenciaLegal: 'art. 529 quáter LSC',
      severity: 'BLOCKING',
      status: 'INVALIDA',
      detalle:
        'El consejero solo puede delegar su representación en otro miembro del consejo de administración.',
    });
  }

  // 2. En cotizada, el no ejecutivo solo puede delegar en otro no ejecutivo (art. 529 quáter LSC)
  if (
    input.esCotizada === true &&
    input.caracterDelegante === 'NO_EJECUTIVO' &&
    input.caracterDelegado === 'EJECUTIVO'
  ) {
    hallazgos.push({
      id: 'CONSEJO_NO_EJECUTIVO_DELEGA_EN_EJECUTIVO',
      nombre: 'Consejero no ejecutivo delega en ejecutivo',
      referenciaLegal: 'art. 529 quáter LSC',
      severity: 'BLOCKING',
      status: 'INVALIDA',
      detalle:
        'En sociedad cotizada, los consejeros no ejecutivos solo pueden delegar su representación en otro consejero no ejecutivo (art. 529 quáter LSC).',
    });
  }

  // 3. Caso conforme en cotizada: no ejecutivo → no ejecutivo
  if (
    input.esCotizada === true &&
    input.caracterDelegante === 'NO_EJECUTIVO' &&
    input.caracterDelegado === 'NO_EJECUTIVO' &&
    input.delegadoEsConsejero !== false
  ) {
    hallazgos.push({
      id: 'CONSEJO_NO_EJECUTIVO_DELEGA_CONFORME',
      nombre: 'Delegación entre no ejecutivos — conforme',
      referenciaLegal: 'art. 529 quáter LSC',
      severity: 'INFO',
      status: 'VALIDA',
      detalle:
        'La delegación entre consejeros no ejecutivos cumple el art. 529 quáter LSC.',
    });
  }

  // 4. Rastro probatorio de la delegación (referencia documental para el acta)
  const referencia = input.referenciaDocumentoDelegacion;
  if (referencia === null || referencia === undefined || referencia.trim() === '') {
    hallazgos.push({
      id: 'CONSEJO_SIN_REFERENCIA_DOCUMENTAL',
      nombre: 'Delegación sin referencia documental para el acta',
      referenciaLegal: 'art. 529 quáter LSC',
      severity: 'WARNING',
      status: 'ADVERTENCIA',
      detalle:
        'No se ha capturado una referencia al documento de delegación. El acta debe dejar rastro probatorio de la delegación que sustenta el quórum del consejo.',
    });
  }

  return {
    valida: !hallazgos.some((h) => h.severity === 'BLOCKING'),
    hallazgos,
  };
}
