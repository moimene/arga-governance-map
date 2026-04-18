export default function Program() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--g-text-primary)] mb-2">Plan de Auditoría</h1>
      <p className="text-sm text-[var(--g-text-secondary)]">
        Programación anual de auditorías internas y revisiones de control.
      </p>
      <div
        className="mt-4 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <div className="text-sm text-[var(--g-text-secondary)]">
          Plan de auditoría disponible en versión enterprise.
        </div>
      </div>
    </div>
  );
}
