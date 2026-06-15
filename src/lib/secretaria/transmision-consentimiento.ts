/**
 * A.1 (Comité Legal, memo junio 2026) — Régimen de consentimiento en la transmisión
 * de participaciones/acciones.
 *
 * SL/SLU (arts. 106-107 LSC): la transmisión voluntaria por actos inter vivos está
 * sujeta al régimen de consentimiento de la sociedad salvo supuesto de libre
 * transmisión. El expediente no debe quedar limpio hasta que conste UNA de tres vías:
 *   1) transmisión LIBRE debidamente soportada (excepción del art. 107.1),
 *   2) consentimiento/acuerdo social (régimen supletorio art. 107.2), o
 *   3) excepción estatutaria documentada.
 * Comportamiento: WARNING resoluble durante el flujo; BLOQUEO en cierre/promoción si
 * no consta ninguna vía o si la excepción declarada es internamente inconsistente.
 *
 * SA/SAU (art. 123 LSC): libre transmisión por defecto; si hay restricción
 * estatutaria, se ADVIERTE (no bloquea) para revisión.
 *
 * Lógica pura y testeable. La verificación "entre socios" usa el cap table (el caller
 * pasa destinoEsSocio). La relación de grupo / parentesco no es auto-verificable: se
 * exige soporte documental (referencia) y, si falta, se advierte.
 */
export type ExcepcionLibre = "ENTRE_SOCIOS" | "FAMILIAR" | "GRUPO" | "ESTATUTARIA";

export interface TransmisionConsentInput {
  esSL: boolean;
  tipoTransmision: "LIBRE" | "ONEROSA" | "";
  excepcionLibre: ExcepcionLibre | null;
  referenciaEstatutaria: string;
  consentimientoRef: string;
  restriccionEstatutariaSA: boolean;
  destinoEsSocio: boolean;
}

export interface TransmisionConsentResult {
  severity: "OK" | "WARNING" | "BLOCKING";
  blockingAtClose: boolean;
  issues: string[];
  legalBasis: string;
}

function has(value: string): boolean {
  return !!value && value.trim().length > 0;
}

export function evaluarTransmisionConsentimiento(
  input: TransmisionConsentInput,
): TransmisionConsentResult {
  // ── SA / SAU ──────────────────────────────────────────────────────────────
  if (!input.esSL) {
    if (input.restriccionEstatutariaSA && !has(input.referenciaEstatutaria)) {
      return {
        severity: "WARNING",
        blockingAtClose: false,
        issues: [
          "Se ha indicado restricción estatutaria a la transmisión: revise la cláusula y aporte su referencia antes de registrar.",
        ],
        legalBasis: "art. 123 LSC",
      };
    }
    return { severity: "OK", blockingAtClose: false, issues: [], legalBasis: "art. 123 LSC" };
  }

  // ── SL / SLU ──────────────────────────────────────────────────────────────
  const block = (issue: string): TransmisionConsentResult => ({
    severity: "WARNING", // resoluble durante el flujo; el bloqueo se aplica en cierre
    blockingAtClose: true,
    issues: [issue],
    legalBasis: "arts. 106-107 LSC",
  });

  if (input.tipoTransmision === "ONEROSA") {
    if (has(input.consentimientoRef)) {
      return { severity: "OK", blockingAtClose: false, issues: [], legalBasis: "art. 107.2 LSC" };
    }
    return block(
      "Transmisión onerosa de participaciones SL sin consentimiento de la sociedad: aporte el acuerdo/consentimiento social o marque un supuesto de libre transmisión (art. 107.2 LSC).",
    );
  }

  if (input.tipoTransmision === "LIBRE") {
    if (input.excepcionLibre === null) {
      return block(
        "Transmisión marcada como libre sin indicar el supuesto de libre transmisión del art. 107.1 LSC.",
      );
    }
    if (input.excepcionLibre === "ENTRE_SOCIOS" && !input.destinoEsSocio) {
      return block(
        "Excepción 'entre socios' declarada, pero el adquirente no figura como socio en el libro registro / cap table.",
      );
    }
    if (input.excepcionLibre === "ESTATUTARIA" && !has(input.referenciaEstatutaria)) {
      return block(
        "Excepción estatutaria de libre transmisión sin referencia estatutaria de soporte (art. 108 LSC).",
      );
    }
    if (
      (input.excepcionLibre === "FAMILIAR" || input.excepcionLibre === "GRUPO") &&
      !has(input.referenciaEstatutaria) &&
      !has(input.consentimientoRef)
    ) {
      // No es auto-verificable: se permite continuar pero se advierte que conviene soporte.
      return {
        severity: "WARNING",
        blockingAtClose: false,
        issues: [
          "Supuesto de libre transmisión (familiar/grupo) sin documento de soporte: se recomienda aportar acreditación del vínculo.",
        ],
        legalBasis: "art. 107.1 LSC",
      };
    }
    return { severity: "OK", blockingAtClose: false, issues: [], legalBasis: "art. 107.1 LSC" };
  }

  // tipoTransmision === ""  → régimen no indicado
  return block(
    "Indique el régimen de la transmisión (libre o sujeta a consentimiento de la sociedad) para una sociedad limitada (arts. 106-107 LSC).",
  );
}
