import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StepRail } from "./_shared/StepNav";
import { useTenantContext } from "@/context/TenantContext";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useEntitiesList } from "@/hooks/useEntities";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { useAdministradores } from "@/hooks/useCargos";
import { usePlantillaProtegida } from "@/hooks/usePlantillasProtegidas";
import { useEntityDemoReadiness } from "@/hooks/useEntityDemoReadiness";
import { EntityReadinessNotice } from "@/components/secretaria/EntityReadinessNotice";
import { BookDestinationNotice } from "@/components/secretaria/BookDestinationNotice";
import { evaluarSolidario } from "@/lib/rules-engine/votacion-engine";
import { usePactosVigentes } from "@/hooks/usePactosParasociales";
import { PactosCompliancePanel } from "@/components/secretaria/PactosCompliancePanel";
import type { SolidarioConfig } from "@/lib/rules-engine/types";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { bodyOptionLabel } from "@/lib/secretaria/body-labels";
import { adoptionModeBusinessLabel } from "@/lib/secretaria/mesa-control-societaria";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Tipo de acuerdo", hint: "Materia, clase y texto de la propuesta" },
  { n: 2, label: "Administrador actuante", hint: "Identificar el administrador solidario que adopta el acuerdo" },
  { n: 3, label: "Evaluación motor", hint: "Verificación de validez por el motor LSC" },
  { n: 4, label: "Registrar", hint: "Crear acuerdo de administrador solidario" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

/** Administrador vigente del censo (proyección mínima de CargoDetailRow). */
interface AdminOption {
  person_id: string;
  full_name: string | null;
  role: string | null;
}

// ─── Step bodies ─────────────────────────────────────────────────────────────

function StepTipoAcuerdo({
  selectedEntityId, setSelectedEntityId,
  selectedBodyId, setSelectedBodyId,
  entities,
  bodies,
  isSociedadScoped,
  requestedPlantillaId,
  requestedPlantillaLabel,
  materia, setMateria,
  texto, setTexto,
}: {
  selectedEntityId: string | null; setSelectedEntityId: (v: string | null) => void;
  selectedBodyId: string | null; setSelectedBodyId: (v: string | null) => void;
  entities: Array<{ id: string; legal_name: string; jurisdiction?: string | null }>;
  bodies: Array<{ id: string; name: string; body_type: string }>;
  isSociedadScoped: boolean;
  requestedPlantillaId: string | null;
  requestedPlantillaLabel: string | null;
  materia: string; setMateria: (v: string) => void;
  texto: string; setTexto: (v: string) => void;
}) {
  const selectedBody = bodies.find((body) => body.id === selectedBodyId) ?? null;

  return (
    <div className="space-y-4">
      {requestedPlantillaId ? (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <span className="font-medium text-[var(--g-text-primary)]">Plantilla seleccionada:</span>{" "}
          {requestedPlantillaLabel ?? "se aplicará al acta del órgano de administración cuando se genere el documento."}
        </div>
      ) : null}

      <div>
        <label htmlFor="solidario-entidad" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Sociedad
        </label>
        <select
          id="solidario-entidad"
          value={selectedEntityId ?? ""}
          disabled={isSociedadScoped}
          onChange={(e) => {
            setSelectedEntityId(e.target.value || null);
            setSelectedBodyId(null);
          }}
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="">Seleccionar sociedad...</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.legal_name} {entity.jurisdiction ? `(${entity.jurisdiction})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="solidario-organo" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Órgano
        </label>
        <select
          id="solidario-organo"
          value={selectedBodyId ?? ""}
          disabled={!selectedEntityId}
          onChange={(e) => setSelectedBodyId(e.target.value || null)}
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="">Seleccionar órgano...</option>
          {bodies.map((body) => (
            <option key={body.id} value={body.id}>
              {bodyOptionLabel(body)}
            </option>
          ))}
        </select>
      </div>

      {selectedBody ? (
        <BookDestinationNotice
          body={selectedBody}
          adoptionLabel="acta de administrador solidario"
        />
      ) : null}

      <div>
        <label htmlFor="solidario-materia" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Clase de materia
        </label>
        <select
          id="solidario-materia"
          value={materia}
          onChange={(e) => setMateria(e.target.value)}
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="">Seleccionar…</option>
          <option value="APROBACION_CUENTAS">Aprobación de cuentas</option>
          <option value="NOMBRAMIENTO_CESE">Nombramiento / cese</option>
          <option value="MOD_ESTATUTOS">Modificación de estatutos</option>
          <option value="OPERACION_ESTRUCTURAL">Operación estructural</option>
          <option value="DELEGACION_FACULTADES">Delegación de facultades</option>
          <option value="OTROS">Otros</option>
        </select>
      </div>
      <div>
        <label htmlFor="solidario-texto" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Texto de la propuesta
        </label>
        <textarea
          id="solidario-texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          placeholder="Redactar el texto del acuerdo que adoptará el administrador solidario actuante…"
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)] resize-none"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>
    </div>
  );
}

function StepAdminActuante({
  activeAdmins,
  adminId, setActuante,
  vigenciaDesde, setVigenciaDesde,
  materiasRestringidas, setMateriasRestringidas,
}: {
  activeAdmins: AdminOption[];
  adminId: string; setActuante: (id: string, nombre: string) => void;
  vigenciaDesde: string; setVigenciaDesde: (v: string) => void;
  materiasRestringidas: string[]; setMateriasRestringidas: (v: string[]) => void;
}) {
  const [newMateria, setNewMateria] = useState("");

  function addMateria() {
    if (!newMateria.trim()) return;
    setMateriasRestringidas([...materiasRestringidas, newMateria.trim()]);
    setNewMateria("");
  }

  return (
    <div className="space-y-4">
      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-sec-100)] p-4 text-sm text-[var(--g-text-secondary)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        El administrador solidario puede actuar individualmente para adoptar acuerdos de gestión
        ordinaria; cada administrador ostenta el poder de representación (art. 233.2.b LSC).
        Materias estructurales pueden requerir cofirma estatutaria.
      </div>

      <div>
        <label htmlFor="solidario-admin-id" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Administrador actuante
        </label>
        {/* ITEM-050: el actuante se elige del censo real del órgano
            (condiciones_persona VIGENTE), no por texto libre. Antes el id era
            arbitrario y la lista de "vigentes" era [adminId] → autovalidación. */}
        <select
          id="solidario-admin-id"
          value={adminId}
          disabled={activeAdmins.length === 0}
          onChange={(e) => {
            const picked = activeAdmins.find((a) => a.person_id === e.target.value);
            setActuante(e.target.value, picked?.full_name ?? "");
          }}
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="">Seleccionar administrador vigente…</option>
          {activeAdmins.map((a) => (
            <option key={a.person_id} value={a.person_id}>
              {a.full_name ?? a.person_id}{a.role ? ` · ${a.role}` : ""}
            </option>
          ))}
        </select>
        {activeAdmins.length === 0 && (
          <div
            className="mt-2 flex items-start gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] p-3 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
            <span>
              No hay administradores vigentes en el censo de este órgano. No puede registrarse un
              acuerdo solidario sin un administrador real.
            </span>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="solidario-vigencia-desde" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Vigencia del cargo desde
        </label>
        <input
          id="solidario-vigencia-desde"
          type="date"
          value={vigenciaDesde}
          onChange={(e) => setVigenciaDesde(e.target.value)}
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>

      <div>
        <label htmlFor="solidario-materia-restringida" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Materias con restricción estatutaria (requieren cofirma)
        </label>
        <div className="flex gap-2 mb-2">
          <input
            id="solidario-materia-restringida"
            type="text"
            value={newMateria}
            onChange={(e) => setNewMateria(e.target.value)}
            placeholder="Ej: OPERACION_ESTRUCTURAL"
            className="flex-1 border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
          <button
            type="button"
            onClick={addMateria}
            disabled={!newMateria.trim()}
            className="border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Añadir
          </button>
        </div>
        {materiasRestringidas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {materiasRestringidas.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-0.5 text-xs text-[var(--g-text-secondary)]"
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {m}
                <button
                  type="button"
                  aria-label={`Eliminar restricción ${m}`}
                  onClick={() => setMateriasRestringidas(materiasRestringidas.filter((_, j) => j !== i))}
                  className="ml-0.5 text-[var(--status-error)]"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {materiasRestringidas.length === 0 && (
          <p className="text-xs text-[var(--g-text-secondary)]">Sin restricciones estatutarias</p>
        )}
      </div>
    </div>
  );
}

function StepEvaluacion({ result }: { result: ReturnType<typeof evaluarSolidario> | null }) {
  if (!result) {
    return (
      <div className="py-8 text-center text-sm text-[var(--g-text-secondary)]">
        Completa los pasos anteriores para ver la evaluación del motor.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={`flex items-center gap-3 p-4 ${result.ok ? "bg-[var(--g-sec-100)]" : "bg-[var(--g-surface-muted)]"}`}
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {result.ok ? (
          <CheckCircle2 className="h-5 w-5 text-[var(--status-success)]" />
        ) : (
          <XCircle className="h-5 w-5 text-[var(--status-error)]" />
        )}
        <div>
          <div className="text-sm font-semibold text-[var(--g-text-primary)]">
            {result.ok ? "Acuerdo solidario válido" : "Acuerdo solidario inválido"}
          </div>
          <div className="text-xs text-[var(--g-text-secondary)]">Severity: {result.severity}</div>
        </div>
      </div>

      {result.blocking_issues.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--status-error)]">
            Problemas bloqueantes
          </div>
          {result.blocking_issues.map((b, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-[var(--g-text-primary)]">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" />
              {b}
            </div>
          ))}
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--status-warning)]">
            Advertencias
          </div>
          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-[var(--g-text-primary)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">
          Árbol de evaluación
        </div>
        <div
          className="border border-[var(--g-border-subtle)] p-3 text-xs text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex items-center gap-2">
            {result.explain.resultado === 'OK' ? (
              <Check className="h-3.5 w-3.5 text-[var(--status-success)]" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-[var(--status-error)]" />
            )}
            <span className="font-medium">{result.explain.regla}</span>
            <span className="ml-auto">{result.explain.resultado}</span>
          </div>
          <p className="mt-1 pl-5">{result.explain.mensaje}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SolidarioStepper() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { tenantId } = useTenantContext();
  const scope = useSecretariaScope();
  const scopedEntityId = scope.mode === "sociedad" ? scope.selectedEntity?.id ?? null : null;
  const requestedPlantillaId = searchParams.get("plantilla");
  const { data: requestedPlantilla } = usePlantillaProtegida(requestedPlantillaId ?? undefined);
  const { data: entities = [] } = useEntitiesList({ sociedadesOnly: true });
  const isSociedadScoped = Boolean(scopedEntityId);
  const [current, setCurrent] = useState(1);

  // Step 1
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(scopedEntityId);
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [materia, setMateria] = useState("");
  const [texto, setTexto] = useState("");
  const { data: bodies = [] } = useBodiesByEntity(selectedEntityId ?? undefined);
  const { data: readiness } = useEntityDemoReadiness(selectedEntityId);
  const readinessBlocked = readiness?.status === "reference_only";

  // ITEM-050: censo real de administradores NO COLEGIADOS de la sociedad. El
  // administrador solidario es un régimen no colegiado (art. 210.1 LSC: "de
  // forma solidaria"); un consejero no es administrador solidario. Por eso se
  // usa useAdministradores (ADMIN_UNICO/SOLIDARIO/MANCOMUNADO/PJ, body_id NULL)
  // y NO los consejeros. El motor valida que el actuante conste como VIGENTE;
  // antes adminVigentes era [adminId] (el propio actuante), una autovalidación
  // tautológica.
  const { data: cargos = [] } = useAdministradores(selectedEntityId ?? undefined);
  const activeAdmins = useMemo<AdminOption[]>(() => {
    const byPersonId = new Map<string, AdminOption>();
    for (const c of cargos) {
      if (!byPersonId.has(c.person_id)) {
        byPersonId.set(c.person_id, {
          person_id: c.person_id,
          full_name: c.person?.full_name ?? null,
          role: c.tipo_condicion ?? null,
        });
      }
    }
    return Array.from(byPersonId.values());
  }, [cargos]);
  const adminVigentes = useMemo(() => activeAdmins.map((a) => a.person_id), [activeAdmins]);

  // ITEM-113: pactos parasociales vigentes de la sociedad. El administrador
  // solidario es un flujo sin sesión que antes no evaluaba pactos; ahora un
  // veto de operación estructural (Fundación ARGA) dispara su advertencia
  // contractual también aquí.
  const { data: pactosVigentes = [] } = usePactosVigentes(selectedEntityId ?? undefined);

  useEffect(() => {
    if (!scopedEntityId) return;
    setSelectedEntityId(scopedEntityId);
    setSelectedBodyId(null);
  }, [scopedEntityId]);

  // Step 2
  const [adminId, setAdminId] = useState("");
  const [adminNombre, setAdminNombre] = useState("");
  const [vigenciaDesde, setVigenciaDesde] = useState(
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [materiasRestringidas, setMateriasRestringidas] = useState<string[]>([]);

  function setActuante(id: string, nombre: string) {
    setAdminId(id);
    setAdminNombre(nombre);
  }

  // Reset del actuante al cambiar de sociedad (el person_id pertenece al censo
  // de la sociedad anterior).
  useEffect(() => {
    setAdminId("");
    setAdminNombre("");
  }, [selectedEntityId]);

  // Step 3 — computed result
  const motorResult: ReturnType<typeof evaluarSolidario> | null =
    adminId.trim()
      ? evaluarSolidario(
          {
            adminActuante: adminId,
            restriccionesEstatutarias: materiasRestringidas.map((m) => ({
              materia: m,
              requiereCofirma: true,
            })),
            vigenciaDesde: `${vigenciaDesde}T00:00:00Z`,
          } satisfies SolidarioConfig,
          adminVigentes,
          materia || "OTROS",
          new Date().toISOString()
        )
      : null;

  // Step 4
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleRegistrar() {
    if (!tenantId || !motorResult || !selectedEntityId || !selectedBodyId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data, error } = await supabase
        .from("agreements")
        .insert({
          tenant_id: tenantId,
          entity_id: selectedEntityId,
          body_id: selectedBodyId,
          agreement_kind: materia || "OTROS",
          matter_class: materia === "OPERACION_ESTRUCTURAL" || materia === "MOD_ESTATUTOS" ? "ESTRUCTURAL" : "ORDINARIA",
          adoption_mode: "SOLIDARIO",
          proposal_text: texto,
          decision_text: texto,
          status: motorResult.ok ? "ADOPTED" : "DRAFT",
          decision_date: new Date().toISOString().split("T")[0],
          execution_mode: {
            tipo: "SOLIDARIO",
            selected_template_id: requestedPlantillaId,
            config: {
              adminActuante: adminId,
              restriccionesEstatutarias: materiasRestringidas.map((m) => ({
                materia: m,
                requiereCofirma: true,
              })),
              vigenciaDesde: `${vigenciaDesde}T00:00:00Z`,
            },
            agreement_360: {
              version: "agreement-360.v1",
              origin: "SOLIDARIO",
              selected_template_id: requestedPlantillaId,
              materialized_at: new Date().toISOString(),
              materialized: true,
            },
          },
          compliance_snapshot: motorResult,
        })
        .select("id")
        .single();

      if (error) throw error;
      setSavedId(data.id);
      qc.invalidateQueries({ queryKey: ["agreements"] });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function canAdvance() {
    switch (current) {
      case 1:
        return !!selectedEntityId && !!selectedBodyId && !!materia && texto.trim().length > 0 && !readinessBlocked;
      case 2:
        // ITEM-050: el actuante debe ser un administrador real del censo
        // (adminId = person_id); el nombre se deriva de la selección.
        return adminId.trim().length > 0 && Boolean(vigenciaDesde);
      case 3:
        return !!motorResult;
      default:
        return false;
    }
  }

  function renderStepBody() {
    switch (current) {
      case 1:
        return (
          <div className="space-y-4">
            <EntityReadinessNotice readiness={readiness} />
            <StepTipoAcuerdo
              selectedEntityId={selectedEntityId}
              setSelectedEntityId={setSelectedEntityId}
              selectedBodyId={selectedBodyId}
              setSelectedBodyId={setSelectedBodyId}
              entities={entities}
              bodies={bodies}
              isSociedadScoped={isSociedadScoped}
              requestedPlantillaId={requestedPlantillaId}
              requestedPlantillaLabel={requestedPlantilla ? `${requestedPlantilla.tipo} v${requestedPlantilla.version}` : null}
              materia={materia} setMateria={setMateria}
              texto={texto} setTexto={setTexto}
            />
          </div>
        );
      case 2:
        return (
          <StepAdminActuante
            activeAdmins={activeAdmins}
            adminId={adminId} setActuante={setActuante}
            vigenciaDesde={vigenciaDesde} setVigenciaDesde={setVigenciaDesde}
            materiasRestringidas={materiasRestringidas}
            setMateriasRestringidas={setMateriasRestringidas}
          />
        );
      case 3:
        return (
          <div className="space-y-4">
            <StepEvaluacion result={motorResult} />
            <PactosCompliancePanel pactos={pactosVigentes} materia={materia || "OTROS"} />
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            {savedId ? (
              <div className="flex items-center gap-3 rounded-lg bg-[var(--g-sec-100)] p-4">
                <CheckCircle2 className="h-5 w-5 text-[var(--status-success)]" />
                <div>
                  <div className="text-sm font-semibold text-[var(--g-text-primary)]">
                    Acuerdo registrado
                  </div>
                  <div className="text-xs text-[var(--g-text-secondary)]">ID: {savedId}</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(scope.createScopedTo(`/secretaria/acuerdos/${savedId}`))}
                  className="ml-auto text-sm text-[var(--g-brand-3308)] hover:underline"
                >
                  Ver expediente →
                </button>
                <button
                  type="button"
                  onClick={() => navigate(scope.createScopedTo(`/secretaria/acuerdos/${savedId}/generar${requestedPlantillaId ? `?plantilla=${requestedPlantillaId}` : ""}`))}
                  className="text-sm text-[var(--g-brand-3308)] hover:underline"
                >
                  Generar documento →
                </button>
              </div>
            ) : (
              <>
                <div className="text-sm text-[var(--g-text-secondary)]">
                  Se creará un acuerdo con forma de adopción{" "}
                  <strong>{adoptionModeBusinessLabel("SOLIDARIO")}</strong> adoptado por{" "}
                  <strong>{adminNombre || adminId || "—"}</strong>. Estado:{" "}
                  <strong>{statusLabel(motorResult?.ok ? "ADOPTED" : "DRAFT")}</strong>.
                </div>
                {saveError && (
                  <div className="text-sm text-[var(--status-error)]">{saveError}</div>
                )}
                <button
                  type="button"
                  onClick={handleRegistrar}
                  disabled={saving || !motorResult || !selectedEntityId || !selectedBodyId}
                  className="bg-[var(--g-brand-3308)] px-6 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {saving ? "Guardando…" : "Registrar acuerdo"}
                </button>
              </>
            )}
          </div>
        );
    }
  }

  const currentStep = STEPS.find((s) => s.n === current) ?? STEPS[0];

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate(scope.createScopedTo("/secretaria/acuerdos-sin-sesion"))}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Cancelar y volver
      </button>

      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          Secretaría · Decisión solidaria
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Asistente de acuerdo por administrador solidario
        </h1>
        {scope.mode === "sociedad" && scope.selectedEntity ? (
          <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
            Modo sociedad: el acuerdo se vinculará a{" "}
            <span className="font-semibold text-[var(--g-text-primary)]">{scope.selectedEntity.legalName}</span>.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* ITEM-125: rail compartido. */}
        <StepRail
          steps={STEPS}
          current={current}
          canNavigateTo={(n) => n < current}
          onNavigate={setCurrent}
        />

        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
            Paso {currentStep.n}. {currentStep.label}
          </h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{currentStep.hint}</p>

          <div className="mt-6">{renderStepBody()}</div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrent((n) => Math.max(1, n - 1))}
              disabled={current === 1}
              className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => canAdvance() && setCurrent((n) => Math.min(STEPS.length, n + 1))}
              disabled={current === STEPS.length || !canAdvance()}
              className="inline-flex items-center gap-1 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-40"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
