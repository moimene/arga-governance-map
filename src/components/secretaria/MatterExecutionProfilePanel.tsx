/**
 * MatterExecutionProfilePanel — Lote 1-bis (fase 1 del plan de conexión).
 *
 * Panel INFORMATIVO y NO DISRUPTIVO del perfil de ejecución formal del acuerdo
 * (`buildMatterExecutionProfile`): muestra gates, prerequisitos y desviaciones
 * por materia sin bloquear nada ni intervenir en el flujo del tramitador.
 *
 * Autorización registrada en el dossier
 * (docs/superpowers/specs/dossier-revision-legal-matter-execution-profile.md,
 * checklist 2026-07-18); el criterio legal P1-P14 se recibió el 2026-05-18 y
 * está aplicado al contrato del módulo. Cualquier promoción de un gate a
 * checkpoint operativo exige decisión expresa posterior (fase 2+).
 */
import { useMemo } from "react";
import { Scale } from "lucide-react";
import {
  buildMatterExecutionProfile,
  type MatterExecutionProfile,
} from "@/lib/secretaria/matter-execution-profile";
import { buildEntityNormativeProfile } from "@/lib/secretaria/normative-framework";
import type { RulePackData } from "@/hooks/useRulePackForMateria";
import { labelMateria } from "@/lib/secretaria/agenda-materias";
import { adoptionModeBusinessLabel } from "@/lib/secretaria/mesa-control-societaria";

const SEVERITY_CHIP: Record<string, string> = {
  BLOCKING: "border border-[var(--status-error)] text-[var(--g-text-primary)]",
  WARNING: "border border-[var(--status-warning)] text-[var(--g-text-primary)]",
  INFO: "border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]",
};

/**
 * El plazo mínimo que calcula el perfil procede del art. 176 LSC (régimen de
 * Junta) y se deriva del tipo social, no del órgano. Para órganos de
 * administración se presenta el criterio estatutario en vez de un plazo legal
 * que no les aplica.
 */
function isJuntaOrgano(organoTipo: string): boolean {
  return organoTipo.toUpperCase().includes("JUNTA");
}

interface PanelEntity {
  id: string;
  legal_name?: string | null;
  common_name?: string | null;
  jurisdiction?: string | null;
  tipo_social?: string | null;
  legal_form?: string | null;
}

