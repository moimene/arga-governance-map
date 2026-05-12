import { useMemo } from "react";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { useCapabilityMatrix } from "@/hooks/useCapabilityMatrix";
import { useEntityDemoReadiness } from "@/hooks/useEntityDemoReadiness";
import { useSociedad } from "@/hooks/useSociedades";
import { useUserRole } from "@/hooks/useUserRole";
import {
  entityHasCollegiateBody,
  isMancomunadoAdmin,
  isSolidarioAdmin,
  type SidebarVisibilityContext,
  type CapabilitiesContext,
  type ReadinessContext,
  type EntityContext,
} from "@/lib/secretaria/sidebar-visibility";
import type { SecretariaScopeController } from "./types";

const DEFAULT_ROLE = "SECRETARIO";

export interface SidebarVisibilityResult {
  context: SidebarVisibilityContext;
  /**
   * True cuando estamos cargando datos por primera vez (sin cache) para una
   * entidad recién seleccionada. El sidebar usa este flag para renderizar
   * skeletons en lugar de items "permisivos" que luego se filtran y producen
   * flicker visible.
   */
  isInitialLoading: boolean;
}

/**
 * Agrega el contexto operativo necesario para que el sidebar y los CTAs
 * de página decidan qué mostrar. Si los datos aún no han cargado, devuelve
 * un contexto "permisivo" (sin reglas activas) salvo flags de "se vacía
 * cuando no hay entidad", que el helper aplica via `requiresEntity`.
 *
 * Hooks utilizados — no se crean nuevos, sólo se reutilizan:
 *   - useSociedad(entityId)          → tipo_social, es_cotizada, tipo_organo_admin
 *   - useBodiesByEntity(entityId)    → body_types vigentes
 *   - useCapabilityMatrix()          → SNAPSHOT_CREATION/VOTE_EMISSION/CERTIFICATION
 *   - useUserRole(userId)            → roles + permissions RBAC
 *   - useEntityDemoReadiness         → readiness status para excludesIfReferenceOnly
 *
 * El contexto se memoiza para evitar re-render en cascada del sidebar
 * cuando los hooks revalidan pero sus datos no cambian.
 */
export function useSidebarVisibilityContext(
  scope: SecretariaScopeController
): SidebarVisibilityContext {
  return useSidebarVisibility(scope).context;
}

/**
 * Variante completa con `isInitialLoading`. Usa esto en el sidebar para
 * decidir entre skeleton/render filtrado. Los CTAs de página pueden seguir
 * usando `useSidebarVisibilityContext` cuando no necesiten el flag.
 */
