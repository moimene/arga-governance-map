import { describe, expect, it } from "vitest";
import { Building2, Users } from "lucide-react";
import {
  canShowAdoptionModeCta,
  canShowCertificationCta,
  canShowCotizadaActions,
  canShowRegistralActions,
  canShowVotingCta,
  entityHasCollegiateBody,
  entityHasUnipersonalAdmin,
  getVisibleSidebarSections,
  isItemDisabled,
  isItemVisible,
  type SidebarVisibilityContext,
  type VisibleSecretariaNavGroup,
  type VisibleSecretariaNavItem,
} from "../sidebar-visibility";

const baseCtx = (overrides: Partial<SidebarVisibilityContext> = {}): SidebarVisibilityContext => ({
  mode: "sociedad",
  hasSelectedEntity: true,
  entity: { tipo_social: "SA", tipo_organo_admin: "CDA" },
  bodyTypes: ["CDA"],
  adoptionModes: ["MEETING", "UNIVERSAL", "NO_SESSION"],
  capabilities: { canSnapshot: true, canVote: true, canCertify: true },
  readiness: { status: "complete" },
  roles: ["SECRETARIO"],
  permissions: ["secretaria:*"],
  featureFlags: {},
  ...overrides,
});

describe("sidebar-visibility — helpers de clasificación", () => {
  it("entityHasCollegiateBody acepta CDA, JUNTA y comisiones (case-insensitive)", () => {
    expect(entityHasCollegiateBody(baseCtx({ bodyTypes: ["cda"] }))).toBe(true);
    expect(entityHasCollegiateBody(baseCtx({ bodyTypes: ["JUNTA"] }))).toBe(true);
    expect(entityHasCollegiateBody(baseCtx({ bodyTypes: ["COMISION_AUDITORIA"] }))).toBe(true);
  });

  it("entityHasCollegiateBody usa tipo_organo_admin=CDA como fallback cuando bodyTypes está vacío", () => {
    const ctx = baseCtx({ bodyTypes: [], entity: { tipo_organo_admin: "CDA" } });
    expect(entityHasCollegiateBody(ctx)).toBe(true);
  });

  it("entityHasUnipersonalAdmin detecta ADMIN_UNICO, SLU y SAU", () => {
    expect(entityHasUnipersonalAdmin(baseCtx({ entity: { tipo_organo_admin: "ADMIN_UNICO" } }))).toBe(true);
    expect(entityHasUnipersonalAdmin(baseCtx({ entity: { tipo_social: "SLU" } }))).toBe(true);
    expect(entityHasUnipersonalAdmin(baseCtx({ entity: { tipo_social: "SAU" } }))).toBe(true);
    expect(entityHasUnipersonalAdmin(baseCtx({ entity: { es_unipersonal: true } }))).toBe(true);
  });

  it("entityHasUnipersonalAdmin es false en SA + CDA estándar", () => {
    expect(entityHasUnipersonalAdmin(baseCtx())).toBe(false);
  });
});

