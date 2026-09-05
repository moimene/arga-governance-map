// Aviso único de procedencia para las pantallas GRC que pintan un array
// literal en el código en lugar de dato de Cloud.
//
// Existe una sola vez porque el defecto era uno solo repetido en ocho
// pantallas: registros verosímiles (detecciones SOC, RAT, EIPDs, DSARs,
// dictámenes del DPO, pruebas de resiliencia, políticas TIC, ratios de
// solvencia) presentados con la misma tipografía y los mismos chips que el
// dato real. La decisión del usuario es que estas pantallas SE CONSERVAN y se
// ETIQUETAN, no que se retiren.
//
// No lleva estado ni lógica: es la etiqueta, y su sitio es arriba del
// contenido que califica, no en un pie.
import { Info } from "lucide-react";

export function DemoFixtureNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 border border-[var(--status-warning)]/40 bg-[var(--g-surface-muted)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)" }}
      data-demo-fixture-notice="true"
      role="note"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-[var(--g-text-primary)]">
        <strong>Contenido de demostración, no conectado.</strong> {children}
      </p>
    </div>
  );
}

export default DemoFixtureNotice;
