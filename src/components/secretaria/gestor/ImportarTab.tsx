/**
 * ImportarTab — placeholder para el wizard de importación JSON.
 *
 * El importador real con schema Zod estricto + 5 pasos llega en Commit 6
 * del Sprint 1 (Tasks 6.1–6.6). Esta tab queda visible para ADMIN_TENANT
 * desde Commit 5 para validar las puertas RBAC del shell.
 *
 * Sprint 1 — Task 5.4 (placeholder).
 */
import { ArrowRight, Upload } from "lucide-react";

export function ImportarTab() {
  return (
    <div className="space-y-4">
      <div
        className="flex items-start gap-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--g-sec-100)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Upload className="h-6 w-6 text-[var(--g-brand-3308)]" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
            Importador JSON de plantillas
          </h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            El wizard de 5 pasos (validación → vista previa → Gate PRE → confirmación → bump
            semver) llega en la próxima iteración del Sprint 1. Esta tab queda reservada
            para administradores y se activa en Commit 6.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              Ver plan: <code className="font-mono">Commit 6 — Importador JSON wizard (Fase 2)</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
