export default function SOC() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--g-text-primary)] mb-2">SOC & Threat Intel</h1>
      <p className="text-sm text-[var(--g-text-secondary)]">
        Centro de Operaciones de Seguridad · Inteligencia de amenazas.
      </p>
      <div
        className="mt-4 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <div className="text-sm text-[var(--g-text-secondary)]">
          Integración SOC disponible en versión enterprise.
        </div>
      </div>
    </div>
  );
}
