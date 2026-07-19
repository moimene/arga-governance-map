/**
 * Procedencia de la regla registral que se está aplicando.
 *
 * Dos avisos, ninguno bloqueante:
 *
 *  · PROTOTIPO — Cloud no aporta regla activa para la materia y se está usando
 *    el criterio conservador de prototipo. Este aviso ya existía en el paso 2,
 *    pero el botón que eleva a escritura y persiste en `registry_filings` está
 *    en el paso 5, tres pantallas más adelante: el abogado podía registrar sin
 *    tener el aviso a la vista.
 *
 *  · OTRO ÓRGANO — hay regla activa, pero no del órgano que adopta el acuerdo.
 *    Verificado contra Cloud (2026-07-18): 8 de 37 acuerdos están hoy en este
 *    caso, seis de Consejo recibiendo la regla de la Junta y dos de comisión
 *    delegada, para la que no existe ni un solo pack.
 *
 * Advierte, NO bloquea. Si con discrepancia de órgano debe seguir habilitada la
 * elevación a escritura es criterio del Comité Legal, no de este componente.
 */
import { AlertTriangle } from "lucide-react";
import { bodyTypeLabel } from "@/lib/secretaria/body-labels";

export type RegistryRuleProvenance = "PROTOTIPO" | "OTRO_ORGANO" | null;

export function RegistryRuleProvenanceNotice({
  provenance,
  packOrgano,
  agreementOrgano,
  className,
}: {
  provenance: RegistryRuleProvenance;
  packOrgano?: string | null;
  agreementOrgano?: string | null;
  className?: string;
}) {
  if (!provenance) return null;

  // El aviso describe la PROCEDENCIA de la regla, no extrae conclusiones
  // jurídicas: dice de qué órgano es la regla aplicada y sugiere revisarla. Una
  // frase como "los efectos registrales no están acreditados" se leería como
  // dictamen, y eso corresponde al abogado, no a la herramienta. Tampoco se usa
  // jerga de plataforma ("Cloud") en una superficie dirigida a un jurista.
  const mensaje =
    provenance === "PROTOTIPO" ? (
      <>
        No hay regla registral activa para esta materia, de modo que se aplica un criterio
        conservador de prototipo. Revise los efectos registrales antes de utilizarlos: no constituye
        validación legal productiva.
      </>
    ) : (
      <>
        La regla registral aplicada es la de {bodyTypeLabel(packOrgano)} y este acuerdo se adopta en{" "}
        {bodyTypeLabel(agreementOrgano)}. No hay una regla activa específica para el órgano que
        adopta; revise los efectos registrales antes de utilizarlos.
      </>
    );

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-4 py-3 text-sm text-[var(--g-text-secondary)] ${className ?? ""}`}
      style={{ borderRadius: "var(--g-radius-md)" }}
      data-registry-rule-provenance={provenance}
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]"
        aria-hidden="true"
      />
      <span>{mensaje}</span>
    </div>
  );
}
