import { useMemo, useReducer, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { useSociedades } from "@/hooks/useSociedades";
import { buildRpcPayload } from "@/lib/secretaria/sociedad-onboarding/builders";
import { loadEntitySettingsCatalogKeys } from "@/lib/secretaria/sociedad-onboarding/catalog-loader";
import { createEmptySociedadDraft, isUnipersonalTipo } from "@/lib/secretaria/sociedad-onboarding/defaults";
import { persistInitialCargos, persistInitialRepresentaciones, type RepresentacionAdminPJInput } from "@/lib/secretaria/sociedad-onboarding/adapters";
import { validateSociedadOperability, validateStep } from "@/lib/secretaria/sociedad-onboarding/validation";
import type {
  AdapterContext,
  CargoInputDraft,
  SociedadOnboardingDraft,
  ValidationResult,
} from "@/lib/secretaria/sociedad-onboarding/types";
import { StepCapital } from "./sociedad-nueva/StepCapital";
import { StepCapTable } from "./sociedad-nueva/StepCapTable";
import { StepCargos } from "./sociedad-nueva/StepCargos";
import { StepClasesSeries } from "./sociedad-nueva/StepClasesSeries";
import { StepDocumentosSoporte } from "./sociedad-nueva/StepDocumentosSoporte";
import { StepDomicilioCnaeRegistro } from "./sociedad-nueva/StepDomicilioCnaeRegistro";
import { StepIdentificacionLegal } from "./sociedad-nueva/StepIdentificacionLegal";
import { StepOrganos } from "./sociedad-nueva/StepOrganos";
import { StepPerfilGrupo } from "./sociedad-nueva/StepPerfilGrupo";
import { StepReglas } from "./sociedad-nueva/StepReglas";
import { StepRevisionCreacion } from "./sociedad-nueva/StepRevisionCreacion";
import { IssueList } from "./sociedad-nueva/shared/IssueList";

const STEPS = [
  "Identificacion",
  "Domicilio",
  "Perfil",
  "Capital",
  "Clases",
  "Cap table",
  "Organos",
  "Cargos",
  "Reglas",
  "Soporte",
  "Revision",
];

type DraftAction = {
  updater: (draft: SociedadOnboardingDraft) => SociedadOnboardingDraft;
};

interface Tx1Result {
  entityId: string;
  bodyIds: Record<string, string>;
  settingsSkipped: string[];
}

function draftReducer(draft: SociedadOnboardingDraft, action: DraftAction) {
  return action.updater(draft);
}

function allIssues(result: ValidationResult) {
  return [...result.blocking, ...result.blockingOperational, ...result.warnings];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function objectToStringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, item]) => {
    if (typeof item === "string" && item) acc[key] = item;
    return acc;
  }, {});
}

function parseTx1Result(data: unknown): Tx1Result {
  if (!data || typeof data !== "object") {
    throw new Error("La RPC no devolvio resultado de alta");
  }
  const raw = data as Record<string, unknown>;
  const entityId = typeof raw.entity_id === "string" ? raw.entity_id : "";
  if (!entityId) throw new Error("La RPC no devolvio entity_id");
  return {
    entityId,
    bodyIds: objectToStringRecord(raw.body_ids),
    settingsSkipped: Array.isArray(raw.settings_skipped) ? raw.settings_skipped.map(String) : [],
  };
}

function adapterContextFromTx1(tenantId: string, tx1: Tx1Result): AdapterContext {
  const bodyJuntaId = tx1.bodyIds.JUNTA;
  const bodyAdminId = tx1.bodyIds.ADMIN ?? tx1.bodyIds.CDA;
  if (!bodyJuntaId || !bodyAdminId) {
    throw new Error("La RPC no devolvio los organos minimos para completar TX2");
  }
  const bodyComisiones: Record<string, string> = {};
  for (const key of [
    "COMISION_AUDITORIA",
    "COMISION_NOMBRAMIENTOS",
    "COMISION_RETRIBUCIONES",
    "COMISION_RIESGOS",
  ]) {
    if (tx1.bodyIds[key]) bodyComisiones[key] = tx1.bodyIds[key];
  }
  return {
    tenantId,
    entityId: tx1.entityId,
    bodyJuntaId,
    bodyAdminId,
    bodyConsejoId: tx1.bodyIds.CDA ?? null,
    bodyComisiones,
  };
}

