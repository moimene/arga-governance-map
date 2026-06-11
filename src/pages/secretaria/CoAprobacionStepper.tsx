import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useEntitiesList } from "@/hooks/useEntities";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { useAdministradores } from "@/hooks/useCargos";
import { usePlantillaProtegida } from "@/hooks/usePlantillasProtegidas";
import { useEntityDemoReadiness } from "@/hooks/useEntityDemoReadiness";
import { EntityReadinessNotice } from "@/components/secretaria/EntityReadinessNotice";
import { BookDestinationNotice } from "@/components/secretaria/BookDestinationNotice";
import { evaluarCoAprobacion } from "@/lib/rules-engine/votacion-engine";
import type { CoAprobacionConfig, TipoSocial } from "@/lib/rules-engine/types";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { bodyOptionLabel } from "@/lib/secretaria/body-labels";
import { deriveTipoSocial } from "@/lib/secretaria/tipo-social";
import { adoptionModeBusinessLabel } from "@/lib/secretaria/mesa-control-societaria";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Tipo de acuerdo", hint: "Materia, clase y texto de la propuesta" },
  { n: 2, label: "Configuración k de n", hint: "Número mínimo de administradores y ventana temporal" },
  { n: 3, label: "Firmas", hint: "Registro de firmas de los administradores que aprueban" },
  { n: 4, label: "Evaluación motor", hint: "Verificación de validez por el motor LSC" },
  { n: 5, label: "Registrar", hint: "Crear acuerdo y emitir certificación" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface FirmaLocal {
  adminId: string;
  adminNombre: string;
  fechaFirma: string;
}

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
          {requestedPlantillaLabel ?? "se aplicará al acta de decisión conjunta cuando se genere el documento."}
        </div>
      ) : null}

      <div>
        <label htmlFor="coaprobacion-entidad" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Sociedad
        </label>
        <select
          id="coaprobacion-entidad"
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
        <label htmlFor="coaprobacion-organo" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Órgano
        </label>
        <select
          id="coaprobacion-organo"
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
          adoptionLabel="acta de decision conjunta"
        />
      ) : null}

      <div>
        <label htmlFor="coaprobacion-materia" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Clase de materia
        </label>
        <select
          id="coaprobacion-materia"
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
        <label htmlFor="coaprobacion-texto" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Texto de la propuesta
        </label>
        <textarea
          id="coaprobacion-texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          placeholder="Redactar el texto del acuerdo que se adoptará por co-aprobación…"
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)] resize-none"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>
    </div>
  );
}

function StepConfiguracion({
  k, setK,
  n,
  tipoSocial,
  ventana, setVentana,
  estatutos, setEstatutos,
}: {
  k: number; setK: (v: number) => void;
  n: number;
  tipoSocial: TipoSocial;
  ventana: string; setVentana: (v: string) => void;
  estatutos: boolean; setEstatutos: (v: boolean) => void;
}) {
  const esSA = tipoSocial === "SA" || tipoSocial === "SAU";
  // ITEM-050: el total de administradores (n) se deriva del censo real del
  // órgano (no es un número libre). La cota mínima de mancomunados es 2
  // (art. 233.2.c LSC); en la SA la administración conjunta solo cabe con dos
  // administradores (art. 210.2 LSC).
  const insufficient = n < 2;
  return (
    <div className="space-y-4">
      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-sec-100)] p-4 text-sm text-[var(--g-text-secondary)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        La co-aprobación requiere que al menos <strong>k</strong> administradores de los <strong>n</strong> mancomunados
        vigentes aprueben el acuerdo dentro de la ventana temporal. La actuación mancomunada exige
        al menos dos administradores (art. 233.2.c LSC){esSA ? "; en la SA la administración conjunta solo cabe con dos (más de dos exige consejo, art. 210.2 LSC)" : ""}.
      </div>
      {insufficient && (
        <div
          className="flex items-start gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] p-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <span>
            El órgano seleccionado tiene {n} administrador{n === 1 ? "" : "es"} vigente{n === 1 ? "" : "s"} en el censo.
            La co-aprobación mancomunada requiere al menos dos (art. 233.2.c LSC).
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="coaprobacion-k" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
            Mínimo de firmas requeridas (k)
          </label>
          <input
            id="coaprobacion-k"
            type="number"
            min={2}
            max={Math.max(2, n)}
            value={k}
            onChange={(e) => setK(Math.max(2, Math.min(Math.max(2, n), parseInt(e.target.value) || 2)))}
            className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
        </div>
        <div>
          <label htmlFor="coaprobacion-n" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
            Administradores vigentes (n)
          </label>
          <input
            id="coaprobacion-n"
            type="number"
            value={n}
            readOnly
            aria-readonly="true"
            className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)] focus:outline-none"
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Derivado del censo del órgano</p>
        </div>
      </div>
      <div>
        <label htmlFor="coaprobacion-ventana" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Ventana de consenso
        </label>
        <select
          id="coaprobacion-ventana"
          value={ventana}
          onChange={(e) => setVentana(e.target.value)}
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="7d">7 días</option>
          <option value="15d">15 días</option>
          <option value="30d">30 días</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="estatutos"
          type="checkbox"
          checked={estatutos}
          onChange={(e) => setEstatutos(e.target.checked)}
          className="h-4 w-4 accent-[var(--g-brand-3308)]"
        />
        <label htmlFor="estatutos" className="text-sm text-[var(--g-text-primary)]">
          Los estatutos permiten adopción sin sesión (arts. 210 y 233.2.c LSC)
        </label>
      </div>
    </div>
  );
}