describe("sidebar-visibility — isItemVisible reglas individuales", () => {
  const item = (visibility: VisibleSecretariaNavItem["visibility"]): VisibleSecretariaNavItem => ({
    label: "x",
    to: "/x",
    icon: Users,
    visibility,
  });

  it("sin regla devuelve true por defecto", () => {
    expect(isItemVisible(item(undefined), baseCtx())).toBe(true);
  });

  it("requiresEntity=true requiere sociedad mode + hasSelectedEntity", () => {
    expect(isItemVisible(item({ requiresEntity: true }), baseCtx({ mode: "grupo" }))).toBe(false);
    expect(isItemVisible(item({ requiresEntity: true }), baseCtx({ hasSelectedEntity: false }))).toBe(false);
    expect(isItemVisible(item({ requiresEntity: true }), baseCtx())).toBe(true);
  });

  it("requiresCollegiateBody=true oculta items en ADMIN_UNICO sin órgano colegiado", () => {
    const ctx = baseCtx({ bodyTypes: [], entity: { tipo_organo_admin: "ADMIN_UNICO", tipo_social: "SLU" } });
    expect(isItemVisible(item({ requiresCollegiateBody: true }), ctx)).toBe(false);
  });

  it("requiresUnipersonalAdmin=true oculta items en SA + CDA", () => {
    expect(isItemVisible(item({ requiresUnipersonalAdmin: true }), baseCtx())).toBe(false);
  });

  it("requiresUnipersonalAdmin=true muestra items en SLU + ADMIN_UNICO", () => {
    const ctx = baseCtx({ bodyTypes: [], entity: { tipo_social: "SLU", tipo_organo_admin: "ADMIN_UNICO" } });
    expect(isItemVisible(item({ requiresUnipersonalAdmin: true }), ctx)).toBe(true);
  });

  it("requiresCotizada filtra correctamente entidades cotizadas vs no", () => {
    const cot = baseCtx({ entity: { es_cotizada: true, tipo_organo_admin: "CDA" } });
    const noCot = baseCtx({ entity: { es_cotizada: false, tipo_organo_admin: "CDA" } });
    expect(isItemVisible(item({ requiresCotizada: true }), cot)).toBe(true);
    expect(isItemVisible(item({ requiresCotizada: true }), noCot)).toBe(false);
    expect(isItemVisible(item({ excludesIfCotizada: true }), cot)).toBe(false);
    expect(isItemVisible(item({ excludesIfCotizada: true }), noCot)).toBe(true);
  });

  it("requiresCapability=canCertify oculta cuando capability_matrix.CERTIFICATION=false", () => {
    const sinCap = baseCtx({ capabilities: { canSnapshot: false, canVote: false, canCertify: false } });
    expect(isItemVisible(item({ requiresCapability: "canCertify" }), sinCap)).toBe(false);
    expect(isItemVisible(item({ requiresCapability: "canCertify" }), baseCtx())).toBe(true);
  });

  it("requiresBodyType filtra contra body_types vigentes (case-insensitive)", () => {
    const onlyJunta = baseCtx({ bodyTypes: ["JUNTA"] });
    expect(isItemVisible(item({ requiresBodyType: ["CDA"] }), onlyJunta)).toBe(false);
    expect(isItemVisible(item({ requiresBodyType: ["JUNTA"] }), onlyJunta)).toBe(true);
    expect(isItemVisible(item({ requiresBodyType: ["cda", "junta"] }), onlyJunta)).toBe(true);
  });

  it("requiresPermission soporta wildcard recurso:* y *", () => {
    const noPerm = baseCtx({ permissions: ["otros:read"] });
    expect(isItemVisible(item({ requiresPermission: "secretaria:edit" }), noPerm)).toBe(false);
    expect(isItemVisible(item({ requiresPermission: "secretaria:edit" }), baseCtx())).toBe(true);
    expect(isItemVisible(item({ requiresPermission: "anything:x" }), baseCtx({ permissions: ["*"] }))).toBe(true);
  });

  it("requiresRole reconoce uno de varios roles aceptados", () => {
    const consejero = baseCtx({ roles: ["CONSEJERO"] });
    expect(isItemVisible(item({ requiresRole: ["SECRETARIO"] }), consejero)).toBe(false);
    expect(isItemVisible(item({ requiresRole: ["SECRETARIO", "CONSEJERO"] }), consejero)).toBe(true);
  });

  it("requiresFeatureFlag oculta si flag ausente o false", () => {
    const ctx = baseCtx({ featureFlags: { advanced: false } });
    expect(isItemVisible(item({ requiresFeatureFlag: "advanced" }), ctx)).toBe(false);
    expect(isItemVisible(item({ requiresFeatureFlag: "advanced" }), baseCtx({ featureFlags: { advanced: true } }))).toBe(true);
  });

  it("excludesIfReferenceOnly oculta items operativos cuando readiness=reference_only", () => {
    const ref = baseCtx({ readiness: { status: "reference_only" } });
    expect(isItemVisible(item({ excludesIfReferenceOnly: true }), ref)).toBe(false);
    expect(isItemVisible(item({ excludesIfReferenceOnly: true }), baseCtx())).toBe(true);
  });

  it("durante hidratación (entity=null) deja pasar filtros entity-dependent para evitar flicker", () => {
    const loadingCtx = baseCtx({ entity: null, bodyTypes: [], hasSelectedEntity: true });
    // requiresCollegiateBody / requiresUnipersonalAdmin / requiresCotizada
    // se ignoran durante la hidratación
    expect(isItemVisible(item({ requiresCollegiateBody: true }), loadingCtx)).toBe(true);
    expect(isItemVisible(item({ requiresUnipersonalAdmin: true }), loadingCtx)).toBe(true);
    expect(isItemVisible(item({ requiresCotizada: true }), loadingCtx)).toBe(true);
    // pero requiresCapability sigue activo (no depende de entity data)
    expect(
      isItemVisible(
        item({ requiresCapability: "canCertify" }),
        baseCtx({ entity: null, capabilities: { canSnapshot: true, canVote: true, canCertify: false } })
      )
    ).toBe(false);
  });
});

