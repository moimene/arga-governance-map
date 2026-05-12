import type { LucideIcon } from "lucide-react";

export type SecretariaSidebarMode = "grupo" | "sociedad";

export type EntityContext = {
  id?: string;
  tipo_social?: string | null;        // 'SA' | 'SL' | 'SLU' | 'SAU'
  es_cotizada?: boolean | null;
  es_unipersonal?: boolean | null;
  /**
   * Régimen de administración (formal canónico en `entities.tipo_organo_admin`).
   * Valores aceptados por el CHECK constraint del schema canónico
   * (`20260421_000019_modelo_canonico_base.sql`):
   *   'ADMIN_UNICO' | 'ADMIN_SOLIDARIOS' | 'ADMIN_MANCOMUNADOS' | 'CDA'
   * Adicionalmente aceptamos formas singulares (`ADMIN_SOLIDARIO`,
   * `ADMIN_MANCOMUNADO`) y alias (`CONSEJO`, `CONSEJO_ADMINISTRACION`,
   * `CONSEJO_MANCOMUNADO`) presentes en seeds legacy o configuraciones
   * derivadas de `condiciones_persona.tipo_condicion` (que usa el singular
   * para describir el CARGO individual, no el régimen colectivo).
   */
  tipo_organo_admin?: string | null;
};

export type CapabilitiesContext = {
  canSnapshot: boolean;
  canVote: boolean;
  canCertify: boolean;
};

export type ReadinessContext = {
  status: "complete" | "partial" | "reference_only";
};

export type SidebarVisibilityContext = {
  mode: SecretariaSidebarMode;
  hasSelectedEntity: boolean;
  entity?: EntityContext | null;
  bodyTypes?: string[];               // body_types vigentes para la entidad activa
  /**
   * `governing_bodies.config.organo_tipo` por body vigente. Necesario porque
   * `SociedadNuevaStepper` persiste TODOS los bodies de administración con
   * `body_type: "CDA"` independientemente del régimen real, y guarda el
   * régimen efectivo en `config.organo_tipo` (e.g. ADMIN_UNICO,
   * ADMIN_SOLIDARIOS, ADMIN_CONJUNTA, CONSEJO_ADMIN). Sin esto, sociedades
   * unipersonales/solidarias/mancomunadas darían falso positivo en
   * `entityHasCollegiateBody`.
   */
  organoTipos?: string[];
  adoptionModes?: string[];           // adoption_modes disponibles para la entidad activa
  capabilities?: CapabilitiesContext | null;
  readiness?: ReadinessContext | null;
  roles?: string[];                   // role_codes RBAC
  permissions?: string[];             // permissions RBAC
  featureFlags?: Record<string, boolean>;
};

export type VisibilityRule = {
  requiresEntity?: boolean;
  requiresCollegiateBody?: boolean;
  requiresUnipersonalAdmin?: boolean;
  requiresCotizada?: boolean;
  excludesIfCotizada?: boolean;
  requiresCapability?: keyof CapabilitiesContext;
  requiresBodyType?: string[];
  requiresAdoptionMode?: string[];
  requiresPermission?: string;
  requiresRole?: string[];
  requiresFeatureFlag?: string;
  excludesIfReferenceOnly?: boolean;
};

export interface VisibleSecretariaNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  requiresEntity?: boolean;
  selectedEntityRoute?: boolean;
  visibility?: VisibilityRule;
}

export interface VisibleSecretariaNavGroup {
  label: string;
  items: VisibleSecretariaNavItem[];
}

const COLLEGIATE_BODY_TYPES = new Set([
  "CDA",
  "CONSEJO",
  "CONSEJO_ADMINISTRACION",
  "JUNTA",
  "JUNTA_GENERAL",
  "COMITE",
  "COMISION",
  "COMISION_AUDITORIA",
  "COMISION_NOMBRAMIENTOS",
  "COMISION_RETRIBUCIONES",
  "COMISION_RIESGOS",
]);

const UNIPERSONAL_ADMIN_TYPES = new Set(["ADMIN_UNICO", "ADMINISTRADOR_UNICO"]);

