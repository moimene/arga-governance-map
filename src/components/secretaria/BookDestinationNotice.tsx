import { Library } from "lucide-react";
import {
  bookDefinitionForKind,
  bookDestinationForBody,
  type BookBodyLike,
} from "@/lib/secretaria/libros-societarios";

interface BookDestinationNoticeProps {
  body?: BookBodyLike | null;
  bookKind?: string;
  adoptionLabel?: string;
}

export function BookDestinationNotice({
  body,
  bookKind,
  adoptionLabel = "documento societario",
}: BookDestinationNoticeProps) {
  const definition = body
    ? bookDestinationForBody(body)
    : bookDefinitionForKind(bookKind ?? "LIBRO_ACTAS");

  return (
    <div
      className="flex items-start gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <Library className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-[var(--g-text-primary)]">
          Destino en libros: {definition.label}
        </p>
        <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
          El {adoptionLabel} quedara trazado como asiento del libro o registro
          correspondiente. Base: {definition.legalBasis}. Custodia: {definition.custodian}.
        </p>
      </div>
    </div>
  );
}
