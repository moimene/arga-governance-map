import { useEffect, useState } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { Gavel, Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSociedad, useSociedades } from "@/hooks/useSociedades";
import { usePersonasCanonical, usePersonaCanonical } from "@/hooks/usePersonasCanonical";
import { isOperationalSecretariaBody } from "@/lib/secretaria/operational-bodies";
import {
  CARGO_LABELS,
  type TipoCondicion,
  type FuenteDesignacion,
} from "@/hooks/useCargos";
import { useTenantContext } from "@/context/TenantContext";
import { useAsignarCargo } from "@/hooks/useCondicionesPersonaMutations";
import { useUpsertRepresentanteAdminPJ } from "@/hooks/useRepresentantesAdminPJ";
import {
  requiresBodyId,
  requiresRepresentative,
  isAuthorityRole,
  type TipoCondicionCargo,
} from "@/lib/secretaria/cargo-validation";

interface Draft {
  person_id: string;
  tipo_condicion: TipoCondicion;
  body_id: string; // si es cargo colegiado, id del órgano; si no, vacío
  representative_person_id: string; // si ADMIN_PJ, persona física representante
  fuente_designacion: FuenteDesignacion;
  inscripcion_rm_referencia: string;
  inscripcion_rm_fecha: string;
  fecha_inicio: string;
}

interface BodyRow {
  id: string;
  slug?: string | null;
  name: string;
  body_type: string;
  config?: Record<string, unknown> | null;
}

const CARGOS_NO_COLEGIADOS: TipoCondicion[] = [
  "ADMIN_UNICO",
  "ADMIN_SOLIDARIO",
  "ADMIN_MANCOMUNADO",
  "ADMIN_PJ",
];

// L17: VICESECRETARIO incluido como cargo colegiado inscribible
// (RRM art. 109, 124 + LSC art. 529 octies). Coherente con
// CARGOS_COLEGIADOS de `lib/secretaria/cargo-validation.ts` —
// fuente de verdad única.
const CARGOS_COLEGIADOS: TipoCondicion[] = [
  "PRESIDENTE",
  "VICEPRESIDENTE",
  "SECRETARIO",
  "VICESECRETARIO",
  "CONSEJERO_COORDINADOR",
  "CONSEJERO",
];

