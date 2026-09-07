/**
 * Construcción del payload de un autodiagnóstico AESIA.
 *
 * Vive aquí, separado de la pantalla, porque es la pieza que decide qué se
 * PERSISTE: antes imputaba `L5` a toda medida no respondida y marcaba el
 * requisito `CONFORME`, de modo que enviar el formulario sin contestar nada
 * escribía en base de datos 84 findings en nivel alto y todos los requisitos
 * conformes. Un badge equivocado se repinta; una fila equivocada se queda.
 *
 * Regla: **lo no contestado no se evalúa**. No genera finding, y su requisito
 * queda `PENDIENTE` mientras no estén todas sus medidas respondidas.
 *
 * TRES CAMPOS QUE SE RECOGÍAN Y SE TIRABAN (medido el 2026-09-07 sobre el
 * primer alta real, Harvey en el tenant Garrigues)
 * ------------------------------------------------------------------------
 * El finding persistido era `{code, title, status, planCode}` y nada más:
 *
 *   1. `difficulty` — el formulario pide graduar la dificultad de las 84
 *      medidas y ninguna llegaba a la fila.
 *   2. `justification` — peor: `MATURITY_LEVELS.L8` declara
 *      `requiresJustification: true`, la pantalla la pide con asterisco de
 *      obligatoria… y se descartaba. Una exención sin motivo era
 *      indistinguible de una motivada.
 *   3. las **Medidas Adicionales (MA)** — se añadían, se pintaban en su
 *      requisito, y `buildEvaluationPayload` sólo recorría el catálogo, así
 *      que desaparecían al enviar.
 *
 * De ahí sale la regla de conformidad de `acreditaConformidad`: `L8` sin
 * justificación NO acredita no-aplicabilidad. No es una regla nueva inventada
 * aquí — es la que el catálogo ya declaraba y que nadie podía cumplir porque
 * el dato no se guardaba.
 */
import { calculateAdaptationPlan } from "./catalog-aesia";
import { acreditaConformidad } from "./conformidad";

// El criterio vive en `./conformidad`, que es hoja. Se re-exporta porque
// `readiness.ts` y las pantallas ya lo importaban desde aquí.
export {
  NIVELES_CONFORMES,
  NIVEL_NO_APLICABLE,
  MOTIVO_L8_SIN_JUSTIFICAR,
  acreditaConformidad,
} from "./conformidad";

export type EstadoMedida = {
  maturity?: string;
  /** `''` = sin evaluar. NO tiene valor por defecto: ver `DIFFICULTY_LEVELS`. */
  difficulty?: string;
  justification?: string;
};

export type MedidaRef = { id: string; description: string; requirementCode?: string };

/** Medida que quien evalúa añade a un requisito porque el catálogo no la trae. */
export type MedidaAdicionalRef = {
  id: string;
  description: string;
  requirementCode: string;
  subpartId: string;
};

export type RequisitoRef = {
  code: string;
  title: string;
  description?: string;
  measures: { id: string }[];
};

export type EvaluationFinding = {
  code: string;
  title: string;
  /** Nivel de madurez `L1`…`L8`. El nombre `status` es el que ya está en Cloud. */
  status: string;
  planCode: string;
  /** `'00'|'01'|'02'`, o `null` cuando nadie la graduó. */
  difficulty: string | null;
  /** Motivo de la no-aplicabilidad. `null` si no se aportó. */
  justification: string | null;
  /** `MG` = del catálogo; `MA` = añadida por quien evalúa. */
  kind: "MG" | "MA";
  requirementCode: string;
  /** Sólo las `MA` lo llevan: el catálogo no las conoce y hay que recolocarlas. */
  subpartId?: string;
};

export type EvaluationCheck = {
  requirement_code: string;
  requirement_title: string;
  description?: string;
  /**
   * `PENDIENTE` y no un valor nuevo: el vocabulario ya existe en la columna,
   * tiene chip en `SistemaDetalle` y `readiness.ts` lo cuenta como brecha
   * abierta. Un `NO_EVALUADO` inventado no lo contaría — un requisito sin
   * evaluar dejaría de figurar como hueco, que es el sesgo que este cambio
   * viene a corregir.
   */
  status: "CONFORME" | "NO_CONFORME" | "PENDIENTE";
  /** Vacío a propósito: la evidencia la aporta quien evalúa, no la consola. */
  evidence_url: string;
  checked_at: string;
};

export type EvaluationPayload = {
  findings: EvaluationFinding[];
  checks: EvaluationCheck[];
  /** `BORRADOR` es el valor que ya usa la columna y que `readiness` vigila. */
  status: "CONFORME" | "CON_GAPS" | "BORRADOR";
  evaluadas: number;
  totales: number;
};

function contestada(e: EstadoMedida | undefined): e is EstadoMedida & { maturity: string } {
  return Boolean(e?.maturity);
}

const limpio = (v: string | undefined | null): string | null => {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
};

