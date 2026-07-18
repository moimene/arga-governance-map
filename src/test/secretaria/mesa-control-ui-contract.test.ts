import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("mesa de control jurídico-societaria — UI contract", () => {
  it("expone materias y reglas como entrada principal de mantenimiento", () => {
    const app = read("src/App.tsx");
    const navigation = read("src/components/secretaria/shell/navigation.ts");

    expect(app).toContain("/secretaria/catalogo-materias");
    expect(app).toContain("ReglasToCatalogoMateriasRedirect");
    expect(navigation).toContain("Materias y reglas");
    expect(navigation).not.toContain("to: \"/secretaria/reglas\"");
  });

  it("expone catálogo de órganos y wizard de activación normativa", () => {
    const app = read("src/App.tsx");
    const navigation = read("src/components/secretaria/shell/navigation.ts");
    const organos = read("src/pages/secretaria/CatalogoOrganos.tsx");
    const wizard = read("src/pages/secretaria/ActivarMarcoNormativo.tsx");

    expect(app).toContain("/secretaria/catalogo-organos");
    expect(app).toContain("/secretaria/sociedades/:id/marco-normativo/activar");
    expect(navigation).toContain("Catálogo de órganos");
    expect(organos).toContain("Órganos, competencias y reglamentos");
    expect(organos).toContain("Crear órgano");
    expect(organos).toContain("Fuente documental obligatoria");
    expect(organos).toContain("No se permite publicar órgano competente sin fuente documental");
    expect(organos).toContain("useUpsertOrganProfile");
    expect(wizard).toContain("Wizard de activación normativa");
    expect(wizard).toContain("useRecordNormativeMaintenanceEvent");
    expect(wizard).toContain("handleDiagnosticAction");
    expect(wizard).toContain("Publicar estatutos exige documento real");
    expect(wizard).toContain('startsWith("secretaria://estatutos/version-demo")');
    expect(wizard).toContain('startsWith("demo-")');
    expect(wizard).not.toContain('documentUri: "secretaria://estatutos/version-demo"');
    expect(wizard).not.toContain("documentHash: `demo-");
    expect(wizard).not.toContain("sin escritura Cloud");
  });

  it("la ficha de materia habla el idioma del abogado (informe UX 2026-07-10, Oleada 1)", () => {
    const catalogo = read("src/pages/secretaria/CatalogoMaterias.tsx");

    // Copy jurídico aprobado
    expect(catalogo).toContain("Regla aplicable y documentos de la materia");
    expect(catalogo).toContain("Cadena de decisión");
    expect(catalogo).toContain("Materia");
    expect(catalogo).toContain("Regla aplicable");
    expect(catalogo).toContain("Verificación previa");
    expect(catalogo).toContain("Resultado de la verificación");
    expect(catalogo).toContain("Qué exige la ley");
    expect(catalogo).toContain("Qué añaden los estatutos");
    expect(catalogo).toContain("Pactos aplicables");
    expect(catalogo).toContain("Regla aplicable para esta sociedad");
    expect(catalogo).toContain("Reglas aplicables y requisitos para tramitar");
    expect(catalogo).toContain("Ver documentos y plantillas de esta materia");
    expect(catalogo).toContain("Documentos y plantillas de esta materia");
    expect(catalogo).toContain("Verificación previa del expediente");
    expect(catalogo).toContain("No se puede iniciar la adopción");
    expect(catalogo).toContain("readiness?.actionLabel");
    expect(read("src/lib/secretaria/mesa-control-societaria.ts")).toContain("Vincular plantilla");

    // Lenguaje técnico prohibido en la vista abogado (informe §4/§7)
    expect(catalogo).not.toContain("Gate PRE");
    expect(catalogo).not.toContain("Simular preflight");
    expect(catalogo).not.toContain("Usada por el motor");
    expect(catalogo).not.toContain("Probar fusión");
    expect(catalogo).not.toContain("Configuración del motor de reglas");
    expect(catalogo).not.toContain("para que el motor habilite el expediente");
    expect(catalogo).not.toContain("overrides documentales");
    expect(catalogo).not.toContain("No hay overrides publicados");
    expect(catalogo).not.toContain("Estatutos no modelados para esta materia");
  });

  it("expone estados globales, vigencia de plantillas y duplicidades (Oleada 1)", () => {
    const catalogo = read("src/pages/secretaria/CatalogoMaterias.tsx");
    const model = read("src/lib/secretaria/mesa-control-societaria.ts");

    // Estado global por materia con CTA contextual (informe §10)
    expect(model).toContain("evaluateMateriaGlobalStatus");
    expect(model).toContain("Lista para iniciar la adopción");
    expect(model).toContain("Bloqueada por falta de plantilla mínima");
    expect(model).toContain("Requiere revisión legal");
    expect(model).toContain("Advertencia no bloqueante");
    expect(catalogo).toContain("MateriaPrimaryCta");
    expect(catalogo).toContain("Resolver bloqueo");
    expect(catalogo).toContain("Revisar fuentes");
    expect(catalogo).toContain("Verificar requisitos antes de iniciar");

    // Glosario accesible de naturaleza y formalización (informe §5/§6)
    expect(catalogo).toContain("Cómo interpretar el catálogo");
    expect(catalogo).toContain("FORMALIZATION_CHIP_LEGEND");

    // Vigente vs histórica + duplicidades (informe §12)
    expect(catalogo).toContain("Vigente para nuevos expedientes");
    expect(catalogo).toContain("Versión anterior");
    expect(catalogo).toContain("Ver versiones anteriores");
    expect(catalogo).toContain("Duplicidad de plantilla vigente");
    expect(catalogo).toContain("Vista previa del documento");
    expect(model).toContain("groupStageBindingsForDisplay");
    expect(model).toContain("detectTemplateDataDuplicates");

    // Alias legacy colapsados en presentación (la ortografía vive ya en BD:
    // migración 20260710103000 aplicada el 2026-07-11)
    expect(model).toContain("MATERIA_CANONICAL_ALIAS");
    expect(model).toContain("EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE");
    expect(catalogo).toContain("También denominada exclusión del derecho de suscripción preferente");

    // Estatutos sin ambigüedad (informe §6): dos mensajes distintos
    expect(catalogo).toContain("Estatutos no estructurados en el sistema para esta sociedad");
    expect(catalogo).toContain("no recogen regla especial para");
  });

  it("convierte Materias y reglas en un catálogo buscable, comparable y explicable (Fase 2A)", () => {
    const catalogo = read("src/pages/secretaria/CatalogoMaterias.tsx");
    const model = read("src/lib/secretaria/materia-catalog-ux.ts");
    const help = read("src/components/secretaria/MateriaCatalogHelp.tsx");
    const readiness = read("src/lib/secretaria/mesa-control-societaria.ts");

    expect(catalogo).toContain("Materias y reglas");
    expect(catalogo).toContain("Buscar por materia, artículo o documento");
    expect(catalogo).toContain('searchParams.get("presentacion")');
    expect(catalogo).toContain('searchParams.get("mayoria")');
    expect(catalogo).toContain('searchParams.get("formalizacion")');
    expect(catalogo).toContain('searchParams.get("estado")');
    expect(catalogo).toContain("Tabla comparativa");
    expect(catalogo).toContain("Difiere del mínimo de catálogo");
    expect(catalogo).toContain("¿Por qué se aplica esta regla?");
    expect(catalogo).toContain("Fuente determinante");
    expect(catalogo).toContain("Fuentes revisadas");
    expect(catalogo).toContain("Nota de uso");
    expect(catalogo).toContain("Campos obligatorios al generar");
    expect(catalogo).toContain("Criticidad");
    expect(catalogo).not.toContain('label="Fuente determinante" value={matrixRow?.fuente');

    expect(model).toContain("extractRulePackDocuments");
    expect(model).toContain("convocatoria.documentosObligatorios");
    expect(model).toContain("documentacion.obligatoria");
    expect(model).toContain("groupActiveRulePacksByOrgano");
    expect(model).toContain("buildRuleApplicabilityExplanation");
    expect(model).toContain("MATERIA_USAGE_NOTES");

    expect(help).toContain("Definición");
    expect(help).toContain("Consecuencia");
    expect(help).toContain("Qué hacer");
    expect(help).toContain("<details");

    expect(readiness).toContain('openingStatus: "not_applicable"');
    expect(readiness).toContain('criticality === "apertura" && status !== "activa"');
    expect(readiness).toContain("No aplica abrir expediente · dejar constancia en acta");
  });

  it("el perfil de sociedad contiene matriz materia × requisitos", () => {
    const sociedadDetalle = read("src/pages/secretaria/SociedadDetalle.tsx");

    expect(sociedadDetalle).toContain("Marco normativo");
    expect(sociedadDetalle).toContain("Matriz materia × requisitos");
    expect(sociedadDetalle).toContain("órgano competente");
  });

  it("el alta de sociedad configura fuentes y bloquea rebajas del mínimo legal", () => {
    const stepReglas = read("src/pages/secretaria/sociedad-nueva/StepReglas.tsx");
    const validation = read("src/lib/secretaria/sociedad-onboarding/validation.ts");
    const model = read("src/lib/secretaria/mesa-control-societaria.ts");

    expect(stepReglas).toContain("Suelo legal aplicable");
    expect(stepReglas).toContain("Estatutos modelados");
    expect(stepReglas).toContain("Pactos parasociales modelados");
    expect(model).toContain("Este requisito no puede rebajar el mínimo legal");
    expect(validation).toContain("validateNormativeOverrideDraft");
  });

  it("el expediente muestra una mesa de control con acciones, pendientes y bloqueos", () => {
    const expediente = read("src/pages/secretaria/ExpedienteAcuerdo.tsx");

    expect(expediente).toContain("Mesa de control del acuerdo");
    expect(expediente).toContain("Qué puedo hacer");
    expect(expediente).toContain("Qué falta");
    expect(expediente).toContain("Qué bloquea");
    expect(expediente).toContain("Próximos pasos");
  });

  it("corrige pre-votación, conflicto jurisdiccional y lenguaje operativo", () => {
    const ruleManager = read("src/pages/secretaria/RuleManagerPage.tsx");
    const model = read("src/lib/secretaria/mesa-control-societaria.ts");
    const navigation = read("src/components/secretaria/shell/navigation.ts");

    expect(navigation).toContain("Materias y reglas");
    expect(navigation).not.toContain("Regla efectiva");
    expect(ruleManager).toContain("Validación preliminar. No ejecutable");
    expect(ruleManager).toContain("Posible conflicto de ley aplicable");
    expect(ruleManager).toContain("Solicitar alta de materia");
    expect(model).toContain("conflict_of_laws_flag");
    expect(model).toContain("ff_ruleset_wizard");
  });

  it("expone gobierno operativo: permisos, historial, auditoría y rollout", () => {
    const ruleManager = read("src/pages/secretaria/RuleManagerPage.tsx");
    const wizard = read("src/pages/secretaria/ActivarMarcoNormativo.tsx");
    const catalogo = read("src/pages/secretaria/CatalogoMaterias.tsx");
    const model = read("src/lib/secretaria/mesa-control-societaria.ts");

    expect(ruleManager).toContain("Historial y trazabilidad");
    expect(ruleManager).toContain("Evento preparado");
    expect(ruleManager).toContain("usePublishNormativeOverride");
    expect(ruleManager).toContain("Publicar override");
    expect(ruleManager).toContain("Completa valor, fuente documental y justificación");
    expect(wizard).toContain("Evento de auditoría preparado");
    expect(wizard).toContain("Rollout");
    expect(wizard).toContain("Solicitar edición");
    expect(catalogo).toContain("Solicitar edición");
    expect(model).toContain("canPerformNormativeAction");
    expect(model).toContain("buildNormativeAuditEvent");
    expect(model).toContain("buildNormativeRolloutPlan");
    expect(model).toContain("buildNormativeTelemetryEvent");
    expect(model).toContain("buildNormativeReadModelContracts");
    expect(wizard).toContain("Controles de despliegue");
    expect(wizard).toContain("Criterios de salida");
    expect(wizard).toContain("Backfill legacy");
    expect(wizard).toContain("Telemetría preparada para la publicación del marco");
    expect(ruleManager).toContain("Telemetría preparada para la consulta de regla efectiva");
  });

  it("conecta bindings de plantillas a la regla efectiva", () => {
    const plantillas = read("src/pages/secretaria/Plantillas.tsx");
    const libraryUx = read("src/lib/secretaria/template-library-ux.ts");

    expect(plantillas).toContain("useAssignTemplateBinding");
    expect(plantillas).toContain("useSearchParams");
    expect(plantillas).toContain("resolveMateriaAlias(p.materia_acuerdo ?? p.materia) === filterMateria");
    expect(plantillas).toContain("templateEngineSort");
    expect(plantillas).toContain("Configuración de uso");
    expect(plantillas).toContain("Vincular como plantilla vigente");
    expect(plantillas).toContain("buildTemplateBindingMutationInput");
    expect(libraryUx).toContain("templateSelectionReason");
    expect(plantillas).toContain("Plantilla vinculada a la regla aplicable");
    expect(plantillas).not.toContain("Configuración del motor:");
  });

  it("el catálogo de plantillas es operativo: ciclo segmentado, salud e incidencias (informe UX 2026-07-10)", () => {
    const plantillas = read("src/pages/secretaria/Plantillas.tsx");

    // Segmentación por ciclo con Vigentes por defecto (histórico a un clic, no oculto)
    expect(plantillas).toContain("isTemplateCycleParam(requested)");
    expect(plantillas).toContain("Filtrar plantillas por ciclo de vida");
    expect(plantillas).toContain('{ id: "historico", label: "Histórico" }');

    // Panel de salud con lectura ejecutiva (sustituye la métrica ambigua "Jurisdicción N")
    expect(plantillas).toContain("Biblioteca operativa con advertencias");
    expect(plantillas).toContain("Incidencias");
    expect(plantillas).not.toContain("scopeMetrics.exactJurisdiction");

    // Incidencias agregadas reutilizando legal-template-review (no un 5º sistema)
    expect(plantillas).toContain("buildLegalTemplateReviewRows");
    expect(plantillas).toContain("summarizeLegalTemplateReview");
    expect(plantillas).toContain("matchesLegalTemplateReviewFilter");
    expect(plantillas).toContain("Versión provisional");
    expect(plantillas).toContain("Vigente con advertencia de madurez");

    // Variantes jurídicas visibles a nivel de fila (junta vs consejo)
    expect(plantillas).toContain("'Órgano' : 'Jurisdicción'");
    expect(plantillas).toContain("Adopción");

    // Histórico accionable: sustitución hacia la versión vigente
    expect(plantillas).toContain("Sustituida para nuevos expedientes");
    expect(plantillas).toContain("Ver versión vigente");
  });

  it("compara versiones y mantiene tabs, URL, foco y semántica NULL accesibles (Fase 2B)", () => {
    const plantillas = read("src/pages/secretaria/Plantillas.tsx");
    const libraryUx = read("src/lib/secretaria/template-library-ux.ts");

    // Linaje seguro y acción histórica exacta; una ausencia no se disfraza de sustitución.
    expect(plantillas).toContain("buildTemplateVersionComparison");
    expect(plantillas).toContain("Comparar con vigente");
    expect(plantillas).toContain("Sin versión vigente comparable");
    expect(plantillas).toContain("Comparación de versiones");
    expect(libraryUx).toContain("buildTemplateVersionComparison");
    expect(libraryUx).toContain("findExactCurrentTemplate");

    // Tabs accesibles y persistentes: Modelos conserva el identificador estable en la URL.
    expect(plantillas).toContain('role="tablist"');
    expect(plantillas).toContain('role="tab"');
    expect(plantillas).toContain("aria-selected");
    expect(plantillas).toContain("aria-controls");
    expect(plantillas).toContain('event.key === "ArrowRight"');
    expect(plantillas).toContain('event.key === "Home"');
    expect(plantillas).toContain('tab === "modelos" ? "MODELO_ACUERDO" : null');

    // NULL en plantilla significa todos; el foco móvil aterriza en un panel identificable.
    expect(plantillas).toContain("tipoSocialLabel(selected.tipo_social)");
    expect(libraryUx).toContain("Todos los tipos sociales");
    expect(plantillas).toContain("showTipoSocialColumn");
    expect(plantillas).toContain("Detalle de la plantilla seleccionada");
    expect(plantillas).toContain("shouldFocusDetailRef");
    expect(plantillas).toContain("min-h-11");

    // Mutaciones humanas: aprobación completa, actor real y tipo social canónico.
    expect(plantillas).toContain("TemplateApprovalDialog");
    // B14 Lote 2: la aprobación formal exige los mismos datos en el gestor —
    // nada de autoaprobación silenciosa con el email de sesión vía confirm.
    expect(read("src/components/secretaria/gestor/CatalogoTab.tsx")).toContain(
      "TemplateApprovalDialog",
    );
    expect(read("src/components/secretaria/gestor/CatalogoTab.tsx")).toContain(
      "setApprovalOpen(true)",
    );
    expect(plantillas).toContain("aprobadaPor");
    expect(plantillas).toContain("fechaAprobacion");
    expect(plantillas).toContain("actor: transitionActor");
    expect(plantillas).toContain("canonicalBindingTipoSocial(selectedEntity?.tipoSocial)");
    expect(plantillas).not.toContain('tipoSocial: selectedEntity?.legalForm ?? "ANY"');
    expect(plantillas).toContain("Ya vinculada a esta regla");
  });

  it("unifica glosario, NULL tipado, tonos e incidencias en las tres superficies (Fase 1)", () => {
    const labels = read("src/lib/secretaria/template-admin/labels.ts");
    const review = read("src/lib/secretaria/legal-template-review.ts");
    const gestor = read("src/components/secretaria/gestor/CatalogoTab.tsx");
    const plantillas = read("src/pages/secretaria/Plantillas.tsx");
    const materias = read("src/pages/secretaria/CatalogoMaterias.tsx");
    const loadError = read("src/components/secretaria/ConfigurationLoadError.tsx");
    const scopeHook = read("src/components/secretaria/shell/useSecretariaScope.ts");
    const scopeSwitcher = read("src/components/secretaria/shell/ScopeSwitcher.tsx");
    const validacion = read("src/components/secretaria/gestor/ValidacionTab.tsx");
    const triCapa = read("src/components/secretaria/gestor/TriCapaEditor.tsx");

    expect(labels).toContain("Órgano no informado");
    expect(labels).toContain("Adopción no informada");
    expect(labels).toContain("No aplica");
    expect(labels).toContain("Todos los tipos sociales");
    expect(labels).toContain("Cualquier órgano");
    expect(labels).toContain("Cualquier forma de adopción");
    expect(labels).toContain("SEMANTIC_TONE_CLASS");
    expect(labels).toContain("DEPRECADA: \"neutral\"");

    expect(review).toContain("Duplicidad de plantilla vigente");
    expect(review).toContain('normalizeCode(template.estado) !== "ACTIVA"');
    expect(review).not.toContain("Existe mas de una plantilla para la misma materia");

    expect(gestor).toContain("Comprobación documental previa");
    expect(gestor).not.toContain("(Gate PRE)");
    expect(gestor).toContain("Cobertura provisional");
    expect(gestor).toContain("No se ha encontrado la plantilla solicitada en este ámbito.");
    expect(gestor).toContain("No aparece en el catálogo de uso porque no es una fila Cloud gobernada.");
    expect(plantillas).toContain("No se ha encontrado la plantilla solicitada en este ámbito.");
    expect(plantillas).toContain("statusLabel(selectedEntity.status)");
    for (const surface of [gestor, plantillas]) {
      expect(surface).toContain("operationId");
      expect(surface).toContain("expectedFrom");
      expect(surface).toContain("expectedPredecessorId");
      expect(surface).toContain(
        "La plantilla cambió en otra sesión. Estamos actualizando los datos; revisa su estado antes de volver a intentarlo.",
      );
      expect(surface).toContain(
        "La plantilla vigente que iba a sustituirse ha cambiado. Estamos actualizando los datos; revisa la identidad documental antes de confirmar de nuevo.",
      );
      expect(surface).toContain("ACTIVE_BINDINGS_REQUIRE_REPLACEMENT");
      expect(surface).toContain(
        "Esta plantilla tiene vinculaciones activas. Activa primero una plantilla sustituta de la misma identidad documental; las vinculaciones se moverán automáticamente antes de archivar la vigente.",
      );
    }
    expect(gestor).toContain("actor: transitionActor");
    expect(gestor).toContain('transition.next === "APROBADA"');
    expect(gestor).not.toContain('aprobada_por: user?.email');
    expect(plantillas).toMatch(
      /reason === "STALE_STATE"[\s\S]{0,500}setApprovalTarget\(null\)/,
    );
    expect(plantillas).toMatch(
      /reason === "STALE_PREDECESSOR"[\s\S]{0,500}setApprovalTarget\(null\)/,
    );
    expect(plantillas).toMatch(
      /reason === "INVALID_TRANSITION"[\s\S]{0,400}setApprovalTarget\(null\)/,
    );
    expect(materias).toContain("No se ha encontrado la materia solicitada en este ámbito.");
    expect(materias).toContain("scope: routeScope");
    expect(loadError).toContain("No se muestran datos parciales");
    expect(loadError).toContain('role="alert"');
    expect(scopeHook).toContain('params.set(SCOPE_PARAM, "grupo")');
    expect(scopeHook).toContain("params.delete(ENTITY_PARAM)");
    expect(scopeSwitcher).toContain('params.set("scope", "grupo")');
    expect(gestor).not.toContain('title="Gate PRE — Configuración"');
    expect(validacion).toContain("Comprobar todas las plantillas");
    expect(validacion).not.toContain("Ejecutar Gate PRE global");
    expect(triCapa).toContain("Capa 2 — Variables automáticas");
    expect(triCapa).not.toContain("Capa 2 — Variables del motor");
  });

  it("convierte Gobierno de plantillas en una consola jurídica agrupada y accesible (Fase 2C)", () => {
    const shell = read("src/pages/secretaria/GestorPlantillas.tsx");
    const guards = read("src/components/secretaria/gestor/tab-guards.ts");
    const dashboard = read("src/components/secretaria/gestor/DashboardTab.tsx");
    const catalogo = read("src/components/secretaria/gestor/CatalogoTab.tsx");
    const triCapa = read("src/components/secretaria/gestor/TriCapaEditor.tsx");
    const layerUx = read("src/lib/secretaria/template-layer-ux.ts");
    const governanceUx = read("src/lib/secretaria/template-governance-ux.ts");
    const auditoria = read("src/components/secretaria/gestor/AuditoriaTab.tsx");
    const metricas = read("src/components/secretaria/gestor/MetricasTab.tsx");

    expect(guards).toContain('dashboard: "Salud documental"');
    expect(guards).toContain('catalogo: "Catálogo gobernado"');
    expect(guards).toContain('cobertura: "Cobertura por materia y órgano"');
    expect(guards).toContain('metricas: "Indicadores de ciclo de vida"');
    expect(guards).toContain('auditoria: "Auditoría e historial de cambios"');
    expect(guards).toContain('validacion: "Comprobación documental"');
    expect(guards).toContain('configuracion: "Configuración por sociedad"');
    expect(guards).toContain("TAB_ORDER.filter(canAccess)");

    expect(shell).toContain("Comprobando acceso a las secciones");
    expect(shell).toContain("tabIndex={isActive ? 0 : -1}");
    expect(shell).toContain('event.key === "ArrowRight"');
    expect(shell).toContain('event.key === "Home"');
    expect(shell).toContain("min-h-11");

    expect(dashboard).toContain("buildTemplateGovernanceIncidents");
    expect(dashboard).toContain("Cola de incidencias");
    expect(dashboard).toContain("Consecuencia");
    expect(dashboard).toContain("Acción recomendada");
    expect(dashboard).toContain("cobertura obligatoria");

    expect(catalogo).toContain("groupTemplatesForGovernance");
    expect(catalogo).toContain("Biblioteca gobernada por tipo, materia, variante jurídica y serie de versiones");
    expect(catalogo).toContain('searchParams.get("q")');
    expect(catalogo).toContain('searchParams.get("modo") === "tecnica"');
    expect(catalogo).toContain("Materia: {labelMateria");
    expect(catalogo).toContain("Sin versión vigente comparable");
    expect(governanceUx).toContain("buildFunctionalKey");
    expect(governanceUx).toContain("family.containsTarget");

    expect(triCapa).toContain("Vista legal del texto protegido");
    expect(triCapa).toContain("Uso en el texto");
    expect(triCapa).toContain("Obligatoriedad");
    expect(triCapa).toContain("aria-invalid");
    expect(triCapa).not.toContain("dangerouslySetInnerHTML");
    expect(layerUx).toContain("serializeCapa2Rows");
    expect(layerUx).toContain("serializeCapa3Rows");
    expect(layerUx).toContain("field");
    expect(layerUx).toContain("hint");

    expect(auditoria).toContain("Evidencia forense general");
    expect(auditoria).toContain("evidenceOpen ?");
    expect(metricas).toContain("son estimaciones construidas con las fechas disponibles");
    expect(metricas).toContain("max-h-[36rem]");
  });

  it("exporta la matriz visible y la auditoría cargada sin exagerar su alcance (Fase 3)", () => {
    const materias = read("src/pages/secretaria/CatalogoMaterias.tsx");
    const auditoria = read("src/components/secretaria/gestor/AuditoriaTab.tsx");
    const csv = read("src/lib/secretaria/csv-export.ts");

    expect(materias).toContain("Exportar matriz CSV");
    expect(materias).toContain("filteredCatalogItems.map");
    expect(materias).toContain(
      "El CSV refleja únicamente las materias visibles y el ámbito seleccionado.",
    );
    expect(materias).toContain("Código de materia");
    expect(materias).toContain("ID de sociedad");
    expect(materias).toContain("const generatedOn = formatCsvDate()");
    expect(materias).toContain('setExportStatus("No se ha podido descargar la matriz de materias. Inténtalo de nuevo.")');
    expect(materias).toContain('role={exportFailed ? "alert" : "status"}');

    expect(auditoria).toContain("Exportar historial de cambios filtrado");
    expect(auditoria).toContain("Exportar plantillas sin historial");
    expect(auditoria).toContain("CSV de trabajo; el historial disponible es incompleto.");
    expect(auditoria).toContain("hasta 200 entradas recientes");
    expect(auditoria).toContain("filteredChangelog.map");

    expect(csv).toContain('const UTF8_BOM = "\\uFEFF"');
    expect(csv).toContain('const DELIMITER = ";"');
    expect(csv).toContain("protectFormula");
    expect(csv).toContain("formatCsvDate");
    expect(csv).toContain("downloadCsv");
  });

  it("no filtra metadatos demo en textos visibles de negocio", () => {
    const revision = read("src/pages/secretaria/DocumentosPendientesRevision.tsx");
    const generar = read("src/pages/secretaria/GenerarDocumentoStepper.tsx");
    const catalogo = read("src/pages/secretaria/CatalogoMaterias.tsx");
    const evidenceLabels = read("src/lib/secretaria/evidence-status-labels.ts");

    expect(revision).not.toContain("archivados como DEMO_OPERATIVA");
    // P0-4 (auditoría UX 2026-06-20): el subcopy ya no presenta la evidencia de entorno
    // demo como "evidencia operativa". El disclaimer de entorno de validación funcional
    // vive ahora en EvidenceStatusBadge, no en el encabezado de la bandeja.
    expect(revision).not.toContain("evidencia operativa");
    // UX-3.B: copy de Revisión documental aprobado (informe §6.5/§8.3/§8.5/§9.5).
    expect(revision).toContain("Revisión documental");
    expect(revision).toContain(
      "Revisa documentos generados o anexados antes de aprobarlos, archivarlos o marcarlos como sustituidos.",
    );
    expect(revision).toContain("Pendientes de revisión");
    expect(revision).toContain("Documentos cerrados");
    expect(revision).toContain("Aprobar documento");
    expect(revision).toContain("Marcar como sustituido");
    expect(revision).toContain("Documento archivado con trazabilidad. Conservamos su huella y versión.");
    expect(revision).toContain("Usa esta acción cuando exista una versión posterior o el documento ya no deba utilizarse.");
    // UX-0.F (informe legal §7.3): el stepper rotula la evidencia con el copy aprobado
    // vía EvidenceStatusBadge/evidenceStatusDescriptor ("Entorno de validación funcional"),
    // nunca con la etiqueta ambigua "Evidencia operativa" ni presentando la evidencia demo
    // como cualificada. La aserción negativa se conserva y se refuerza (case-insensitive).
    expect(generar).not.toMatch(/evidencia demo operativa/i);
    expect(generar).not.toContain("Evidencia operativa");
    expect(generar).toContain("EvidenceStatusBadge");
    // El copy aprobado §7.3 que ve el usuario vive en el descriptor compartido que
    // consume EvidenceStatusBadge: se verifica aquí que la cadena llega al copy real.
    expect(evidenceLabels).toContain("Entorno de validación funcional");
    expect(evidenceLabels).toContain("sin eficacia jurídica cualificada productiva");
    expect(catalogo).toContain("Trazabilidad preparada para el bloqueo del expediente");
  });

  it("oculta claves internas de adopción y reglas en flujos visibles de Secretaría", () => {
    const generar = read("src/pages/secretaria/GenerarDocumentoStepper.tsx");
    const tramitador = read("src/pages/secretaria/TramitadorStepper.tsx");
    const co = read("src/pages/secretaria/CoAprobacionStepper.tsx");
    const solidario = read("src/pages/secretaria/SolidarioStepper.tsx");
    const procesosGrupo = read("src/pages/secretaria/ProcesosGrupo.tsx");

    expect(generar).toContain("forma de adopción: {adoptionModeBusinessLabel");
    expect(generar).not.toContain("adopción: {agreement.adoption_mode}");
    expect(tramitador).toContain("Tipo de materia: {matterClassBusinessLabel");
    expect(tramitador).toContain("Forma de adopción: {adoptionModeBusinessLabel");
    expect(tramitador).not.toContain("fallback técnico");
    expect(co).not.toContain("adoption_mode = CO_APROBACION");
    expect(solidario).not.toContain("adoption_mode = SOLIDARIO");
    expect(procesosGrupo).toContain("forma de adopción y la regla legal aplicable");
    expect(procesosGrupo).not.toContain("AdoptionMode y el rule pack aplicable");
  });
});
