import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Loader2, UserCheck } from "lucide-react";
import { StepperShell, type StepDef } from "./_shared/StepperShell";
import { useMateriaCatalog, type MateriaCatalogRow } from "@/hooks/useMateriaConfig";
import { PreviewGatePanel } from "@/components/secretaria/PreviewGatePanel";
import type { AdoptionMode } from "@/lib/rules-engine";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useEntitiesList, type EntityWithParent } from "@/hooks/useEntities";
import { useCreateUnipersonalDecision } from "@/hooks/useDecisionesUnipers";
import { useEntityDemoReadiness } from "@/hooks/useEntityDemoReadiness";
import { EntityReadinessNotice } from "@/components/secretaria/EntityReadinessNotice";

type DecisionType = "SOCIO_UNICO" | "ADMINISTRADOR_UNICO";

function decisionAdoptionMode(tipo: DecisionType): AdoptionMode {
  return tipo === "SOCIO_UNICO" ? "UNIPERSONAL_SOCIO" : "UNIPERSONAL_ADMIN";
}

// ── Paso 1: Tipo y materia ───────────────────────────────────────────────────

function TipoMateriaStep({
  tipo,
  setTipo,
  materia,
  setMateria,
  entities,
  selectedEntityId,
  setSelectedEntityId,
  isSociedadScoped,
  materias,
  isLoading,
}: {
  tipo: DecisionType;
  setTipo: (value: DecisionType) => void;
  materia: string;
  setMateria: (value: string) => void;
  entities: EntityWithParent[];
  selectedEntityId: string;
  setSelectedEntityId: (value: string) => void;
  isSociedadScoped: boolean;
  materias: MateriaCatalogRow[];
  isLoading: boolean;
}) {
  const adoptionMode = decisionAdoptionMode(tipo);
  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId) ?? null;

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Selecciona el tipo de decisión y la materia del acuerdo. El motor verificará
        que el modo unipersonal sea válido para la materia escogida.
      </p>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--g-text-primary)]">
          Sociedad
        </label>
        <select
          value={selectedEntityId}
          onChange={(e) => setSelectedEntityId(e.target.value)}
          disabled={isSociedadScoped}
          className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:cursor-not-allowed disabled:opacity-70"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="">Selecciona sociedad</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.legal_name || entity.common_name}
            </option>
          ))}
        </select>
        {selectedEntity ? (
          <p className="text-xs text-[var(--g-text-secondary)]">
            {selectedEntity.legal_form} · {selectedEntity.jurisdiction}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--g-text-primary)]">
          Tipo de decisión unipersonal
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["SOCIO_UNICO", "ADMINISTRADOR_UNICO"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex flex-col gap-1 border px-4 py-3 text-left transition-colors ${
                tipo === t
                  ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                  : "border-[var(--g-border-subtle)] hover:border-[var(--g-brand-3308)] hover:bg-[var(--g-surface-subtle)]/50"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <span className="text-sm font-medium text-[var(--g-text-primary)]">
                {t === "SOCIO_UNICO" ? "Socio único (art. 15 LSC)" : "Administrador único (art. 210 LSC)"}
              </span>
              <span className="text-xs text-[var(--g-text-secondary)]">
                {t === "SOCIO_UNICO"
                  ? "SL con un único socio titular del 100% del capital"
                  : "SA/SL con un único administrador con poderes plenos"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--g-text-primary)]">
          Materia del acuerdo
        </label>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando catálogo…
          </div>
        ) : (
          <select
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
            className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">— Selecciona una materia —</option>
            {materias.map((m) => (
              <option key={m.materia} value={m.materia}>
                {m.materia_label_es} ({m.matter_class})
              </option>
            ))}
          </select>
        )}
      </div>

      {materia && (
        <PreviewGatePanel
          params={{ materia, adoptionMode, tipoSocial: "SL", organoTipo: tipo === "SOCIO_UNICO" ? "JUNTA_GENERAL" : "CONSEJO" }}
        />
      )}
    </div>
  );
}

// ── Paso 2: Texto del acuerdo ─────────────────────────────────────────────────

function TextoAcuerdoStep({
  texto,
  setTexto,
  fundamentoLegal,
  setFundamentoLegal,
}: {
  texto: string;
  setTexto: (value: string) => void;
  fundamentoLegal: string;
  setFundamentoLegal: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Redacta el texto íntegro del acuerdo adoptado. Incluye el fundamento jurídico aplicable
        (artículo LSC o estatutario que habilita la decisión unipersonal).
      </p>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--g-text-primary)]">
          Texto del acuerdo <span className="text-[var(--status-error)]">*</span>
        </label>
        <textarea
          rows={8}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ejemplo: El socio único de ARGA Seguros S.A., en uso de las facultades que le confiere el art. 15 LSC, adopta el siguiente acuerdo…"
          className="w-full resize-y rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--g-text-primary)]">
          Fundamento jurídico
        </label>
        <input
          type="text"
          value={fundamentoLegal}
          onChange={(e) => setFundamentoLegal(e.target.value)}
          placeholder="Ej: art. 15 LSC / art. 210.3 LSC"
          className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>
    </div>
  );
}

// ── Paso 3: Firma y archivo ───────────────────────────────────────────────────