function adminPJRepresentaciones(cargos: CargoInputDraft[]): RepresentacionAdminPJInput[] {
  const reps: RepresentacionAdminPJInput[] = [];
  for (const cargo of cargos) {
    if (cargo.tipo_condicion !== "ADMIN_PJ") continue;
    if (!cargo.persona?.representante) continue;
    reps.push({
      represented: cargo.persona,
      representante: cargo.persona.representante,
      effective_from: cargo.fecha_inicio,
      fuente: cargo.fuente_designacion,
    });
  }
  return reps;
}

export default function SociedadNuevaStepper() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantId, isLoading: tenantLoading } = useTenantContext();
  const { data: sociedades = [] } = useSociedades();
  const [draft, dispatch] = useReducer(draftReducer, undefined, () => createEmptySociedadDraft());
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const parentOptions = useMemo(
    () =>
      sociedades.map((sociedad) => ({
        value: sociedad.id,
        label: sociedad.common_name ?? sociedad.legal_name,
      })),
    [sociedades],
  );

  const stepValidation = validateStep(draft, step);
  const fullValidation = validateSociedadOperability(draft);
  const currentIssues = allIssues(stepValidation);
  const canNext = stepValidation.blocking.length === 0;
  const isLastStep = step === STEPS.length - 1;

  const replaceDraft = (nextDraft: SociedadOnboardingDraft) => {
    dispatch({ updater: () => nextDraft });
  };

  const patchSection = <K extends keyof SociedadOnboardingDraft>(
    section: K,
    patch: Partial<SociedadOnboardingDraft[K]>,
  ) => {
    dispatch({
      updater: (current) => ({
        ...current,
        [section]: {
          ...(current[section] as unknown as Record<string, unknown>),
          ...(patch as Record<string, unknown>),
        },
      }),
    });
  };

  const setSection = <K extends keyof SociedadOnboardingDraft>(
    section: K,
    value: SociedadOnboardingDraft[K],
  ) => {
    dispatch({
      updater: (current) => ({
        ...current,
        [section]: value,
      }),
    });
  };

  const prev = () => setStep((current) => Math.max(current - 1, 0));
  const next = () => {
    if (!canNext) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  async function invalidateSociedadQueries(tenant: string, entityId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sociedades", tenant] }),
      queryClient.invalidateQueries({ queryKey: ["entities", tenant] }),
      queryClient.invalidateQueries({ queryKey: ["governing_bodies"] }),
      queryClient.invalidateQueries({ queryKey: ["governing_bodies", tenant, "byEntity", entityId] }),
      queryClient.invalidateQueries({ queryKey: ["entity_capital_profile", tenant] }),
      queryClient.invalidateQueries({ queryKey: ["share_classes", tenant] }),
      queryClient.invalidateQueries({ queryKey: ["capital_holdings", tenant] }),
      queryClient.invalidateQueries({ queryKey: ["cargos", tenant] }),
      queryClient.invalidateQueries({ queryKey: ["representaciones", tenant] }),
      queryClient.invalidateQueries({ queryKey: ["personas_canonical", tenant] }),
    ]);
  }

  async function crearSociedad() {
    const validation = validateSociedadOperability(draft);
    if (validation.blocking.length > 0) {
      toast.error("Hay bloqueos que impiden crear la sociedad");
      return;
    }

    setSaving(true);
    let createdEntityId: string | null = null;

    try {
      if (!tenantId) throw new Error("No hay tenant activo para crear la sociedad");

      const catalogKeys = await loadEntitySettingsCatalogKeys();
      const payload = buildRpcPayload(draft, catalogKeys);
      const { data, error } = await supabase.rpc("fn_crear_sociedad_legal_y_capital", {
        p_tenant_id: tenantId,
        p_payload: payload,
      });
      if (error) throw error;

      const tx1 = parseTx1Result(data);
      createdEntityId = tx1.entityId;
      const adapterContext = adapterContextFromTx1(tenantId, tx1);

      let failedCargos = 0;
      let failedRepresentaciones = 0;
      try {
        const cargosResult = await persistInitialCargos(adapterContext, draft.cargos);
        const failedCargoKeys = new Set(cargosResult.failedCargos.map((failure) => failure.cargo.key));
        const repsResult = await persistInitialRepresentaciones(
          adapterContext,
          adminPJRepresentaciones(draft.cargos.filter((cargo) => !failedCargoKeys.has(cargo.key))),
        );
        failedCargos = cargosResult.failedCargos.length;
        failedRepresentaciones = repsResult.failedReps.length;
      } catch (tx2Error) {
        await invalidateSociedadQueries(tenantId, tx1.entityId);
        toast.warning("Sociedad creada con cargos pendientes", {
          description: `TX2 no se completo: ${errorMessage(tx2Error)}`,
        });
        navigate(`/secretaria/sociedades/${tx1.entityId}`);
        return;
      }

      const hasTx2Failures = failedCargos > 0 || failedRepresentaciones > 0;
      const hasOperationalBlocks = validation.blockingOperational.length > 0;
      if (!hasTx2Failures && !hasOperationalBlocks) {
        // F4.G16 — promoción via RPC server-side con guards de invariantes
        // (tenant, role, cargos mínimos). Reemplaza el UPDATE client-side
        // que era no-atómico con TX2. Si TX2 quedó parcial, el RPC valida y
        // emite check_violation; ya no quedan sociedades medio-promovidas
        // por race condition de red.
        const { data: promResult, error: promError } = await supabase.rpc(
          "fn_promover_sociedad_operativa",
          {
            p_tenant_id: tenantId,
            p_entity_id: tx1.entityId,
          },
        );
        if (promError) {
          toast.warning("Sociedad creada; no se pudo promover a operativa", {
            description: promError.message,
          });
        } else if (promResult && typeof promResult === "object" && "already_operativa" in promResult && promResult.already_operativa === true) {
          toast.success("Sociedad ya estaba en estado operativa");
        } else {
          toast.success("Sociedad creada y operativa");
        }
      } else {
        const pending = [
          hasOperationalBlocks ? `${validation.blockingOperational.length} validacion(es) operativa(s)` : "",
          failedCargos ? `${failedCargos} cargo(s)` : "",
          failedRepresentaciones ? `${failedRepresentaciones} representacion(es)` : "",
        ].filter(Boolean);
        toast.warning("Sociedad creada con tareas pendientes", {
          description: pending.join(" · "),
        });
      }

      if (tx1.settingsSkipped.length > 0) {
        toast.warning("Algunas reglas no estaban activas en el catalogo", {
          description: tx1.settingsSkipped.join(", "),
        });
      }

      await invalidateSociedadQueries(tenantId, tx1.entityId);
      navigate(`/secretaria/sociedades/${tx1.entityId}`);
    } catch (error) {
      const suffix = createdEntityId ? ` Sociedad creada: ${createdEntityId}` : "";
      toast.error(`No se pudo crear la sociedad: ${errorMessage(error)}${suffix}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1120px] p-4 sm:p-6">
      <div className="mb-4">
        <Link
          to="/secretaria/sociedades"
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> Sociedades
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Building2 className="h-3.5 w-3.5" />
          Secretaria · Nueva sociedad
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Alta de sociedad
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--g-text-secondary)]">
          La informacion se conserva en este asistente hasta la revision final. La base de datos se escribe en TX1 y los cargos iniciales en TX2.
        </p>
      </div>

      <ol className="mb-6 flex gap-2 overflow-x-auto pb-1 text-xs">
        {STEPS.map((label, index) => {
          const active = index === step;
          const done = index < step;
          return (
            <li key={label} className="shrink-0">
              <button
                type="button"
                onClick={() => setStep(index)}
                className={`inline-flex min-h-9 items-center gap-2 px-3 py-1.5 font-semibold ${
                  active
                    ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                    : done
                      ? "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                }`}
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <span>{index + 1}</span>}
                <span>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {currentIssues.length > 0 && !isLastStep ? (
        <div className="mb-4">
          <IssueList issues={currentIssues} />
        </div>
      ) : null}

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 sm:p-6"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {step === 0 ? (
          <StepIdentificacionLegal
            draft={draft.identification}
            fullDraft={draft}
            issues={currentIssues}
            onChange={(patch) => patchSection("identification", patch)}
            onDraftChange={replaceDraft}
          />
        ) : null}
        {step === 1 ? (
          <StepDomicilioCnaeRegistro
            draft={draft.registry}
            issues={currentIssues}
            onChange={(patch) => patchSection("registry", patch)}
          />
        ) : null}
        {step === 2 ? (
          <StepPerfilGrupo
            draft={draft.profile}
            issues={currentIssues}
            parentOptions={parentOptions}
            unipersonalLocked={isUnipersonalTipo(draft.identification.tipo_social)}
            onChange={(patch) => patchSection("profile", patch)}
          />
        ) : null}
        {step === 3 ? (
          <StepCapital
            draft={draft.capital}
            issues={currentIssues}
            onChange={(patch) => patchSection("capital", patch)}
          />
        ) : null}
        {step === 4 ? (
          <StepClasesSeries
            classes={draft.shareClasses}
            issues={currentIssues}
            onChange={(classes) => setSection("shareClasses", classes)}
          />
        ) : null}
        {step === 5 ? (
          <StepCapTable
            entries={draft.capTable}
            shareClasses={draft.shareClasses}
            totalTitles={draft.capital.numero_titulos}
            issues={currentIssues}
            onChange={(entries) => setSection("capTable", entries)}
          />
        ) : null}
        {step === 6 ? (
          <StepOrganos
            draft={draft.organos}
            isConsejo={draft.profile.tipo_organo_admin === "CDA"}
            issues={currentIssues}
            onChange={(patch) => patchSection("organos", patch)}
          />
        ) : null}
        {step === 7 ? (
          <StepCargos
            cargos={draft.cargos}
            issues={currentIssues}
            onChange={(cargos) => setSection("cargos", cargos)}
          />
        ) : null}
        {step === 8 ? (
          <StepReglas
            draft={draft.rules}
            tipoSocial={draft.identification.tipo_social}
            jurisdiction={draft.identification.jurisdiction}
            issues={currentIssues}
            onChange={(patch) => patchSection("rules", patch)}
          />
        ) : null}
        {step === 9 ? (
          <StepDocumentosSoporte
            docs={draft.supportDocs}
            onChange={(docs) => setSection("supportDocs", docs)}
          />
        ) : null}
        {step === 10 ? (
          <StepRevisionCreacion
            draft={draft}
            validation={fullValidation}
            saving={saving}
            disabled={tenantLoading || !tenantId}
            onCreate={crearSociedad}
          />
        ) : null}
      </section>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={prev}
          disabled={step === 0 || saving}
          className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Atras
        </button>
        {!isLastStep ? (
          <button
            type="button"
            onClick={next}
            disabled={!canNext || saving}
            className="inline-flex items-center justify-center bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Siguiente
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--status-warning)]" />
            La promocion a operativa solo ocurre si TX2 termina sin pendientes.
          </div>
        )}
      </div>
    </div>
  );
}