function StepFirmas({
  activeAdmins, firmas, setFirmas,
}: {
  activeAdmins: AdminOption[];
  firmas: FirmaLocal[];
  setFirmas: (v: FirmaLocal[]) => void;
}) {
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const selectedIds = new Set(firmas.map((f) => f.adminId));

  // ITEM-050: las firmas solo pueden provenir de administradores que constan
  // en el censo de la sociedad (condiciones_persona VIGENTE). Antes el alta era
  // de texto libre con ids sintéticos (`admin-${Date.now()}`) y la lista de
  // "vigentes" era la propia lista de firmantes → validación circular.
  function toggle(admin: AdminOption) {
    if (selectedIds.has(admin.person_id)) {
      setFirmas(firmas.filter((f) => f.adminId !== admin.person_id));
    } else {
      setFirmas([
        ...firmas,
        {
          adminId: admin.person_id,
          adminNombre: admin.full_name ?? admin.person_id,
          fechaFirma: `${fecha}T12:00:00Z`,
        },
      ]);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Selecciona los administradores mancomunados vigentes del órgano que suscriben el acuerdo.
        Solo pueden firmar quienes constan en el censo (arts. 210.2 y 233.2.c LSC).
      </p>

      <div>
        <label htmlFor="coaprobacion-fecha-firma" className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Fecha de suscripción
        </label>
        <input
          id="coaprobacion-fecha-firma"
          aria-label="Fecha de firma del administrador"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>

      {activeAdmins.length === 0 ? (
        <div
          className="flex items-start gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] p-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <span>
            No hay administradores vigentes en el censo de este órgano. No puede registrarse una
            co-aprobación sin administradores reales.
          </span>
        </div>
      ) : (
        <div
          className="divide-y divide-[var(--g-border-subtle)] border border-[var(--g-border-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {activeAdmins.map((admin) => {
            const checked = selectedIds.has(admin.person_id);
            return (
              <label
                key={admin.person_id}
                htmlFor={`coaprobacion-firma-${admin.person_id}`}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[var(--g-surface-subtle)]/50"
              >
                <input
                  id={`coaprobacion-firma-${admin.person_id}`}
                  type="checkbox"
                  aria-label={admin.full_name ?? admin.person_id}
                  checked={checked}
                  onChange={() => toggle(admin)}
                  className="h-4 w-4 accent-[var(--g-brand-3308)]"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--g-text-primary)]">
                    {admin.full_name ?? admin.person_id}
                  </div>
                  {admin.role ? (
                    <div className="text-xs text-[var(--g-text-secondary)]">{admin.role}</div>
                  ) : null}
                </div>
                {checked ? <Check className="h-4 w-4 text-[var(--status-success)]" /> : null}
              </label>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[var(--g-text-secondary)]">
        {firmas.length} de {activeAdmins.length} administradores seleccionados.
      </p>
    </div>
  );
}

function StepEvaluacion({ result }: { result: ReturnType<typeof evaluarCoAprobacion> | null }) {
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
            {result.ok ? "Co-aprobación válida" : "Co-aprobación inválida"}
          </div>
          <div className="text-xs text-[var(--g-text-secondary)]">
            Severity: {result.severity}
          </div>
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
        <div className="border border-[var(--g-border-subtle)] p-3 text-xs text-[var(--g-text-secondary)]" style={{ borderRadius: "var(--g-radius-md)" }}>
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

export default function CoAprobacionStepper() {
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

  // Step 1 state
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(scopedEntityId);
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [materia, setMateria] = useState("");
  const [texto, setTexto] = useState("");
  const { data: bodies = [] } = useBodiesByEntity(selectedEntityId ?? undefined);
  const { data: readiness } = useEntityDemoReadiness(selectedEntityId);
  const readinessBlocked = readiness?.status === "reference_only";

  // ITEM-050: tipo social real + censo real de administradores NO COLEGIADOS de
  // la sociedad. La co-aprobación mancomunada es un régimen no colegiado por
  // definición (art. 210.1 LSC: "de forma conjunta"); un consejo adopta
  // colegiadamente, no por co-aprobación. Por eso se usa useAdministradores
  // (ADMIN_UNICO/SOLIDARIO/MANCOMUNADO/PJ, body_id NULL) y NO los consejeros.
  // El motor necesita el tipo social para las reglas de mancomunidad (arts.
  // 210.2/233.2.c LSC) y la lista de VIGENTES para que la validación de firmas
  // no sea circular.
  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null;
  const tipoSocial = deriveTipoSocial(selectedEntity);
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
  const n = activeAdmins.length;
  const adminVigentes = useMemo(() => activeAdmins.map((a) => a.person_id), [activeAdmins]);

  useEffect(() => {
    if (!scopedEntityId) return;
    setSelectedEntityId(scopedEntityId);
    setSelectedBodyId(null);
  }, [scopedEntityId]);

  // Step 2 state
  const [k, setK] = useState(2);
  const [ventana, setVentana] = useState("15d");
  const [estatutos, setEstatutos] = useState(true);

  // Step 3 state
  const [firmas, setFirmas] = useState<FirmaLocal[]>([]);

  // Reset de firmas al cambiar de sociedad: las firmas referencian person_ids
  // del censo de la sociedad anterior, que dejan de ser válidas.
  useEffect(() => {
    setFirmas([]);
  }, [selectedEntityId]);

  // Step 4 — computed result
  const motorResult: ReturnType<typeof evaluarCoAprobacion> | null =
    firmas.length > 0
      ? evaluarCoAprobacion(
          {
            k,
            n,
            tipoSocial,
            ventanaConsenso: ventana,
            estatutosPermitenSinSesion: estatutos,
            firmas: firmas.map((f) => ({
              adminId: f.adminId,
              fechaFirma: f.fechaFirma,
              hashDocumento: `sha256-${f.adminId}`,
            })),
          } satisfies CoAprobacionConfig,
          adminVigentes,
          new Date().toISOString()
        )
      : null;

  // Step 5 state
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
          adoption_mode: "CO_APROBACION",
          proposal_text: texto,
          decision_text: texto,
          status: motorResult.ok ? "ADOPTED" : "DRAFT",
          decision_date: new Date().toISOString().split("T")[0],
          execution_mode: {
            tipo: "CO_APROBACION",
            selected_template_id: requestedPlantillaId,
            config: {
              k, n,
              tipoSocial,
              ventanaConsenso: ventana,
              estatutosPermitenSinSesion: estatutos,
              firmas: firmas.map((f) => ({
                adminId: f.adminId,
                fechaFirma: f.fechaFirma,
                hashDocumento: `sha256-${f.adminId}`,
              })),
            },
            agreement_360: {
              version: "agreement-360.v1",
              origin: "CO_APROBACION",
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
        // ITEM-050: la co-aprobación mancomunada exige al menos 2 administradores
        // reales (n del censo) y k entre 2 y n.
        return k >= 2 && n >= 2 && n >= k && Boolean(ventana);
      case 3:
        return firmas.length > 0;
      case 4:
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
          <StepConfiguracion
            k={k} setK={setK}
            n={n}
            tipoSocial={tipoSocial}
            ventana={ventana} setVentana={setVentana}
            estatutos={estatutos} setEstatutos={setEstatutos}
          />
        );
      case 3:
        return <StepFirmas activeAdmins={activeAdmins} firmas={firmas} setFirmas={setFirmas} />;
      case 4:
        return <StepEvaluacion result={motorResult} />;
      case 5:
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
                  <strong>{adoptionModeBusinessLabel("CO_APROBACION")}</strong> y
                  el snapshot del motor. Estado:{" "}
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
          Secretaría · Co-aprobación
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Asistente de acuerdo por co-aprobación (k de n)
        </h1>
        {scope.mode === "sociedad" && scope.selectedEntity ? (
          <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
            Modo sociedad: el acuerdo se vinculará a{" "}
            <span className="font-semibold text-[var(--g-text-primary)]">{scope.selectedEntity.legalName}</span>.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <nav
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          aria-label="Pasos"
        >
          {STEPS.map((s) => {
            const done = s.n < current;
            const active = s.n === current;
            const locked = s.n > current;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => done && setCurrent(s.n)}
                disabled={locked}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[var(--g-surface-subtle)] font-semibold text-[var(--g-brand-3308)]"
                    : done
                      ? "text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]/50"
                      : "text-[var(--g-text-secondary)] opacity-40"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold ${
                    done
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : active
                      ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                <span className="flex-1 truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>

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
