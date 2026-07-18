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
import { normalizeOrganoTipo } from "@/lib/secretaria/template-admin/organo-canonico";

const SEVERITY_CHIP: Record<string, string> = {
  BLOCKING: "border border-[var(--status-error)] text-[var(--g-text-primary)]",
  WARNING: "border border-[var(--status-warning)] text-[var(--g-text-primary)]",
  INFO: "border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]",
};

/**
 * `governing_bodies.body_type` usa un vocabulario propio (CDA, JUNTA, COMISION,
 * COMITE) distinto del `organo_tipo` canónico de plantillas y rule packs. La
 * traducción vive aquí y NO en `ORGANO_ALIAS`: ese mapa está espejado en la
 * función de identidad funcional del servidor y en el índice único de Cloud;
 * tocarlo cambiaría la identidad de las plantillas.
 *
 * `COMITE` se deja fuera a propósito: un comité no es necesariamente una
 * comisión delegada con reglas propias de quórum, y ante la duda el panel calla.
 */
const BODY_TYPE_TO_ORGANO_CANONICO: Readonly<Record<string, string>> = {
  JUNTA: "JUNTA_GENERAL",
  JUNTA_GENERAL: "JUNTA_GENERAL",
  CDA: "CONSEJO_ADMIN",
  CONSEJO: "CONSEJO_ADMIN",
  CONSEJO_ADMIN: "CONSEJO_ADMIN",
  COMISION: "COMISION_DELEGADA",
  COMISION_DELEGADA: "COMISION_DELEGADA",
};

function organoCanonicoFromBodyType(value?: string | null): string | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return null;
  return BODY_TYPE_TO_ORGANO_CANONICO[normalized] ?? normalizeOrganoTipo(normalized);
}

/**
 * ¿La regla versionada resuelta pertenece al órgano del acuerdo?
 *
 * Se compara por código canónico y, además, se aceptan como equivalentes las
 * grafías de una misma familia (CDA/CONSEJO_ADMIN, JUNTA/JUNTA_GENERAL). NO
 * existe un bucket "otros" comodín: agrupar COMISION, COMITE, SOCIO_UNICO y
 * SOPORTE_INTERNO en una misma clase haría casar un acuerdo de comisión
 * delegada con un rule pack de socio único. Ante cualquier duda, no coincide y
 * el panel calla.
 */
function organoMatchesPack(packOrgano?: string | null, agreementOrgano?: string | null): boolean {
  const pack = organoCanonicoFromBodyType(packOrgano);
  const agreement = organoCanonicoFromBodyType(agreementOrgano);
  if (!pack || !agreement) return false;
  if (pack === agreement) return true;
  const familia = (value: string) =>
    value.includes("CONSEJO") ? "CONSEJO" : value.includes("JUNTA") ? "JUNTA" : null;
  const packFamilia = familia(pack);
  const agreementFamilia = familia(agreement);
  return Boolean(packFamilia && agreementFamilia && packFamilia === agreementFamilia);
}

/**
 * El plazo mínimo que calcula el perfil procede del art. 176 LSC (régimen de
 * Junta) y se deriva del tipo social, no del órgano. Para órganos de
 * administración se presenta el criterio estatutario en vez de un plazo legal
 * que no les aplica.
 */
function isJuntaOrgano(organoTipo: string): boolean {
  return organoTipo.toUpperCase().includes("JUNTA");
}

/**
 * El payload del rule pack puede traer marcadores de configuración ("NA",
 * "N/A", "-") en vez de una regla legible. En la vista del abogado se
 * presentan como lo que son: la regla no aplica a ese órgano.
 */
const RULE_CODE_LABELS: Readonly<Record<string, string>> = {
  MAYORIA_MIEMBROS: "Mayoría de miembros del órgano",
  MAYORIA_ABSOLUTA: "Mayoría absoluta",
  MAYORIA_SIMPLE: "Mayoría simple",
  SIMPLE: "Mayoría simple",
  UNANIMIDAD: "Unanimidad",
  PRESENTES_MITAD_NO_VINCULADOS: "Mayoría de los presentes no vinculados",
  MITAD_CAPITAL: "Mitad del capital",
};

/**
 * Fuente legal: solo se filtran los marcadores de configuración. NO se
 * capitaliza ni se reescribe — "art. 247.1 LSC" se cita tal cual.
 */
function readableSource(value?: string | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^(NA|N\/A|NO_APLICA|-|—|NULL|NINGUNO)$/i.test(raw)) return null;
  return raw;
}

