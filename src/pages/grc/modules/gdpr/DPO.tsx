export default function DPO() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--g-text-primary)] mb-2">Oficina DPO</h1>
      <p className="text-sm text-[var(--g-text-secondary)]">
        Gestión del Delegado de Protección de Datos · art. 37-39 GDPR.
      </p>
      <div
        className="mt-4 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <div className="text-sm text-[var(--g-text-secondary)]">
          Módulo disponible en versión enterprise.
        </div>
      </div>
    </div>
  );
}
