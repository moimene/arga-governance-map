import { Link } from "react-router-dom";

export default function PoliciesLink() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--g-text-primary)] mb-2">
        Políticas DORA vinculadas
      </h1>
      <p className="text-sm text-[var(--g-text-secondary)] mb-4">
        Políticas del shell TGMS asociadas al marco DORA de resiliencia ICT.
      </p>
      <Link
        to="/politicas"
        className="inline-flex items-center gap-1 text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline"
      >
        Ver todas las políticas en TGMS →
      </Link>
    </div>
  );
}