/**
 * Régimen mancomunado de administración. Aceptamos:
 *  - `ADMIN_MANCOMUNADOS` (canónico del schema en `entities.tipo_organo_admin`)
 *  - `ADMIN_MANCOMUNADO` (singular legacy — algunas seeds antiguas)
 *  - `CONSEJO_MANCOMUNADO` (alias derivado del config del órgano)
 */
const MANCOMUNADO_ADMIN_TYPES = new Set([
  "ADMIN_MANCOMUNADOS",
  "ADMIN_MANCOMUNADO",
  "CONSEJO_MANCOMUNADO",
]);

/**
 * Régimen solidario de administración. Aceptamos:
 *  - `ADMIN_SOLIDARIOS` (canónico del schema)
 *  - `ADMIN_SOLIDARIO` (singular legacy)
 */
const SOLIDARIO_ADMIN_TYPES = new Set(["ADMIN_SOLIDARIOS", "ADMIN_SOLIDARIO"]);

/**
 * Regímenes administrativos NO colegiados. Si la sociedad declara uno de
 * estos en `entities.tipo_organo_admin` o en `governing_bodies.config.organo_tipo`,
 * cualquier `body_type: "CDA"` legacy se ignora — esos bodies se persisten
 * como CDA por defecto (SociedadNuevaStepper) pero NO son colegiados.
 *
 * Incluye `ADMIN_CONJUNTA` (alias `governing_bodies.config.organo_tipo` para
 * régimen mancomunado en el stepper) además del plural canónico y singular
 * legacy.
 */
const NON_COLLEGIATE_ADMIN_TYPES = new Set([
  "ADMIN_UNICO",
  "ADMINISTRADOR_UNICO",
  "ADMIN_SOLIDARIOS",
  "ADMIN_SOLIDARIO",
  "ADMIN_MANCOMUNADOS",
  "ADMIN_MANCOMUNADO",
  "ADMIN_CONJUNTA",
  "SOCIO_UNICO",
]);

/**
 * Regímenes administrativos EXPLÍCITAMENTE colegiados (sólo CDA / Consejo
 * de Administración). El alias `CONSEJO_ADMIN` aparece en `body.config.organo_tipo`
 * cuando `SociedadNuevaStepper` crea el CDA para una SA estándar.
 */
const COLLEGIATE_ADMIN_TYPES = new Set([
  "CDA",
  "CONSEJO",
  "CONSEJO_ADMIN",
  "CONSEJO_ADMINISTRACION",
]);

export function isMancomunadoAdmin(tipoOrganoAdmin: string | null | undefined): boolean {
  return MANCOMUNADO_ADMIN_TYPES.has(String(tipoOrganoAdmin ?? "").toUpperCase());
}

export function isSolidarioAdmin(tipoOrganoAdmin: string | null | undefined): boolean {
  return SOLIDARIO_ADMIN_TYPES.has(String(tipoOrganoAdmin ?? "").toUpperCase());
}

export function isNonCollegiateAdmin(value: string | null | undefined): boolean {
  return NON_COLLEGIATE_ADMIN_TYPES.has(String(value ?? "").toUpperCase());
}

export function isCollegiateAdmin(value: string | null | undefined): boolean {
  return COLLEGIATE_ADMIN_TYPES.has(String(value ?? "").toUpperCase());
}

function upper(value: string | null | undefined) {
  return String(value ?? "").toUpperCase();
}

