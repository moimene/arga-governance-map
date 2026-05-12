/**
 * ImportarTab — host del TemplateImportWizard (Fase 2).
 *
 * Sprint 1 — Commit 6 (Task 6.5 Step 4). Tab solo visible para
 * ADMIN_TENANT (RBAC gates aplicados desde Commit 5 en el shell).
 */

import { TemplateImportWizard } from "./TemplateImportWizard";

export function ImportarTab() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--g-text-primary)]">
          Importar plantilla
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          Crea un borrador desde un paquete JSON. La activación pasa por Gate
          PRE estricto; ningún cambio entra en producción sin firma del Comité
          Legal.
        </p>
      </header>
      <TemplateImportWizard />
    </div>
  );
}