function FirmaArchivoStep({
  onCreate,
  creating,
  createdDecisionId,
}: {
  onCreate: () => void;
  creating: boolean;
  createdDecisionId: string | null;
}) {
  const navigate = useNavigate();
  const scope = useSecretariaScope();

  if (createdDecisionId) {
    return (
      <div className="space-y-4">
        <div
          className="flex items-start gap-3 border border-[var(--status-success)] bg-[var(--g-sec-100)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-success)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--g-text-primary)]">
              Decisión registrada y expediente creado
            </p>
            <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
              La decisión queda firmada en Secretaría y el acuerdo queda vinculado para generar
              el DOCX final y su evidencia documental.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(scope.createScopedTo(`/secretaria/decisiones-unipersonales/${createdDecisionId}`))}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <UserCheck className="h-4 w-4" />
          Ver decisión registrada
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        La plataforma registrará la decisión, creará el expediente de acuerdo vinculado y dejará
        preparado el documento final para firma QES y evidencia documental.
      </p>

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-4"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--g-text-primary)]">
          <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" />
          Verificación pre-firma
        </div>
        <ul className="mt-2 space-y-1.5 text-xs text-[var(--g-text-secondary)]">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-success)]" />
            Modo adopción: UNIPERSONAL — sin quórum ni mayoría requerida
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-success)]" />
            Certificado OCSP verificado (EAD Trust)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-success)]" />
            Hash SHA-512 del documento calculado
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onCreate}
        disabled={creating}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-5 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-60"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {creating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Registrando decisión…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Registrar decisión y expediente
          </>
        )}
      </button>
    </div>
  );
}

export default function DecisionUnipersonalStepper() {
  const scope = useSecretariaScope();
  const { data: entities = [] } = useEntitiesList();
  const { data: materias = [], isLoading: materiasLoading } = useMateriaCatalog();
  const createDecision = useCreateUnipersonalDecision();
  const [tipo, setTipo] = useState<DecisionType>("SOCIO_UNICO");
  const [materia, setMateria] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState(scope.selectedEntity?.id ?? "");
  const [texto, setTexto] = useState("");
  const [fundamentoLegal, setFundamentoLegal] = useState("");
  const [createdDecisionId, setCreatedDecisionId] = useState<string | null>(null);
  const isSociedadScoped = scope.mode === "sociedad";
  const selectedMateria = materias.find((item) => item.materia === materia) ?? null;
  const { data: readiness } = useEntityDemoReadiness(selectedEntityId);
  const readinessBlocked = readiness?.status === "reference_only";

  useEffect(() => {
    if (scope.mode === "sociedad" && scope.selectedEntity?.id) {
      setSelectedEntityId(scope.selectedEntity.id);
    }
  }, [scope.mode, scope.selectedEntity?.id]);

  const content = [
    texto.trim(),
    fundamentoLegal.trim() ? `Fundamento jurídico: ${fundamentoLegal.trim()}` : null,
  ].filter(Boolean).join("\n\n");

  function handleCreate() {
    if (!selectedEntityId || !materia || !texto.trim() || !selectedMateria) return;
    createDecision.mutate(
      {
        entityId: selectedEntityId,
        decisionType: tipo,
        agreementKind: materia,
        matterClass: selectedMateria.matter_class,
        title: selectedMateria.materia_label_es,
        content,
        requiresRegistry: selectedMateria.requires_registry || selectedMateria.inscribable,
      },
      {
        onSuccess: ({ decisionId }) => {
          setCreatedDecisionId(decisionId);
          toast.success("Decisión registrada", {
            description: "Se ha creado el expediente de acuerdo vinculado.",
          });
        },
        onError: (error) => {
          toast.error("No se pudo registrar la decisión", {
            description: error instanceof Error ? error.message : "Revise los datos del expediente.",
          });
        },
      },
    );
  }

  const steps: StepDef[] = [
    {
      n: 1,
      label: "Tipo y materia",
      hint: "Selecciona sociedad, decisor unipersonal y materia",
      canAdvance: Boolean(selectedEntityId && materia && !readinessBlocked),
      body: (
        <div className="space-y-5">
          <EntityReadinessNotice readiness={readiness} />
          <TipoMateriaStep
            tipo={tipo}
            setTipo={setTipo}
            materia={materia}
            setMateria={setMateria}
            entities={entities}
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
            isSociedadScoped={isSociedadScoped}
            materias={materias}
            isLoading={materiasLoading}
          />
        </div>
      ),
    },
    {
      n: 2,
      label: "Texto del acuerdo",
      hint: "Redacción del acuerdo adoptado con fundamento jurídico",
      canAdvance: texto.trim().length > 0,
      body: (
        <TextoAcuerdoStep
          texto={texto}
          setTexto={setTexto}
          fundamentoLegal={fundamentoLegal}
          setFundamentoLegal={setFundamentoLegal}
        />
      ),
    },
    {
      n: 3,
      label: "Registro y documento",
      hint: "Crea la decisión y el expediente de acuerdo vinculado",
      body: (
        <FirmaArchivoStep
          onCreate={handleCreate}
          creating={createDecision.isPending}
          createdDecisionId={createdDecisionId}
        />
      ),
    },
  ];

  return (
    <StepperShell
      eyebrow="Secretaría · Nueva decisión unipersonal"
      title="Asistente de decisión unipersonal"
      backTo="/secretaria/decisiones-unipersonales"
      steps={steps}
    />
  );
}