function aFinding(
  medida: { id: string; description: string; requirementCode?: string; subpartId?: string },
  estado: EstadoMedida & { maturity: string },
  kind: "MG" | "MA",
): EvaluationFinding {
  return {
    code: medida.id,
    title: medida.description,
    status: estado.maturity,
    planCode: calculateAdaptationPlan(estado.maturity).code,
    difficulty: limpio(estado.difficulty),
    justification: limpio(estado.justification),
    kind,
    requirementCode: medida.requirementCode ?? "",
    ...(kind === "MA" && medida.subpartId ? { subpartId: medida.subpartId } : {}),
  };
}

export function buildEvaluationPayload(
  evaluations: Record<string, EstadoMedida | undefined>,
  allMeasures: MedidaRef[],
  requirements: RequisitoRef[],
  checkedAt: string = new Date().toISOString().slice(0, 10),
  /**
   * Las MA se evalúan por el MISMO mapa `evaluations` que las MG: así el
   * autoguardado, las estadísticas y este payload las tratan igual y no hay una
   * segunda ruta por la que se pierdan.
   */
  additionalMeasures: MedidaAdicionalRef[] = [],
): EvaluationPayload {
  // Sólo las medidas efectivamente contestadas generan finding.
  const findingsMG: EvaluationFinding[] = allMeasures
    .filter((m) => contestada(evaluations[m.id]))
    .map((m) => aFinding(m, evaluations[m.id] as EstadoMedida & { maturity: string }, "MG"));

  const findingsMA: EvaluationFinding[] = additionalMeasures
    .filter((ma) => contestada(evaluations[ma.id]))
    .map((ma) => aFinding(ma, evaluations[ma.id] as EstadoMedida & { maturity: string }, "MA"));

  const findings = [...findingsMG, ...findingsMA];

  const maPorRequisito = new Map<string, MedidaAdicionalRef[]>();
  additionalMeasures.forEach((ma) => {
    maPorRequisito.set(ma.requirementCode, [...(maPorRequisito.get(ma.requirementCode) ?? []), ma]);
  });

  const checks: EvaluationCheck[] = requirements.map((req) => {
    // Una MA añadida a un requisito cuenta para ese requisito: si no, añadirla
    // no tendría ninguna consecuencia y volvería a ser decoración.
    const ids = [
      ...req.measures.map((m) => m.id),
      ...(maPorRequisito.get(req.code) ?? []).map((ma) => ma.id),
    ];
    const estados = ids.map((id) => evaluations[id]);
    const completo = estados.length > 0 && estados.every(contestada);
    const conBrecha = estados.some((e) => contestada(e) && !acreditaConformidad({ status: e.maturity, justification: e.justification }));
    return {
      requirement_code: req.code,
      requirement_title: req.title,
      description: req.description,
      status: !completo ? "PENDIENTE" : conBrecha ? "NO_CONFORME" : "CONFORME",
      evidence_url: "",
      checked_at: checkedAt,
    };
  });

  const totales = allMeasures.length + additionalMeasures.length;
  const evaluadas = findings.length;
  const status: EvaluationPayload["status"] =
    evaluadas === 0
      ? "BORRADOR"
      : checks.some((c) => c.status === "NO_CONFORME") || evaluadas < totales
        ? "CON_GAPS"
        : "CONFORME";

  return { findings, checks, status, evaluadas, totales };
}

/**
 * Reconstruye el estado del wizard desde los findings persistidos.
 *
 * Es la otra mitad del borrador: sin esto, «guardar» sería escribir en un pozo.
 * El finding es round-trippable a propósito — lleva nivel, dificultad,
 * justificación, tipo y requisito.
 */
export type FindingPersistido = {
  code: string;
  status: string;
  title?: string;
  planCode?: string;
  difficulty?: string | null;
  justification?: string | null;
  kind?: "MG" | "MA";
  requirementCode?: string;
  subpartId?: string;
};

/** Los tres campos vienen siempre rellenos: el restaurador no deja huecos. */
export type EstadoMedidaCompleto = { maturity: string; difficulty: string; justification: string };

export function restoreEvaluationState(findings: FindingPersistido[] | null | undefined): {
  evaluations: Record<string, EstadoMedidaCompleto>;
  additionalMeasures: MedidaAdicionalRef[];
} {
  const evaluations: Record<string, EstadoMedidaCompleto> = {};
  const additionalMeasures: MedidaAdicionalRef[] = [];

  (findings ?? []).forEach((f) => {
    if (!f?.code) return;
    evaluations[f.code] = {
      maturity: f.status ?? "",
      difficulty: f.difficulty ?? "",
      justification: f.justification ?? "",
    };
    if (f.kind === "MA") {
      additionalMeasures.push({
        id: f.code,
        description: f.title ?? f.code,
        requirementCode: f.requirementCode ?? "",
        subpartId: f.subpartId ?? "",
      });
    }
  });

  return { evaluations, additionalMeasures };
}