export default function DesignarAdminStepper() {
  const params = useParams<{ id?: string }>(); // `id` = entityId en /sociedades/:id/admin/nuevo
  const [searchParams] = useSearchParams();
  // P2 Codex iter-5: leer también ?entity= (scope param del scope-switcher) como fallback
  // para preservar la sociedad seleccionada cuando se entra al wizard desde un scoped view
  // (PersonasList con scope sociedad usa createScopedTo que añade ?entity=).
  const entityIdFromUrl =
    params.id ?? searchParams.get("entityId") ?? searchParams.get("entity") ?? "";
  const personIdFromUrl = searchParams.get("personId") ?? "";
  const bodyIdFromUrl = searchParams.get("bodyId") ?? "";
  const navigate = useNavigate();
  const { tenantId } = useTenantContext();

  // Si falta entityId en URL, añadimos paso "Sociedad" al inicio.
  const needsSociedadStep = !entityIdFromUrl;
  // Si llega personId, saltamos el paso 0 (Persona).
  const startStep = personIdFromUrl ? 1 : 0;

  const [entityId, setEntityId] = useState<string>(entityIdFromUrl);
  const { data: sociedad } = useSociedad(entityId || undefined);
  const { data: sociedades } = useSociedades();
  const { data: personas } = usePersonasCanonical({});
  // P2 Codex iter-6: fetch byId la persona preselected para no depender del cap del list query.
  // Cubre el caso en que la persona pasada por ?personId= está alfabéticamente fuera del cap.
  const { data: personaPreselected } = usePersonaCanonical(personIdFromUrl || undefined);
  const [bodies, setBodies] = useState<BodyRow[]>([]);

  const [step, setStep] = useState<number>(startStep);
  const [draft, setDraft] = useState<Draft>({
    person_id: personIdFromUrl,
    tipo_condicion: "CONSEJERO",
    body_id: bodyIdFromUrl,
    representative_person_id: "",
    fuente_designacion: "ACTA_NOMBRAMIENTO",
    inscripcion_rm_referencia: "",
    inscripcion_rm_fecha: "",
    fecha_inicio: new Date().toISOString().slice(0, 10),
  });

  const asignarMutation = useAsignarCargo();
  // P2 Codex iteration-2: dual persistence — tras INSERT cargo, también
  // upsert a representaciones (fuente canónica leída por banner per-sociedad
  // de PersonaDetalle via useRepresentantesAdminPJByPerson).
  const upsertRepMutation = useUpsertRepresentanteAdminPJ();

  // STEPS dinámicos. Sin sociedad seleccionada por URL, insertamos "Sociedad".
  const STEPS = needsSociedadStep
    ? ["Persona", "Sociedad", "Cargo", "Designación", "Confirmar"]
    : ["Persona", "Cargo", "Designación", "Confirmar"];

  // Mapeo de pasos: necesitamos resolver qué bloque renderizar en cada índice.
  // index 0 -> Persona
  // si needsSociedadStep: index 1 -> Sociedad, index 2 -> Cargo, index 3 -> Designación, index 4 -> Confirmar
  // si !needsSociedadStep: index 1 -> Cargo, index 2 -> Designación, index 3 -> Confirmar
  const stepIdx = {
    persona: 0,
    sociedad: needsSociedadStep ? 1 : -1,
    cargo: needsSociedadStep ? 2 : 1,
    designacion: needsSociedadStep ? 3 : 2,
    confirmar: needsSociedadStep ? 4 : 3,
  };

  // Si viene bodyId por URL, pre-cargamos la lista de órganos para poder
  // renderizar el nombre en el step "Cargo".
  useEffect(() => {
    if (bodyIdFromUrl && entityId && bodies.length === 0) {
      void (async () => {
        const { data } = await supabase
          .from("governing_bodies")
          .select("id, slug, name, body_type, config")
          .eq("entity_id", entityId);
        if (data) setBodies((data as BodyRow[]).filter(isOperationalSecretariaBody));
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyIdFromUrl, entityId]);

  // Cargar órganos de la sociedad si el cargo es colegiado.
  // Usa `requiresBodyId` como fuente de verdad (cargo-validation.ts).
  const esColegiado = requiresBodyId(draft.tipo_condicion as TipoCondicionCargo);
  const esAdminPJ = draft.tipo_condicion === "ADMIN_PJ";
  // P2 Codex iter-6: prioridad al preselected byId (siempre disponible aunque esté fuera del cap),
  // fallback al list que el usuario puede haber cambiado interactivamente.
  const personaSeleccionada =
    personaPreselected && personaPreselected.id === draft.person_id
      ? personaPreselected
      : (personas ?? []).find((p) => p.id === draft.person_id);
  const personaEsPJ = personaSeleccionada?.person_type === "PJ";

  // P1 Codex iteration-2: derive personRequiresRep desde helper canónico para
  // que el gate cubra TODOS los cargos admin + CONSEJERO cuando la persona es
  // PJ (LSC art. 212bis), no solo ADMIN_PJ.
  const personRequiresRep = personaSeleccionada
    ? requiresRepresentative(
        { person_type: personaSeleccionada.person_type },
        draft.tipo_condicion as TipoCondicionCargo,
      )
    : false;

  // Load bodies on demand
  const loadBodies = async () => {
    if (!entityId) return;
    const { data, error } = await supabase
      .from("governing_bodies")
      .select("id,slug,name,body_type,config")
      .eq("tenant_id", tenantId!)
      .eq("entity_id", entityId)
      .order("name", { ascending: true });
    if (!error && data) setBodies((data as BodyRow[]).filter(isOperationalSecretariaBody));
  };

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const next = () => {
    // Carga órganos al entrar en el step Cargo si vamos a necesitar el dropdown.
    if (step === stepIdx.cargo && esColegiado && bodies.length === 0) {
      void loadBodies();
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const canNext = (() => {
    if (step === stepIdx.persona) return !!draft.person_id;
    if (step === stepIdx.sociedad) return !!entityId;
    if (step === stepIdx.cargo) {
      // P2 Codex iter-8: bloqueo loading state — si hay personIdFromUrl pero la
      // persona preselected aún no ha resuelto del servidor, NO permitir avanzar.
      // Sin este gate, race condition: personaSeleccionada=undefined →
      // personRequiresRep=false → permite guardar PJ admin sin representante
      // (viola L2 art. 212bis).
      if (personIdFromUrl && !personaPreselected && draft.person_id === personIdFromUrl) {
        return false; // still loading
      }
      if (esColegiado && !draft.body_id) return false;
      // ADMIN_PJ además exige que la persona designada sea PJ (mensaje en UI).
      if (esAdminPJ && !personaEsPJ) return false;
      // P1 Codex iteration-2: TODOS los cargos admin + CONSEJERO sobre PJ
      // requieren representante PF (LSC art. 212bis), no solo ADMIN_PJ.
      if (personRequiresRep && !draft.representative_person_id) return false;
      return true;
    }
    if (step === stepIdx.designacion) return !!draft.fuente_designacion && !!draft.fecha_inicio;
    return true;
  })();

  async function guardar() {
    if (!entityId) return;

    // P2 Codex iter-8: defensive validation final — verifica que si la persona
    // requiere representante (L2 art. 212bis), el draft lo tiene. Cubre el caso
    // edge de race condition donde el gate canNext se pasó con personaSeleccionada
    // aún en loading state.
    const personaFinal = personaPreselected ?? personaSeleccionada;
    if (personaFinal) {
      const needsRep = requiresRepresentative(
        { person_type: personaFinal.person_type },
        draft.tipo_condicion as TipoCondicionCargo,
      );
      if (needsRep && !draft.representative_person_id) {
        toast.error(
          "Esta persona jurídica requiere representante PF permanente (LSC art. 212 bis). " +
            "Selecciona uno antes de guardar.",
        );
        return;
      }
    } else if (personIdFromUrl) {
      // personaFinal NO debería ser undefined aquí si pasamos canNext. Si lo es,
      // algo se rompió en el flujo — abort + telemetría.
      console.error("guardar() called with personIdFromUrl set but personaFinal undefined", {
        personIdFromUrl,
        draftPersonId: draft.person_id,
      });
      toast.error("No se pudo cargar la persona seleccionada. Recarga la página e intenta de nuevo.");
      return;
    }

    try {
      await asignarMutation.mutateAsync({
        person_id: draft.person_id,
        entity_id: entityId,
        body_id: esColegiado ? draft.body_id : null,
        tipo_condicion: draft.tipo_condicion,
        fecha_inicio: draft.fecha_inicio,
        fuente_designacion: draft.fuente_designacion,
        inscripcion_rm_referencia: draft.inscripcion_rm_referencia || null,
        inscripcion_rm_fecha: draft.inscripcion_rm_fecha || null,
        representative_person_id:
          personRequiresRep && draft.representative_person_id ? draft.representative_person_id : null,
      });

      // P2 Codex iteration-2: si hay representative_person_id, también upsert
      // a representaciones (canonical source post-Fix #2 iter-1). Sin esto, el
      // banner per-sociedad de PersonaDetalle (que lee de
      // useRepresentantesAdminPJByPerson) alertaría falsamente "PJ sin rep".
      //
      // Try/catch: el cargo ya quedó creado en condiciones_persona. Si el
      // upsert a representaciones falla, mostramos warning informativo pero
      // no rompemos el flujo — el banner per-sociedad alertará al usuario
      // para que complete la designación desde la ficha de persona. RPC
      // atómica (fn_designar_representante) queda diferida a Plan A'.
      if (personRequiresRep && draft.representative_person_id) {
        try {
          await upsertRepMutation.mutateAsync({
            represented_person_id: draft.person_id,
            representative_person_id: draft.representative_person_id,
            entity_id: entityId,
            effective_from: draft.fecha_inicio,
            inscripcion_rm_referencia: draft.inscripcion_rm_referencia || null,
            inscripcion_rm_fecha: draft.inscripcion_rm_fecha || null,
          });
        } catch (repErr) {
          console.warn("Cargo creado pero upsert a representaciones falló:", repErr);
          toast.warning(
            `Cargo guardado, pero la representación canónica no se persistió. Completa la designación desde la ficha de persona (/secretaria/personas/${draft.person_id}).`,
          );
        }
      }

      // L15-L17: el trigger fn_sync_authority_evidence solo actúa sobre los
      // cargos certificantes. Avisamos al usuario para que sepa si el cargo
      // figurará en la pestaña Autoridad. Fuente de verdad única:
      // `isAuthorityRole` en `cargo-validation.ts`.
      const esCertificante = isAuthorityRole(draft.tipo_condicion as TipoCondicionCargo);
      const cargoLabel = CARGO_LABELS[draft.tipo_condicion] ?? draft.tipo_condicion;
      if (esCertificante) {
        toast.success(
          `Cargo "${cargoLabel}" registrado. Aparecerá en Autoridad (certifica actos sociales).`,
        );
      } else {
        toast.success(
          `Cargo "${cargoLabel}" registrado. No figura en Autoridad (no es certificante).`,
        );
      }

      // Navegación post-success:
      // - Si veníamos de /personas (?personId=), volvemos al perfil.
      // - Si veníamos de /sociedades/:id/admin/nuevo, volvemos a la sociedad.
      if (personIdFromUrl) {
        navigate(`/secretaria/personas/${personIdFromUrl}`);
      } else {
        navigate(`/secretaria/sociedades/${entityId}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo registrar el cargo: " + msg);
    }
  }

  // Sólo bloqueamos si no hay forma de resolver la sociedad: ni URL ni
  // selector disponible (carga de sociedades). Pero la mayoría de los casos
  // (`/secretaria/cargos/nuevo`) entran sin entityId y resuelven via paso
  // "Sociedad".
  if (!entityIdFromUrl && !needsSociedadStep) {
    return (
      <div className="mx-auto max-w-[960px] p-6 text-sm text-[var(--g-text-secondary)]">
        Falta id de sociedad.
      </div>
    );
  }

  const backHref = personIdFromUrl
    ? `/secretaria/personas/${personIdFromUrl}`
    : entityId
      ? `/secretaria/sociedades/${entityId}`
      : "/secretaria/personas";
  const backLabel = personIdFromUrl
    ? personaSeleccionada?.full_name ?? "Persona"
    : sociedad?.common_name ?? sociedad?.legal_name ?? "Sociedad";

  return (
    <div className="mx-auto max-w-[960px] p-6">
      <div className="mb-4">
        <Link
          to={backHref}
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> {backLabel}
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Gavel className="h-3.5 w-3.5" />
          Secretaría · Designación de cargo
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          {entityId
            ? `Designar administrador/consejero — ${sociedad?.common_name ?? sociedad?.legal_name ?? "…"}`
            : "Designar administrador/consejero"}
        </h1>
      </div>

      <ol className="mb-6 flex items-center gap-2 text-xs">
        {STEPS.map((label, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 rounded-full px-3 py-1 ${
                active
                  ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                  : done
                    ? "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                    : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
              }`}
            >
              <span>
                {done ? <Check className="inline h-3 w-3" /> : i + 1}. {label}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {step === stepIdx.persona && (
          <div className="grid grid-cols-1 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Persona designada *
              </span>
              <select
                value={draft.person_id}
                onChange={(e) => update("person_id", e.target.value)}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="">— Seleccionar —</option>
                {(personas ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.person_type ?? "?"}] {p.full_name}
                    {p.tax_id ? ` · ${p.tax_id}` : ""}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-[var(--g-text-secondary)]">
                ¿No existe?{" "}
                <Link to="/secretaria/personas/nueva" className="text-[var(--g-brand-3308)] underline">
                  Crear persona nueva
                </Link>
                .
              </span>
            </label>
          </div>
        )}

        {needsSociedadStep && step === stepIdx.sociedad && (
          <div className="grid grid-cols-1 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Sociedad *
              </span>
              <select
                value={entityId}
                onChange={(e) => {
                  setEntityId(e.target.value);
                  // Resetea body_id si cambiamos de sociedad: los órganos no son comparables.
                  update("body_id", "");
                  setBodies([]);
                }}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="">— Seleccionar sociedad —</option>
                {(sociedades ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.common_name ?? s.legal_name}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-[var(--g-text-secondary)]">
                La sociedad determina en qué órganos puede asignarse el cargo.
              </span>
            </label>
          </div>
        )}

        {step === stepIdx.cargo && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Tipo de cargo *
              </span>
              <select
                value={draft.tipo_condicion}
                onChange={(e) => update("tipo_condicion", e.target.value as TipoCondicion)}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <optgroup label="No colegiados (admin único/solidario/mancomunado/PJ)">
                  {CARGOS_NO_COLEGIADOS.map((c) => (
                    <option key={c} value={c}>
                      {CARGO_LABELS[c]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Órgano colegiado (Consejo de Administración)">
                  {CARGOS_COLEGIADOS.map((c) => (
                    <option key={c} value={c}>
                      {CARGO_LABELS[c]}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            {esColegiado && (
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                  Órgano colegiado *
                </span>
                <select
                  value={draft.body_id}
                  onClick={() => bodies.length === 0 && void loadBodies()}
                  onChange={(e) => update("body_id", e.target.value)}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="">— Seleccionar órgano —</option>
                  {bodies.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.body_type})
                    </option>
                  ))}
                </select>
                {bodies.length === 0 && (
                  <button
                    type="button"
                    onClick={() => void loadBodies()}
                    className="mt-1 self-start text-[11px] text-[var(--g-brand-3308)] underline"
                  >
                    Cargar órganos disponibles
                  </button>
                )}
              </label>
            )}

            {/* ADMIN_PJ exige adicionalmente que la persona sea PJ — mensaje informativo. */}
            {esAdminPJ && !personaEsPJ && draft.person_id && (
              <div className="md:col-span-2 rounded-md bg-[var(--status-warning)]/10 p-3 text-xs text-[var(--g-text-primary)]">
                El cargo ADMIN_PJ requiere que la persona designada sea PJ. Cambia a otra persona o selecciona otro tipo de cargo.
              </div>
            )}

            {/*
              P1 Codex iteration-2: selector de representante PF visible cuando
              `personRequiresRep` (LSC art. 212bis). Esto cubre ADMIN_UNICO,
              ADMIN_SOLIDARIO, ADMIN_MANCOMUNADO, ADMIN_PJ y CONSEJERO si la
              persona seleccionada es PJ.
            */}
            {personRequiresRep && (
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                  Representante permanente (PF) *
                </span>
                <select
                  value={draft.representative_person_id}
                  onChange={(e) => update("representative_person_id", e.target.value)}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                  aria-required="true"
                >
                  <option value="">— Seleccionar PF —</option>
                  {(personas ?? [])
                    .filter((p) => p.person_type === "PF")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} {p.tax_id ? `· ${p.tax_id}` : ""}
                      </option>
                    ))}
                </select>
                <span className="text-[11px] text-[var(--g-text-secondary)]">
                  LSC art. 212 bis: la PJ administradora designa persona natural permanente.
                </span>
              </label>
            )}
          </div>
        )}

        {step === stepIdx.designacion && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Fuente de designación *
              </span>
              <select
                value={draft.fuente_designacion}
                onChange={(e) => update("fuente_designacion", e.target.value as FuenteDesignacion)}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="ACTA_NOMBRAMIENTO">Acta de nombramiento</option>
                <option value="ESCRITURA">Escritura notarial</option>
                <option value="DECISION_UNIPERSONAL">Decisión unipersonal</option>
                <option value="BOOTSTRAP">Bootstrap (migración inicial)</option>
              </select>
            </label>
            <Input
              label="Fecha de inicio *"
              type="date"
              value={draft.fecha_inicio}
              onChange={(v) => update("fecha_inicio", v)}
            />
            <Input
              label="Referencia inscripción RM"
              value={draft.inscripcion_rm_referencia}
              onChange={(v) => update("inscripcion_rm_referencia", v)}
              placeholder="T 1234, F 56, H M-12345 Ins. 7"
            />
            <Input
              label="Fecha inscripción RM"
              type="date"
              value={draft.inscripcion_rm_fecha}
              onChange={(v) => update("inscripcion_rm_fecha", v)}
            />
          </div>
        )}

        {step === stepIdx.confirmar && (
          <div>
            <p className="mb-4 text-sm text-[var(--g-text-primary)]">
              Este registro crea un asiento en <code>condiciones_persona</code> con estado VIGENTE.
              Si el cargo es certificante (PRESIDENTE, SECRETARIO, etc.), el trigger{" "}
              <code>fn_sync_authority_evidence</code> replicará automáticamente en{" "}
              <code>authority_evidence</code>.
            </p>
            <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field
                label="Persona"
                value={personaSeleccionada?.full_name ?? "—"}
              />
              <Field
                label="Sociedad"
                value={sociedad?.common_name ?? sociedad?.legal_name ?? "—"}
              />
              <Field label="Tipo de cargo" value={CARGO_LABELS[draft.tipo_condicion]} />
              {esColegiado && (
                <Field
                  label="Órgano"
                  value={bodies.find((b) => b.id === draft.body_id)?.name ?? "—"}
                />
              )}
              {personRequiresRep && (
                <Field
                  label="Representante"
                  value={
                    (personas ?? []).find((p) => p.id === draft.representative_person_id)?.full_name ?? "—"
                  }
                />
              )}
              <Field label="Fuente" value={draft.fuente_designacion} />
              <Field label="Fecha inicio" value={draft.fecha_inicio} />
              <Field label="Inscripción RM" value={draft.inscripcion_rm_referencia || "—"} />
            </dl>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          disabled={step === 0}
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Atrás
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            disabled={!canNext}
            className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Siguiente
          </button>
        ) : (
          <button
            type="button"
            onClick={guardar}
            disabled={asignarMutation.isPending || upsertRepMutation.isPending}
            aria-busy={asignarMutation.isPending || upsertRepMutation.isPending}
            className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {asignarMutation.isPending || upsertRepMutation.isPending ? "Registrando…" : "Designar"}
          </button>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
        style={{ borderRadius: "var(--g-radius-md)" }}
      />
    </label>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</dt>
      <dd className="text-sm text-[var(--g-text-primary)]">{value}</dd>
    </div>
  );
}