export function useSidebarVisibility(
  scope: SecretariaScopeController
): SidebarVisibilityResult {
  const entityId = scope.selectedEntity?.id;
  const hasSelectedEntity = Boolean(entityId);

  const sociedadQ = useSociedad(entityId);
  const bodiesQ = useBodiesByEntity(entityId);
  const capabilityQ = useCapabilityMatrix();
  const readinessQ = useEntityDemoReadiness(entityId);
  const userRole = useUserRole(/* userId pendiente de auth real */);

  const sociedad = sociedadQ.data;
  const bodies = bodiesQ.data;
  const capabilityRows = capabilityQ.data;
  const readiness = readinessQ.data;
  const { roles, permissions } = userRole;

  const entity: EntityContext | null = useMemo(() => {
    if (!sociedad) return null;
    return {
      id: sociedad.id,
      tipo_social: sociedad.tipo_social ?? null,
      es_cotizada: sociedad.es_cotizada ?? null,
      es_unipersonal: sociedad.es_unipersonal ?? null,
      tipo_organo_admin: sociedad.tipo_organo_admin ?? null,
    };
  }, [sociedad]);

  const bodyTypes = useMemo(
    () => (bodies ?? []).map((b) => b.body_type).filter(Boolean) as string[],
    [bodies]
  );

  // organo_tipo es el régimen REAL declarado en body.config (lo persiste
  // SociedadNuevaStepper). Necesario porque body_type=CDA se persiste por
  // defecto incluso para sociedades ADMIN_UNICO/SOLIDARIOS/MANCOMUNADOS.
  const organoTipos = useMemo(() => {
    const result: string[] = [];
    for (const body of bodies ?? []) {
      const config = (body.config ?? {}) as Record<string, unknown>;
      const organoTipo = typeof config.organo_tipo === "string" ? config.organo_tipo : null;
      if (organoTipo) result.push(organoTipo);
    }
    return result;
  }, [bodies]);

  const adoptionModes = useMemo(() => {
    const modes = new Set<string>();

    // adoption_mode declarado explícitamente en body.config (lo persiste
    // SociedadNuevaStepper). Es la fuente más fiable cuando existe.
    for (const body of bodies ?? []) {
      const config = (body.config ?? {}) as Record<string, unknown>;
      const modeFromConfig = typeof config.adoption_mode === "string" ? config.adoption_mode : null;
      if (modeFromConfig) modes.add(modeFromConfig.toUpperCase());
    }

    // Construir un context provisional para usar el helper centralizado y
    // evitar duplicar la lógica de colegialidad (que también respeta el
    // veto tipo_organo_admin/organo_tipo).
    const partialCtx: SidebarVisibilityContext = {
      mode: scope.mode,
      hasSelectedEntity,
      entity,
      bodyTypes,
      organoTipos,
    };

    // Modos colegiados sólo si la entidad/bodies realmente son colegiados
    // (helper aplica veto desde tipo_organo_admin/organo_tipo primero).
    if (entityHasCollegiateBody(partialCtx)) {
      modes.add("MEETING");
      modes.add("UNIVERSAL");
      modes.add("NO_SESSION");
    }

    const admin = entity?.tipo_organo_admin;
    if (admin && (String(admin).toUpperCase() === "ADMIN_UNICO" || String(admin).toUpperCase() === "ADMINISTRADOR_UNICO")) {
      modes.add("UNIPERSONAL_ADMIN");
    }
    if (isMancomunadoAdmin(admin)) modes.add("CO_APROBACION");
    if (isSolidarioAdmin(admin)) modes.add("SOLIDARIO");

    // Veto/expansión también desde body.config.organo_tipo (caso sin
    // tipo_organo_admin poblado en entities).
    for (const tipo of organoTipos) {
      if (isMancomunadoAdmin(tipo)) modes.add("CO_APROBACION");
      if (isSolidarioAdmin(tipo)) modes.add("SOLIDARIO");
      const upper = String(tipo).toUpperCase();
      if (upper === "ADMIN_UNICO") modes.add("UNIPERSONAL_ADMIN");
      // ADMIN_CONJUNTA → mancomunado (alias del stepper)
      if (upper === "ADMIN_CONJUNTA") modes.add("CO_APROBACION");
      if (upper === "SOCIO_UNICO") modes.add("UNIPERSONAL_SOCIO");
    }

    const tipo = String(entity?.tipo_social ?? "").toUpperCase();
    if (tipo === "SLU" || tipo === "SAU" || entity?.es_unipersonal) modes.add("UNIPERSONAL_SOCIO");

    return Array.from(modes);
  }, [bodies, bodyTypes, organoTipos, entity, scope.mode, hasSelectedEntity]);

  const capabilities: CapabilitiesContext | null = useMemo(() => {
    if (!capabilityRows) return null;
    // Role efectivo: por ahora SECRETARIO hardcoded (alineado con
    // EmitirCertificacionButton). Cuando exista auth real, sustituir
    // por roles[0] / role activo del usuario.
    const role = roles?.[0] ?? DEFAULT_ROLE;
    const matrix = capabilityRows.filter((r) => r.role === role);
    return {
      canSnapshot: matrix.find((r) => r.action === "SNAPSHOT_CREATION")?.enabled ?? false,
      canVote: matrix.find((r) => r.action === "VOTE_EMISSION")?.enabled ?? false,
      canCertify: matrix.find((r) => r.action === "CERTIFICATION")?.enabled ?? false,
    };
  }, [capabilityRows, roles]);

  const readinessCtx: ReadinessContext | null = useMemo(() => {
    if (!readiness) return null;
    return { status: readiness.status };
  }, [readiness]);

  const context = useMemo<SidebarVisibilityContext>(
    () => ({
      mode: scope.mode,
      hasSelectedEntity,
      entity,
      bodyTypes,
      organoTipos,
      adoptionModes,
      capabilities,
      readiness: readinessCtx,
      roles,
      permissions,
    }),
    [
      scope.mode,
      hasSelectedEntity,
      entity,
      bodyTypes,
      organoTipos,
      adoptionModes,
      capabilities,
      readinessCtx,
      roles,
      permissions,
    ]
  );

  // `isInitialLoading` se activa cuando estamos en modo sociedad con entidad
  // recién seleccionada y aún no llegaron los datos críticos para filtrar.
  // Necesitamos esperar 3 fuentes:
  //   - sociedad / bodies → reglas entity-dependent (requiresCollegiateBody,
  //     requiresUnipersonalAdmin, requiresCotizada, requiresBodyType)
  //   - readiness → regla excludesIfReferenceOnly (sin esto, items operativos
  //     parpadean: aparecen tras hidratar sociedad+bodies, desaparecen cuando
  //     llega readiness con status="reference_only")
  // Capability rows son globales (no dependen de entityId) y se piden en
  // mount; en práctica están cargadas antes que las queries entity-scoped.
  const isInitialLoading =
    scope.mode === "sociedad" &&
    hasSelectedEntity &&
    (
      (sociedadQ.isLoading && !sociedad) ||
      (bodiesQ.isLoading && !bodies) ||
      (readinessQ.isLoading && !readiness)
    );

  return useMemo<SidebarVisibilityResult>(
    () => ({ context, isInitialLoading }),
    [context, isInitialLoading]
  );
}