function readableRule(value?: string | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^(NA|N\/A|NO_APLICA|-|—|NULL|NINGUNO)$/i.test(raw)) return null;
  const known = RULE_CODE_LABELS[raw.toUpperCase()];
  if (known) return known;
  // Los payloads traen códigos en snake_case, a veces dentro de una expresión
  // ("favor > presentes_mitad_no_vinculados"). En vista de abogado se presentan
  // como texto, no como identificadores de configuración.
  const humanized = raw.replace(/\b[a-z0-9]+(?:_[a-z0-9]+)+\b/gi, (token) => {
    const mapped = RULE_CODE_LABELS[token.toUpperCase()];
    if (mapped) return mapped.toLowerCase();
    return token.replace(/_/g, " ").toLowerCase();
  });
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
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
  organoTipo,
  entity,
  rulePack,
}: {
  materia?: string | null;
  adoptionMode?: string | null;
  organoTipo?: string | null;
  entity?: PanelEntity | null;
  rulePack?: RulePackData | null;
}) {
  const profile: MatterExecutionProfile | null = useMemo(() => {
    // El panel solo habla cuando TODO el contexto jurídico es real. Nada de
    // valores por defecto: un plazo o un artículo inventado presentado como
    // criterio del Comité Legal es peor que no mostrar nada.
    //   - materia y regla versionada activa: sin ellas no hay referencia.
    //   - tipo social de la entidad: decide el plazo legal (SA 30 / SL 15).
    //   - órgano: los packs de Junta y de Consejo difieren en quórum y mayoría.
    if (!materia || !rulePack) return null;
    const tipoSocial = entity?.tipo_social?.trim();
    if (!tipoSocial) return null;
    const packOrgano = rulePack.pack.organo_tipo?.trim();
    if (!packOrgano || !organoTipo) return null;
    // Codex adversarial (P1 nuevo): el motor solo reconoce códigos canónicos.
    // Pasarle el `body_type` crudo (CDA) hacía que eligiera las reglas de Junta
    // para un acuerdo de Consejo — el mismo error, un paso más adentro.
    const organoCanonico = organoCanonicoFromBodyType(organoTipo);
    if (!organoCanonico) return null;
    // Codex adversarial (P1): si el pack resuelto no es el del órgano del
    // acuerdo, callar. Mostrar reglas de Junta en un acuerdo de Consejo es
    // exactamente el error que la fase 1 informativa debía evitar.
    if (!organoMatchesPack(packOrgano, organoTipo)) return null;
    if (!adoptionMode?.trim()) return null;
    // Tampoco se asume España: la jurisdicción decide qué cuerpo legal se cita.
    const jurisdiccion = entity?.jurisdiction?.trim();
    if (!jurisdiccion) return null;
    try {
      const normativeProfile = buildEntityNormativeProfile({
        entity: {
          id: entity?.id ?? "sin-entidad",
          legal_name: entity?.legal_name ?? null,
          common_name: entity?.common_name ?? null,
          jurisdiction: jurisdiccion,
          legal_form: entity?.legal_form ?? null,
          tipo_social: entity?.tipo_social ?? null,
        },
      });
      return buildMatterExecutionProfile({
        materia,
        organo_tipo: organoCanonico,
        tipo_social: tipoSocial,
        adoption_mode: adoptionMode,
        jurisdiccion,
        rulePackPayload: (rulePack.version.payload as Record<string, unknown>) ?? {},
        normativeProfile,
      });
    } catch {
      // Fase 1: el panel es observación pura — cualquier fallo del perfil se
      // silencia y el tramitador continúa exactamente igual.
      return null;
    }
  }, [adoptionMode, entity, materia, organoTipo, rulePack]);

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
              ? `Quórum mínimo ${Math.round(profile.constitucion.quorum_threshold * 1000) / 10}% del capital${
                  readableSource(profile.constitucion.fuente)
                    ? ` · ${readableSource(profile.constitucion.fuente)}`
                    : ""
                }`
              : readableRule(profile.constitucion.quorum_rule)
                ? `${readableRule(profile.constitucion.quorum_rule)}${
                    readableSource(profile.constitucion.fuente)
                      ? ` · ${readableSource(profile.constitucion.fuente)}`
                      : ""
                  }`
                : "Sin quórum de constitución aplicable a este órgano"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--g-text-primary)]">Votación</dt>
          <dd className="text-[var(--g-text-secondary)]">
            {readableRule(profile.votacion.majority_rule) ?? "Según ley y estatutos"}
            {typeof profile.votacion.majority_threshold === "number"
              ? ` (${profile.votacion.majority_comparator ?? ">"} ${profile.votacion.majority_threshold})`
              : ""}
            {readableSource(profile.votacion.fuente) ? ` · ${readableSource(profile.votacion.fuente)}` : ""}
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