export function MatterExecutionProfilePanel({
  materia,
  adoptionMode,
  entity,
  rulePack,
}: {
  materia?: string | null;
  adoptionMode?: string | null;
  entity?: PanelEntity | null;
  rulePack?: RulePackData | null;
}) {
  const profile: MatterExecutionProfile | null = useMemo(() => {
    // Sin materia o sin regla versionada activa no se muestra nada: el perfil
    // se calcularía con valores por defecto (Junta/SA/sesión formal) y
    // presentaría plazos y fuentes fabricados como si fueran la referencia
    // legal del acuerdo.
    if (!materia || !rulePack) return null;
    try {
      const normativeProfile = buildEntityNormativeProfile({
        entity: {
          id: entity?.id ?? "sin-entidad",
          legal_name: entity?.legal_name ?? null,
          common_name: entity?.common_name ?? null,
          jurisdiction: entity?.jurisdiction ?? "ES",
          legal_form: entity?.legal_form ?? null,
          tipo_social: entity?.tipo_social ?? null,
        },
      });
      return buildMatterExecutionProfile({
        materia,
        organo_tipo: rulePack.pack.organo_tipo ?? "JUNTA_GENERAL",
        tipo_social: entity?.tipo_social ?? "SA",
        adoption_mode: adoptionMode ?? "MEETING",
        jurisdiccion: entity?.jurisdiction ?? "ES",
        rulePackPayload: (rulePack.version.payload as Record<string, unknown>) ?? {},
        normativeProfile,
      });
    } catch {
      // Fase 1: el panel es observación pura — cualquier fallo del perfil se
      // silencia y el tramitador continúa exactamente igual.
      return null;
    }
  }, [adoptionMode, entity, materia, rulePack]);

  if (!profile) return null;

  const relevantGaps = profile.gaps.slice(0, 6);

  return (
    <section
      aria-label="Perfil de ejecución del acuerdo (informativo)"
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-md)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Scale className="h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
          Perfil de ejecución del acuerdo
        </h3>
        <span
          className="bg-[var(--g-surface-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          Informativo · no bloqueante
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
        Referencia del proceso formal de adopción de {labelMateria(profile.materia)} (
        {adoptionModeBusinessLabel(profile.adoption_mode)}) según el criterio legal del Comité
        Legal. No impide continuar la tramitación.
      </p>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-medium text-[var(--g-text-primary)]">Convocatoria</dt>
          <dd className="text-[var(--g-text-secondary)]">
            {!profile.convocatoria.required
              ? "No requerida en esta vía de adopción"
              : isJuntaOrgano(profile.organo_tipo)
                ? `Plazo mínimo ${profile.convocatoria.plazo_minimo_dias ?? "—"} días · ${profile.convocatoria.fuente}`
                : "Plazo y forma según estatutos y reglamento del órgano de administración"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--g-text-primary)]">Constitución</dt>
          <dd className="text-[var(--g-text-secondary)]">
            {typeof profile.constitucion.quorum_threshold === "number" &&
            profile.constitucion.quorum_threshold > 0 &&
            profile.constitucion.quorum_threshold <= 1
              ? `Quórum mínimo ${Math.round(profile.constitucion.quorum_threshold * 1000) / 10}% del capital`
              : profile.constitucion.quorum_rule}
            {profile.constitucion.fuente ? ` · ${profile.constitucion.fuente}` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--g-text-primary)]">Votación</dt>
          <dd className="text-[var(--g-text-secondary)]">
            {profile.votacion.majority_rule}
            {typeof profile.votacion.majority_threshold === "number"
              ? ` (${profile.votacion.majority_comparator ?? ">"} ${profile.votacion.majority_threshold})`
              : ""}
            {profile.votacion.fuente ? ` · ${profile.votacion.fuente}` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--g-text-primary)]">Post-acuerdo</dt>
          <dd className="text-[var(--g-text-secondary)]">
            {[
              profile.post_acuerdo.escritura_publica ? "Escritura pública" : null,
              profile.post_acuerdo.es_inscribible ? "Inscripción registral" : null,
              profile.post_acuerdo.publicacion_borme ? "Publicación BORME" : null,
              profile.post_acuerdo.certificacion_requerida ? "Certificación" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Archivo interno"}
          </dd>
        </div>
      </dl>

      {profile.prerequisitos.length > 0 ? (
        <div className="mt-3">
          <h4 className="text-xs font-medium text-[var(--g-text-primary)]">Prerrequisitos de la materia</h4>
          <ul className="mt-1 space-y-1">
            {profile.prerequisitos.map((prerequisito) => (
              <li key={`${prerequisito.materia_requerida}-${prerequisito.fuente}`} className="flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY_CHIP[prerequisito.severity] ?? SEVERITY_CHIP.INFO}`}
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  {prerequisito.severity === "BLOCKING" ? "Previo obligatorio" : prerequisito.severity === "WARNING" ? "Previo recomendado" : "Informativo"}
                </span>
                {labelMateria(prerequisito.materia_requerida)} · {prerequisito.fuente}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {relevantGaps.length > 0 ? (
        <div className="mt-3">
          <h4 className="text-xs font-medium text-[var(--g-text-primary)]">Desviaciones observadas</h4>
          <ul className="mt-1 space-y-1">
            {relevantGaps.map((gap) => (
              <li key={gap.code} className="flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY_CHIP[gap.severity] ?? SEVERITY_CHIP.INFO}`}
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  {gap.severity === "BLOCKING" ? "Incidencia" : gap.severity === "WARNING" ? "Advertencia" : "Nota"}
                </span>
                {gap.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