describe("sidebar-visibility — getVisibleSidebarSections", () => {
  const groups: VisibleSecretariaNavGroup[] = [
    {
      label: "CONTEXTO",
      items: [
        { label: "Dashboard", to: "/dash", icon: Building2 },
        { label: "Board Pack", to: "/bp", icon: Building2, visibility: { requiresCapability: "canCertify", requiresCollegiateBody: true } },
      ],
    },
    {
      label: "EXPEDIENTES",
      items: [
        { label: "Reuniones", to: "/r", icon: Users, visibility: { requiresCollegiateBody: true } },
        { label: "Decisiones unipersonales", to: "/du", icon: Users, visibility: { requiresUnipersonalAdmin: true } },
      ],
    },
    {
      label: "SOLO_UNIPERSONAL",
      items: [
        { label: "Solo unipersonal", to: "/u", icon: Users, visibility: { requiresUnipersonalAdmin: true } },
      ],
    },
  ];

  it("SA + CDA muestra CONTEXTO completo y Reuniones, oculta Decisiones unipersonales y la sección SOLO_UNIPERSONAL", () => {
    const visible = getVisibleSidebarSections(groups, baseCtx());
    const contexto = visible.find((g) => g.label === "CONTEXTO");
    const expedientes = visible.find((g) => g.label === "EXPEDIENTES");
    const soloUni = visible.find((g) => g.label === "SOLO_UNIPERSONAL");

    expect(contexto?.items.map((i) => i.label)).toEqual(["Dashboard", "Board Pack"]);
    expect(expedientes?.items.map((i) => i.label)).toEqual(["Reuniones"]);
    expect(soloUni).toBeUndefined();
  });

  it("SLU + ADMIN_UNICO muestra Decisiones unipersonales, oculta Reuniones y Board Pack (sin colegiado)", () => {
    const ctx = baseCtx({
      bodyTypes: [],
      entity: { tipo_social: "SLU", tipo_organo_admin: "ADMIN_UNICO" },
    });
    const visible = getVisibleSidebarSections(groups, ctx);
    const contexto = visible.find((g) => g.label === "CONTEXTO");
    const expedientes = visible.find((g) => g.label === "EXPEDIENTES");
    const soloUni = visible.find((g) => g.label === "SOLO_UNIPERSONAL");

    expect(contexto?.items.map((i) => i.label)).toEqual(["Dashboard"]);
    expect(expedientes?.items.map((i) => i.label)).toEqual(["Decisiones unipersonales"]);
    expect(soloUni?.items.map((i) => i.label)).toEqual(["Solo unipersonal"]);
  });

  it("Sin capability CERTIFICATION, Board Pack desaparece incluso en SA + CDA", () => {
    const ctx = baseCtx({ capabilities: { canSnapshot: true, canVote: true, canCertify: false } });
    const visible = getVisibleSidebarSections(groups, ctx);
    const contexto = visible.find((g) => g.label === "CONTEXTO");
    expect(contexto?.items.map((i) => i.label)).toEqual(["Dashboard"]);
  });
});

