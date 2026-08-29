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
 * queda `NO_EVALUADO` mientras no estén todas sus medidas respondidas.
 */
import { calculateAdaptationPlan } from "./catalog-aesia";

/**
 * Sólo `L5` («documentada e implementada») y `L8` («medida no necesaria para el
 * sistema») acreditan conformidad. El resto tiene algo sin hacer según los
 * títulos de la propia escala: L3 es «documentada, NO implementada» y L4
 * «implementación en curso».
 *
 * El código anterior sólo trataba L1/L2/L6 como brecha, así que un requisito
 * contestado entero con L3 se persistía CONFORME — conformidad no acreditada,
 * que es exactamente lo que esta tarea cierra. Se enumera lo que SÍ acredita,
 * no lo que falla: un nivel nuevo en la escala será brecha por defecto.
 */
const NIVELES_CONFORMES = new Set(["L5", "L8"]);

export type EstadoMedida = { maturity?: string; difficulty?: string };
export type MedidaRef = { id: string; description: string };
export type RequisitoRef = {
  code: string;
  title: string;
  description?: string;
  measures: { id: string }[];
};

export type EvaluationFinding = {
  code: string;
  title: string;
  status: string;
  planCode: string;
};

export type EvaluationCheck = {
  requirement_code: string;
  requirement_title: string;
  description?: string;
  /**
   * `PENDIENTE` y no un valor nuevo: el vocabulario ya existe en la columna,
   * tiene chip en `SistemaDetalle` y `readiness.ts:277` lo cuenta como brecha
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

export function buildEvaluationPayload(
  evaluations: Record<string, EstadoMedida | undefined>,
  allMeasures: MedidaRef[],
  requirements: RequisitoRef[],
  checkedAt: string = new Date().toISOString().slice(0, 10),
): EvaluationPayload {
  // Sólo las medidas efectivamente contestadas generan finding.
  const findings: EvaluationFinding[] = allMeasures
    .filter((m) => contestada(evaluations[m.id]))
    .map((m) => {
      const estado = evaluations[m.id] as EstadoMedida & { maturity: string };
      return {
        code: m.id,
        title: m.description,
        status: estado.maturity,
        planCode: calculateAdaptationPlan(estado.maturity).code,
      };
    });

  const checks: EvaluationCheck[] = requirements.map((req) => {
    const estados = req.measures.map((m) => evaluations[m.id]);
    const completo = estados.length > 0 && estados.every(contestada);
    const conBrecha = estados.some((e) => contestada(e) && !NIVELES_CONFORMES.has(e.maturity));
    return {
      requirement_code: req.code,
      requirement_title: req.title,
      description: req.description,
      status: !completo ? "PENDIENTE" : conBrecha ? "NO_CONFORME" : "CONFORME",
      evidence_url: "",
      checked_at: checkedAt,
    };
  });

  const evaluadas = findings.length;
  const status: EvaluationPayload["status"] =
    evaluadas === 0
      ? "BORRADOR"
      : checks.some((c) => c.status === "NO_CONFORME") || evaluadas < allMeasures.length
        ? "CON_GAPS"
        : "CONFORME";

  return { findings, checks, status, evaluadas, totales: allMeasures.length };
}
