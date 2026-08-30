import { FileText, ExternalLink } from "lucide-react";

/**
 * El acta y la certificación acreditadas por su huella registral, para un
 * expediente que la plataforma NO puede emitir.
 *
 * `fn_secretaria_build_minute_legal_manifest` cierra a propósito la emisión de
 * acta autoritativa para toda Junta —`IF v_is_junta THEN RAISE EXCEPTION
 * '… economic Junta quorum requires the dedicated capital evaluator before
 * legal finalization'`— porque su modelo es el de un órgano colegiado de
 * asiento único: exige censo POLITICO y que la asistencia cubra cada asiento.
 * Una Junta de Socios vota por participaciones, no por asientos. Y sin acta no
 * hay certificación: `fn_generar_certificacion` exige un `p_minute_id` y la
 * variante sin sesión es un rechazo puro.
 *
 * Un expediente puede, aun así, acreditar que el acta existe: su huella es el
 * asiento registral, que es la consecuencia de haberse certificado. Esto es
 * ACREDITACION, no emisión. La plataforma sigue sin generar ninguna de las dos
 * y los contadores de `minutes` y `certifications` siguen a cero.
 *
 * Gateado por el dato: un expediente sin esta clave no pinta nada.
 */
export type ActaAcreditada = {
  asiento?: string;
  borme?: string;
  fecha_acta?: string;
  motivo_no_emision?: string;
  alcance?: string;
};

export function ActaAcreditadaNotice({
  acreditacion,
  contexto,
}: {
  acreditacion: unknown;
  contexto: "ficha" | "cierre";
}) {
  const a = acreditacion as ActaAcreditada | null | undefined;
  if (!a?.asiento) return null;

  return (
    <div
      className="border border-[var(--g-border-default)] bg-[var(--g-surface-subtle)]/40 p-4"
      style={{ borderRadius: "var(--g-radius-lg)" }}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
        <FileText className="h-4 w-4" aria-hidden />
        {contexto === "cierre"
          ? "El acta de esta sesión no se genera aquí"
          : "Acta y certificación acreditadas por su huella registral"}
      </p>

      <dl className="mt-3 space-y-1.5 text-xs">
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 font-medium text-[var(--g-text-secondary)]">Acta de</dt>
          <dd className="text-[var(--g-text-primary)]">{a.fecha_acta ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 font-medium text-[var(--g-text-secondary)]">Asiento registral</dt>
          <dd className="flex items-center gap-1.5 text-[var(--g-text-primary)]">
            {a.asiento}
            {a.borme ? (
              <span className="text-[var(--g-text-secondary)]">
                <ExternalLink className="mr-1 inline h-3 w-3" aria-hidden />
                BORME {a.borme}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      {a.motivo_no_emision ? (
        <p className="mt-3 text-xs leading-relaxed text-[var(--g-text-secondary)]">
          {a.motivo_no_emision}
        </p>
      ) : null}
      {a.alcance ? (
        <p className="mt-2 text-xs font-medium leading-relaxed text-[var(--g-text-primary)]">
          {a.alcance}
        </p>
      ) : null}
    </div>
  );
}
