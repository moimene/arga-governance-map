import { Link } from "react-router-dom";
import { FileCheck2 } from "lucide-react";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useHasCapability } from "@/hooks/useCapabilityMatrix";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";

export interface StandaloneCertificationAction {
  kindCode: string;
  label: string;
  description?: string;
  entityId?: string | null;
  bodyId?: string | null;
  personId?: string | null;
  conditionId?: string | null;
  bookId?: string | null;
  movementId?: string | null;
  agreementId?: string | null;
  decisionId?: string | null;
}

function appendParam(params: URLSearchParams, key: string, value?: string | null) {
  if (value) params.set(key, value);
}

function buildCertificationPath(action: StandaloneCertificationAction) {
  const params = new URLSearchParams();
  params.set("kind", action.kindCode);
  appendParam(params, "entity", action.entityId);
  appendParam(params, "body", action.bodyId);
  appendParam(params, "person", action.personId);
  appendParam(params, "condition", action.conditionId);
  appendParam(params, "book", action.bookId);
  appendParam(params, "movement", action.movementId);
  appendParam(params, "agreement", action.agreementId);
  appendParam(params, "decision", action.decisionId);
  return `/secretaria/certificaciones?${params.toString()}`;
}

export function StandaloneCertificationActions({
  title = "Certificaciones autónomas",
  actions,
  compact = false,
}: {
  title?: string;
  actions: StandaloneCertificationAction[];
  compact?: boolean;
}) {
  const scope = useSecretariaScope();
  const { primaryRole } = useCurrentUserRole();
  const canCertify = useHasCapability(primaryRole, "CERTIFICATION");
  const visibleActions = actions.filter((action) => action.entityId || action.kindCode === "CERT_DECISION_SOCIO_UNICO");
  if (!visibleActions.length || !canCertify) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {visibleActions.map((action) => (
          <Link
            key={`${action.kindCode}-${action.entityId ?? "none"}-${action.personId ?? action.bookId ?? action.conditionId ?? "all"}`}
            to={scope.createScopedTo(buildCertificationPath(action))}
            className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <FileCheck2 className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
            {action.label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
        <FileCheck2 className="h-4 w-4 text-[var(--g-brand-3308)]" />
        {title}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visibleActions.map((action) => (
          <Link
            key={`${action.kindCode}-${action.entityId ?? "none"}-${action.personId ?? action.bookId ?? action.conditionId ?? "all"}`}
            to={scope.createScopedTo(buildCertificationPath(action))}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm transition-colors hover:border-[var(--g-brand-3308)] hover:bg-[var(--g-sec-100)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <span className="flex items-center gap-2 font-semibold text-[var(--g-text-primary)]">
              <FileCheck2 className="h-4 w-4 text-[var(--g-brand-3308)]" />
              {action.label}
            </span>
            {action.description ? (
              <span className="mt-1 block text-xs leading-5 text-[var(--g-text-secondary)]">{action.description}</span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