export function entityHasCollegiateBody(ctx: SidebarVisibilityContext): boolean {
  // 1) Veto fuerte desde tipo_organo_admin: si el régimen es ADMIN_UNICO/
  //    ADMIN_SOLIDARIOS/ADMIN_MANCOMUNADOS, NO es colegiado, ni siquiera
  //    si los bodies persistidos tienen body_type="CDA" por convención
  //    legacy del SociedadNuevaStepper.
  const admin = ctx.entity?.tipo_organo_admin;
  if (isNonCollegiateAdmin(admin)) return false;
  // 2) Régimen explícitamente colegiado en la entidad
  if (isCollegiateAdmin(admin)) return true;

  // 3) Veto secundario desde body configs: si algún body declara organo_tipo
  //    no colegiado en su config, esa estructura administrativa no es
  //    colegiada. (Caso: entidad sin tipo_organo_admin pero bodies con
  //    config.organo_tipo poblado.)
  const organoTipos = ctx.organoTipos ?? [];
  if (organoTipos.some((tipo) => isNonCollegiateAdmin(tipo))) return false;
  if (organoTipos.some((tipo) => isCollegiateAdmin(tipo))) return true;

  // 4) Fallback final a body_types. Sólo se llega aquí cuando no hay
  //    información de régimen ni en la entidad ni en los configs. Aceptamos
  //    Junta General, Comisiones, etc., como colegiadas; NO usamos "CDA"
  //    aquí porque ese body_type es ambiguo (ver SociedadNuevaStepper).
  const bodyTypes = ctx.bodyTypes ?? [];
  return bodyTypes.some((bt) => {
    const upperBt = upper(bt);
    // Excluir CDA del fallback — el régimen real estaría en config/admin
    if (upperBt === "CDA") return false;
    return COLLEGIATE_BODY_TYPES.has(upperBt);
  });
}

export function entityHasUnipersonalAdmin(ctx: SidebarVisibilityContext): boolean {
  const admin = upper(ctx.entity?.tipo_organo_admin);
  if (UNIPERSONAL_ADMIN_TYPES.has(admin)) return true;
  const tipo = upper(ctx.entity?.tipo_social);
  if (tipo === "SLU" || tipo === "SAU") return true;
  return Boolean(ctx.entity?.es_unipersonal);
}

function hasCapability(ctx: SidebarVisibilityContext, capability: keyof CapabilitiesContext): boolean {
  return Boolean(ctx.capabilities?.[capability]);
}

function hasPermission(ctx: SidebarVisibilityContext, permission: string): boolean {
  const perms = ctx.permissions ?? [];
  if (perms.includes("*")) return true;
  if (perms.includes(permission)) return true;
  const [resource] = permission.split(":");
  return perms.includes(`${resource}:*`);
}

function hasRole(ctx: SidebarVisibilityContext, roles: string[]): boolean {
  const userRoles = ctx.roles ?? [];
  return roles.some((r) => userRoles.includes(r));
}

function hasAdoptionMode(ctx: SidebarVisibilityContext, required: string[]): boolean {
  const available = (ctx.adoptionModes ?? []).map(upper);
  return required.some((req) => available.includes(upper(req)));
}

export function isItemVisible(
  item: VisibleSecretariaNavItem,
  ctx: SidebarVisibilityContext
): boolean {
  const rule = item.visibility;
  if (!rule) return true;

  if (rule.requiresEntity && (ctx.mode !== "sociedad" || !ctx.hasSelectedEntity)) return false;

  // Filtros entity-dependent: si la entidad está marcada como seleccionada
  // pero todavía no se ha hidratado (ctx.entity == null), no aplicamos
  // estas reglas para evitar parpadeo del sidebar durante la carga.
  const entityReady = !!ctx.entity;

  if (entityReady) {
    if (rule.requiresCollegiateBody && !entityHasCollegiateBody(ctx)) return false;
    if (rule.requiresUnipersonalAdmin && !entityHasUnipersonalAdmin(ctx)) return false;

    if (rule.requiresCotizada && !ctx.entity?.es_cotizada) return false;
    if (rule.excludesIfCotizada && ctx.entity?.es_cotizada) return false;

    if (rule.requiresBodyType && rule.requiresBodyType.length > 0) {
      const bodyTypes = (ctx.bodyTypes ?? []).map(upper);
      if (!rule.requiresBodyType.some((req) => bodyTypes.includes(upper(req)))) return false;
    }

    if (rule.requiresAdoptionMode && rule.requiresAdoptionMode.length > 0) {
      if (!hasAdoptionMode(ctx, rule.requiresAdoptionMode)) return false;
    }
  }

  // Readiness depende de useEntityDemoReadiness(entityId), que sólo dispara
  // cuando hay entityId. Aplicamos `excludesIfReferenceOnly` sólo cuando
  // ya tenemos el dato — si no, sería un flicker secundario (item aparece
  // tras hidratar sociedad+bodies, desaparece cuando llega readiness).
  // El sidebar usa `isInitialLoading` para esperar también a readiness,
  // pero esta guarda blinda el helper para callers que no agregan readiness.
  if (rule.excludesIfReferenceOnly && ctx.readiness && ctx.readiness.status === "reference_only") {
    return false;
  }

  // Filtros independientes de entity data (capability_matrix, roles,
  // permissions, feature flags) se aplican siempre.
  if (rule.requiresCapability && !hasCapability(ctx, rule.requiresCapability)) return false;
  if (rule.requiresPermission && !hasPermission(ctx, rule.requiresPermission)) return false;
  if (rule.requiresRole && !hasRole(ctx, rule.requiresRole)) return false;
  if (rule.requiresFeatureFlag && !ctx.featureFlags?.[rule.requiresFeatureFlag]) return false;

  return true;
}