describe("sidebar-visibility — isItemDisabled (modo sociedad sin entidad seleccionada)", () => {
  const item: VisibleSecretariaNavItem = {
    label: "x",
    to: "/x",
    icon: Users,
    requiresEntity: true,
  };

  it("disabled cuando mode=sociedad y no hay entidad", () => {
    expect(isItemDisabled(item, baseCtx({ hasSelectedEntity: false }))).toBe(true);
  });

  it("no disabled si mode=grupo aunque requiresEntity=true", () => {
    expect(isItemDisabled(item, baseCtx({ mode: "grupo", hasSelectedEntity: false }))).toBe(false);
  });

  it("no disabled cuando hay entidad seleccionada", () => {
    expect(isItemDisabled(item, baseCtx())).toBe(false);
  });
});

describe("sidebar-visibility — CTAs contextuales en páginas", () => {
  it("canShowAdoptionModeCta(MEETING/UNIVERSAL/NO_SESSION) requiere órgano colegiado", () => {
    const colegiado = baseCtx();
    const unipersonal = baseCtx({ bodyTypes: [], entity: { tipo_social: "SLU", tipo_organo_admin: "ADMIN_UNICO" } });
    expect(canShowAdoptionModeCta(colegiado, "MEETING")).toBe(true);
    expect(canShowAdoptionModeCta(colegiado, "UNIVERSAL")).toBe(true);
    expect(canShowAdoptionModeCta(colegiado, "NO_SESSION")).toBe(true);
    expect(canShowAdoptionModeCta(unipersonal, "MEETING")).toBe(false);
    expect(canShowAdoptionModeCta(unipersonal, "UNIVERSAL")).toBe(false);
    expect(canShowAdoptionModeCta(unipersonal, "NO_SESSION")).toBe(false);
  });

  it("canShowAdoptionModeCta(UNIPERSONAL_ADMIN) requiere admin único", () => {
    const slu = baseCtx({ bodyTypes: [], entity: { tipo_social: "SLU", tipo_organo_admin: "ADMIN_UNICO" } });
    expect(canShowAdoptionModeCta(slu, "UNIPERSONAL_ADMIN")).toBe(true);
    expect(canShowAdoptionModeCta(baseCtx(), "UNIPERSONAL_ADMIN")).toBe(false);
  });

  it("canShowAdoptionModeCta(UNIPERSONAL_SOCIO) acepta SLU, SAU o flag es_unipersonal", () => {
    expect(canShowAdoptionModeCta(baseCtx({ entity: { tipo_social: "SLU" } }), "UNIPERSONAL_SOCIO")).toBe(true);
    expect(canShowAdoptionModeCta(baseCtx({ entity: { tipo_social: "SAU" } }), "UNIPERSONAL_SOCIO")).toBe(true);
    expect(canShowAdoptionModeCta(baseCtx({ entity: { es_unipersonal: true } }), "UNIPERSONAL_SOCIO")).toBe(true);
    expect(canShowAdoptionModeCta(baseCtx({ entity: { tipo_social: "SA" } }), "UNIPERSONAL_SOCIO")).toBe(false);
  });

  it("canShowAdoptionModeCta(CO_APROBACION) requiere ADMIN_MANCOMUNADO o CONSEJO_MANCOMUNADO", () => {
    expect(canShowAdoptionModeCta(baseCtx({ entity: { tipo_organo_admin: "ADMIN_MANCOMUNADO" } }), "CO_APROBACION")).toBe(true);
    expect(canShowAdoptionModeCta(baseCtx({ entity: { tipo_organo_admin: "CONSEJO_MANCOMUNADO" } }), "CO_APROBACION")).toBe(true);
    expect(canShowAdoptionModeCta(baseCtx(), "CO_APROBACION")).toBe(false);
  });

  it("canShowAdoptionModeCta(SOLIDARIO) requiere ADMIN_SOLIDARIO", () => {
    expect(canShowAdoptionModeCta(baseCtx({ entity: { tipo_organo_admin: "ADMIN_SOLIDARIO" } }), "SOLIDARIO")).toBe(true);
    expect(canShowAdoptionModeCta(baseCtx(), "SOLIDARIO")).toBe(false);
  });

  it("canShowCertificationCta requiere capability CERTIFICATION", () => {
    expect(canShowCertificationCta(baseCtx())).toBe(true);
    expect(canShowCertificationCta(baseCtx({ capabilities: { canSnapshot: false, canVote: false, canCertify: false } }))).toBe(false);
  });

  it("canShowVotingCta requiere agenda.kind=DECISORIO y capability de voto o censo", () => {
    expect(canShowVotingCta(baseCtx(), "DECISORIO")).toBe(true);
    expect(canShowVotingCta(baseCtx(), "INFORMATIVO")).toBe(false);
    expect(canShowVotingCta(baseCtx({ capabilities: { canSnapshot: false, canVote: false, canCertify: true } }), "DECISORIO")).toBe(false);
  });

  it("canShowRegistralActions exige acuerdo inscribible", () => {
    expect(canShowRegistralActions(baseCtx(), true)).toBe(true);
    expect(canShowRegistralActions(baseCtx(), false)).toBe(false);
    expect(canShowRegistralActions(baseCtx(), null)).toBe(false);
  });

  it("canShowCotizadaActions sigue el flag es_cotizada de la entidad", () => {
    expect(canShowCotizadaActions(baseCtx({ entity: { es_cotizada: true } }))).toBe(true);
    expect(canShowCotizadaActions(baseCtx({ entity: { es_cotizada: false } }))).toBe(false);
  });

});

