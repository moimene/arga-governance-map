import { isAuthorityRole, type TipoCondicionCargo } from "@/lib/secretaria/cargo-validation";

export function RmStatusChip({
  tipoCondicion,
  referencia,
}: {
  tipoCondicion: TipoCondicionCargo;
  referencia?: string | null;
}) {
  if (!isAuthorityRole(tipoCondicion)) return null;
  const registered = !!referencia;
  return (
    <span
      className={
        "inline-flex items-center px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-inverse)] " +
        (registered ? "bg-[var(--status-success)]" : "bg-[var(--status-warning)]")
      }
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {registered ? "Inscrito" : "Pendiente de referencia registral"}
    </span>
  );
}
