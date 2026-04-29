import { forwardRef } from "react";
import { Building2, Network } from "lucide-react";
import type { SecretariaScopeController } from "./types";

interface SecretariaHeaderProps {
  scope: SecretariaScopeController;
}

export const SecretariaHeader = forwardRef<HTMLElement, SecretariaHeaderProps>(({ scope }, ref) => {
  const Icon = scope.mode === "sociedad" ? Building2 : Network;
  const scopeLabel = scope.mode === "sociedad" ? scope.selectedEntity?.legalName ?? "Sociedad" : "Grupo ARGA Seguros";
  const scopeMeta =
    scope.mode === "sociedad" && scope.selectedEntity
      ? `${scope.selectedEntity.legalForm} · ${scope.selectedEntity.jurisdiction}`
      : "Vista de grupo y coordinación multi-sociedad";
  const modeLabel =
    scope.mode === "sociedad" ? "Modo Sociedad · vista filtrada a la sociedad" : "Modo Grupo · visión multi-sociedad";

  return (
    <header
      ref={ref}
      className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-6 py-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <nav
            aria-label="Ruta de navegación"
            className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--g-text-secondary)]"
          >
            <span>Secretaría Societaria</span>
            <span aria-hidden="true">›</span>
            <span className="font-medium text-[var(--g-link)]">{scopeLabel}</span>
            <span aria-hidden="true">›</span>
            <span className="font-semibold text-[var(--g-text-primary)]">{scope.currentSection}</span>
          </nav>

          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-[var(--g-text-primary)]">
                {scope.currentSection}
              </p>
              <p className="truncate text-sm text-[var(--g-text-secondary)]">{scopeMeta}</p>
            </div>
          </div>
        </div>

        <div
          className="inline-flex w-fit items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-page)] px-3 py-2 text-[12px] font-medium text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          <span
            className="h-2 w-2 bg-[var(--status-success)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
            aria-hidden="true"
          />
          {modeLabel}
        </div>
      </div>
    </header>
  );
});

SecretariaHeader.displayName = "SecretariaHeader";
