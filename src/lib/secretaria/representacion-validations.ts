/**
 * Validación de representaciones puntuales (poderes) a nivel UI/form.
 *
 * NO confundir con `src/lib/rules-engine/*` (motor LSC computacional). Estos
 * helpers se usan en el stepper de representación puntual
 * (`src/pages/secretaria/RepresentacionPuntualStepper.tsx`) para emitir
 * ADVERTENCIAS NO BLOQUEANTES sobre las restricciones legales de los poderes
 * JUNTA_PROXY (delegación de voto en junta) y CONSEJO_DELEGACION (delegación
 * entre consejeros).
 *
 * Política DL-2 (CLAUDE.md): el motor NO bloquea sociedades cotizadas — evalúa
 * y advierte. Aplicamos el mismo principio aquí: las restricciones de poder se
 * representan como warnings informativos, nunca como bloqueos del flujo. El
 * frontend no puede verificar parentesco ni el carácter concreto de cada
 * consejero de forma fiable, así que se recuerda la norma al secretario para su
 * comprobación documental.
 *
 * Cobertura legal:
 *
 *  - art. 183 LSC (SL — representación en junta): en sociedad de responsabilidad
 *    limitada el socio sólo puede hacerse representar en la junta por su
 *    cónyuge, ascendiente o descendiente, por otro socio o por persona que
 *    ostente poder general conferido en documento público con facultades para
 *    administrar todo el patrimonio que el representado tuviera en territorio
 *    nacional (círculo restringido). En SA el régimen es más abierto (art. 184
 *    LSC). Emitimos WARNING informativo recordando la restricción cuando el
 *    ámbito es JUNTA_PROXY y la sociedad es SL/SLU, porque no podemos verificar
 *    el parentesco ni la condición de socio del representante desde el form.
 *
 *  - art. 529 quáter LSC (sociedad cotizada — delegación en consejo): en el
 *    consejo de administración de una sociedad cotizada el consejero sólo podrá
 *    delegar su representación en otro consejero. Los consejeros no ejecutivos
 *    sólo podrán hacerlo en otro consejero no ejecutivo. Emitimos WARNING
 *    cuando el ámbito es CONSEJO_DELEGACION en sociedad cotizada y, además, un
 *    WARNING específico cuando el representado es consejero no ejecutivo y el
 *    representante es ejecutivo (delegación de distinto carácter prohibida).
 *
 *  - recordatorio de evidencia: capturar la referencia del documento de poder
 *    (escritura, delegación firmada o acta) para soportar la representación.
 */

export type RepresentacionScope = "JUNTA_PROXY" | "CONSEJO_DELEGACION";

export type RepresentacionTipoSocial = "SA" | "SL" | "SLU" | "SAU" | string | null;

export interface RepresentacionWarningInput {
  /** Ámbito del poder: delegación de voto en junta o delegación en consejo. */
  scope: RepresentacionScope;
  /** `true` si la sociedad emisora es cotizada (activa art. 529 quáter). */
  entityIsCotizada: boolean;
  /** Tipo social de la sociedad emisora (SA/SL/SLU/SAU). Activa art. 183 en SL. */
  entityTipoSocial: RepresentacionTipoSocial;
  /** `true` si el representante es miembro vigente del consejo. */
  representanteEsConsejero: boolean;
  /** `true` si el representado es miembro vigente del consejo. */
  representadoEsConsejero: boolean;
  /** `true` si el representante tiene carácter ejecutivo en el consejo. */
  representanteEsEjecutivo: boolean;
  /** `true` si la referencia del documento de poder está informada. */
  documentoRefPresente?: boolean;
}

export interface RepresentacionWarning {
  /** Identificador estable para tests/selectores. */
  code: string;
  /** Artículo de referencia citado en el aviso. */
  articulo: string;
  /** Texto del aviso para mostrar al usuario. */
  message: string;
}

const TIPOS_SL: ReadonlyArray<string> = ["SL", "SLU"];

function esSL(tipoSocial: RepresentacionTipoSocial): boolean {
  if (!tipoSocial) return false;
  return TIPOS_SL.includes(tipoSocial.toUpperCase());
}

/**
 * Devuelve la lista de advertencias NO BLOQUEANTES para una representación
 * puntual. Una lista vacía significa que no se han detectado restricciones
 * legales aplicables a advertir. Función pura, sin efectos secundarios.
 */
export function evaluateRepresentacionWarnings(
  input: RepresentacionWarningInput,
): RepresentacionWarning[] {
  const warnings: RepresentacionWarning[] = [];

  // art. 183 LSC — círculo restringido de representación en junta (SL).
  if (input.scope === "JUNTA_PROXY" && esSL(input.entityTipoSocial)) {
    warnings.push({
      code: "ART_183_LSC_SL_CIRCULO_RESTRINGIDO",
      articulo: "art. 183 LSC",
      message:
        "En sociedad limitada la representación del socio en la junta se restringe a su cónyuge, ascendiente o descendiente, a otro socio o a quien ostente poder general en documento público (art. 183 LSC). Verifica que el representante pertenece a ese círculo antes de inscribir el poder.",
    });
  }

  // art. 529 quáter LSC — delegación en el consejo de sociedad cotizada.
  if (input.scope === "CONSEJO_DELEGACION" && input.entityIsCotizada) {
    if (!input.representanteEsConsejero) {
      warnings.push({
        code: "ART_529_QUATER_LSC_DELEGADO_NO_CONSEJERO",
        articulo: "art. 529 quáter LSC",
        message:
          "En el consejo de una sociedad cotizada el consejero sólo puede delegar su representación en otro consejero (art. 529 quáter LSC). Confirma que el representante es consejero vigente del órgano.",
      });
    }

    // Consejero no ejecutivo sólo puede delegar en otro no ejecutivo.
    if (
      input.representadoEsConsejero &&
      input.representanteEsConsejero &&
      input.representanteEsEjecutivo
    ) {
      warnings.push({
        code: "ART_529_QUATER_LSC_CARACTER_DISTINTO",
        articulo: "art. 529 quáter LSC",
        message:
          "Un consejero no ejecutivo sólo puede delegar su representación en otro consejero no ejecutivo (art. 529 quáter LSC). El representante seleccionado tiene carácter ejecutivo: revisa el carácter del representado antes de continuar.",
      });
    }
  }

  // Recordatorio de evidencia: referencia del documento de poder.
  if (input.documentoRefPresente === false) {
    warnings.push({
      code: "EVIDENCIA_DOCUMENTO_PODER",
      articulo: "evidencia",
      message:
        "Captura la referencia del documento de poder (escritura, delegación firmada o acta) para soportar la representación.",
    });
  }

  return warnings;
}