export function isItemDisabled(
  item: VisibleSecretariaNavItem,
  ctx: SidebarVisibilityContext
): boolean {
  return ctx.mode === "sociedad" && Boolean(item.requiresEntity) && !ctx.hasSelectedEntity;
}

export function getVisibleSidebarSections(
  groups: VisibleSecretariaNavGroup[],
  ctx: SidebarVisibilityContext
): VisibleSecretariaNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isItemVisible(item, ctx)),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Reglas reutilizables para CTAs dentro de páginas. Mismo motor que el sidebar,
 * pero invocable desde Acuerdo/Reunión/Acta sin tener que duplicar lógica RBAC.
 */
export function canShowAdoptionModeCta(
  ctx: SidebarVisibilityContext,
  adoptionMode: "MEETING" | "UNIVERSAL" | "NO_SESSION" | "UNIPERSONAL_SOCIO" | "UNIPERSONAL_ADMIN" | "CO_APROBACION" | "SOLIDARIO"
): boolean {
  const tipoSocial = upper(ctx.entity?.tipo_social);
  const adminRaw = ctx.entity?.tipo_organo_admin;
  const colegiado = entityHasCollegiateBody(ctx);
  const unipersonal = entityHasUnipersonalAdmin(ctx);

  switch (adoptionMode) {
    case "MEETING":
    case "UNIVERSAL":
    case "NO_SESSION":
      return colegiado;
    case "UNIPERSONAL_ADMIN":
      return unipersonal;
    case "UNIPERSONAL_SOCIO":
      // SLU/SAU implícitamente; o entity es_unipersonal flag al nivel socio
      return tipoSocial === "SLU" || tipoSocial === "SAU" || Boolean(ctx.entity?.es_unipersonal);
    case "CO_APROBACION":
      // Acepta plural canónico (ADMIN_MANCOMUNADOS) + singular legacy + alias
      return isMancomunadoAdmin(adminRaw);
    case "SOLIDARIO":
      // Acepta plural canónico (ADMIN_SOLIDARIOS) + singular legacy
      return isSolidarioAdmin(adminRaw);
    default:
      return false;
  }
}

export function canShowCertificationCta(ctx: SidebarVisibilityContext): boolean {
  return hasCapability(ctx, "canCertify");
}

export function canShowVotingCta(ctx: SidebarVisibilityContext, agendaKind: string | null | undefined): boolean {
  if (upper(agendaKind) !== "DECISORIO") return false;
  return hasCapability(ctx, "canVote") || hasCapability(ctx, "canSnapshot");
}

export function canShowRegistralActions(ctx: SidebarVisibilityContext, inscribable: boolean | null | undefined): boolean {
  if (!inscribable) return false;
  return true;
}

export function canShowCotizadaActions(ctx: SidebarVisibilityContext): boolean {
  return Boolean(ctx.entity?.es_cotizada);
}
