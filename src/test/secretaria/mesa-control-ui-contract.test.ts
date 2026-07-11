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
    expect(catalogo).toContain("Iniciar expediente bloqueado");
    expect(catalogo).toContain("Asignar plantilla");

    // Lenguaje técnico prohibido en la vista abogado (informe §4/§7)
    expect(catalogo).not.toContain("Gate PRE");
    expect(catalogo).not.toContain("Simular preflight");
    expect(catalogo).not.toContain("Usada por el motor");
    expect(catalogo).not.toContain("Probar fusión");
    expect(catalogo).not.toContain("Configuración del motor de reglas");
    expect(catalogo).not.toContain("Estatutos no modelados para esta materia");
  });

  it("expone estados globales, vigencia de plantillas y duplicidades (Oleada 1)", () => {
    const catalogo = read("src/pages/secretaria/CatalogoMaterias.tsx");
    const model = read("src/lib/secretaria/mesa-control-societaria.ts");

    // Estado global por materia con CTA contextual (informe §10)
    expect(model).toContain("evaluateMateriaGlobalStatus");
    expect(model).toContain("Lista para iniciar expediente");
    expect(model).toContain("Bloqueada por falta de plantilla mínima");
    expect(model).toContain("Requiere revisión legal");
    expect(model).toContain("Advertencia no bloqueante");
    expect(catalogo).toContain("MateriaPrimaryCta");
    expect(catalogo).toContain("Resolver bloqueo");
    expect(catalogo).toContain("Revisar fuentes");
    expect(catalogo).toContain("Verificar requisitos antes de iniciar");

    // Leyenda de naturaleza + tooltips (informe §5/§6)
    expect(catalogo).toContain("Naturaleza de las materias");
    expect(catalogo).toContain("FORMALIZATION_CHIP_LEGEND");

    // Vigente vs histórica + duplicidades (informe §12)
    expect(catalogo).toContain("Vigente para nuevos expedientes");
    expect(catalogo).toContain("Versión anterior");
    expect(catalogo).toContain("Ver versiones anteriores");
    expect(catalogo).toContain("Posible duplicidad de plantilla");
    expect(catalogo).toContain("Vista previa del documento");
    expect(model).toContain("groupStageBindingsForDisplay");
    expect(model).toContain("detectTemplateDataDuplicates");

    // Alias legacy colapsados en presentación (la ortografía vive ya en BD:
    // migración 20260710103000 aplicada el 2026-07-11)
    expect(model).toContain("MATERIA_CANONICAL_ALIAS");

    // Estatutos sin ambigüedad (informe §6): dos mensajes distintos
    expect(catalogo).toContain("Estatutos no estructurados en el sistema para esta sociedad");
    expect(catalogo).toContain("no recogen regla especial para");
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

    expect(plantillas).toContain("useAssignTemplateBinding");
    expect(plantillas).toContain("useSearchParams");
    expect(plantillas).toContain("(p.materia_acuerdo ?? p.materia) === filterMateria");
    expect(plantillas).toContain("templateEngineSort");
    expect(plantillas).toContain("Configuración del motor");
    expect(plantillas).toContain("Vincular como plantilla activa");
    expect(plantillas).toContain("templateSelectionReason");
    expect(plantillas).toContain("Plantilla vinculada a la regla efectiva");
  });

  it("el catálogo de plantillas es operativo: ciclo segmentado, salud e incidencias (informe UX 2026-07-10)", () => {
    const plantillas = read("src/pages/secretaria/Plantillas.tsx");

    // Segmentación por ciclo con Vigentes por defecto (histórico a un clic, no oculto)
    expect(plantillas).toContain('useState<CicloSegment>("vigentes")');
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
