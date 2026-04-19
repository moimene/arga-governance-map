import { BPSection } from "./BPSection";
import { BoardPackAgreement } from "@/hooks/useBoardPackData";

interface BPAcuerdosProps {
  agreements: BoardPackAgreement[];
  votoCalidadPresidente?: boolean;
}

const STATUS_CHIP: Record<string, string> = {
  CERTIFIED:         "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  ADOPTED:           "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  PROPOSED:          "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  DRAFT:             "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
  REJECTED_REGISTRY: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

const KIND_LABEL: Record<string, string> = {
  APROBACION_CUENTAS:      "Aprobación de cuentas",
  NOMBRAMIENTO_CESE:       "Nombramiento / Cese",
  MOD_ESTATUTOS:           "Modificación estatutos",
  APROBACION_POLITICA:     "Aprobación política",
  DISTRIBUCION_RESULTADO:  "Distribución resultado",
  INFORMATIVO:             "Punto informativo",
};

export function BPAcuerdos({ agreements, votoCalidadPresidente }: BPAcuerdosProps) {
  if (agreements.length === 0) {
    return (
      <BPSection title="3. Propuestas de acuerdo">
        <p className="text-sm text-[var(--g-text-secondary)]">
          No hay acuerdos vinculados a esta sesión.
        </p>
      </BPSection>
    );
  }

  return (
    <BPSection title="3. Propuestas de acuerdo">
      <table className="w-full">
        <thead>
          <tr className="bg-[var(--g-surface-subtle)]">
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Tipo
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Política / Materia
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Fecha decisión
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Estado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {agreements.map((a) => (
            <tr key={a.id} className="hover:bg-[var(--g-surface-subtle)]/40 transition-colors">
              <td className="px-4 py-3 text-sm text-[var(--g-text-primary)]">
                {KIND_LABEL[a.agreement_kind] ?? a.agreement_kind}
              </td>
              <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                {a.policy_title ?? "—"}
              </td>
              <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                {a.decision_date
                  ? new Date(a.decision_date).toLocaleDateString("es-ES")
                  : "Pendiente"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                    STATUS_CHIP[a.status] ??
                    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  {a.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {votoCalidadPresidente && (
        <p className="mt-3 text-[11px] text-[var(--g-text-secondary)] border-t border-[var(--g-border-subtle)] pt-2">
          <span className="font-semibold text-[var(--status-warning)]">DL-5 — Voto de calidad:</span>{" "}
          El Presidente dispone de voto de calidad en caso de empate, conforme al reglamento del órgano.
        </p>
      )}
    </BPSection>
  );
}
