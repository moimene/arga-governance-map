export default function Thresholds() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--g-text-primary)] mb-2">
        Umbrales DORA de notificación
      </h1>
      <p className="text-sm text-[var(--g-text-secondary)] mb-4">
        Configuración de criterios para clasificación de incidentes mayores y activación
        de notificación a BdE en el plazo de 72h establecido por DORA Art. 19.
      </p>
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <div className="text-sm text-[var(--g-text-secondary)]">
          Configuración disponible en versión enterprise.
        </div>
      </div>
    </div>
  );
}