describe("sidebar-visibility — excludesIfReferenceOnly loading-permissive (P0 fix)", () => {
  const item = (visibility: VisibleSecretariaNavItem["visibility"]): VisibleSecretariaNavItem => ({
    label: "x",
    to: "/x",
    icon: Users,
    visibility,
  });

  it("oculta cuando readiness está cargado y status=reference_only", () => {
    const refOnly = baseCtx({ readiness: { status: "reference_only" } });
    expect(isItemVisible(item({ excludesIfReferenceOnly: true }), refOnly)).toBe(false);
  });

  it("muestra cuando readiness está cargado y status=complete/partial", () => {
    expect(isItemVisible(item({ excludesIfReferenceOnly: true }), baseCtx({ readiness: { status: "complete" } }))).toBe(true);
    expect(isItemVisible(item({ excludesIfReferenceOnly: true }), baseCtx({ readiness: { status: "partial" } }))).toBe(true);
  });

  it("loading-permissive: deja pasar cuando readiness=null (aún cargando) para evitar flicker secundario", () => {
    // Caso crítico: sociedad+bodies ya cargados (entity != null), pero
    // readiness aún en vuelo. Antes del fix: item visible → llega readiness
    // reference_only → item desaparece. Después del fix: item visible y
    // se mantiene si readiness nunca llega o tarda; cuando readiness llega
    // reference_only, sí se oculta (sin parpadeo previo en el render inicial
    // porque el sidebar espera readiness en isInitialLoading).
    const loadingReadiness = baseCtx({ readiness: null });
    expect(isItemVisible(item({ excludesIfReferenceOnly: true }), loadingReadiness)).toBe(true);
  });

  it("combinado: requiresCollegiateBody + excludesIfReferenceOnly se aplican independientemente", () => {
    // Reuniones tiene ambas reglas. Verificamos que el AND funciona.
    const rule = { requiresCollegiateBody: true, excludesIfReferenceOnly: true };
    // SA+CDA+complete → visible
    expect(isItemVisible(item(rule), baseCtx())).toBe(true);
    // SA+CDA+reference_only → oculto por readiness
    expect(isItemVisible(item(rule), baseCtx({ readiness: { status: "reference_only" } }))).toBe(false);
    // SLU+ADMIN_UNICO+complete → oculto por body
    const slu = baseCtx({ bodyTypes: [], entity: { tipo_social: "SLU", tipo_organo_admin: "ADMIN_UNICO" } });
    expect(isItemVisible(item(rule), slu)).toBe(false);
  });
});
