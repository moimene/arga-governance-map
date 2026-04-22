import { useEffect, useState } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { Gavel, Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSociedad } from "@/hooks/useSociedades";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import {
  CARGO_LABELS,
  type TipoCondicion,
  type FuenteDesignacion,
} from "@/hooks/useCargos";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

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
  name: string;
  body_type: string;
}

const CARGOS_NO_COLEGIADOS: TipoCondicion[] = [
  "ADMIN_UNICO",
  "ADMIN_SOLIDARIO",
  "ADMIN_MANCOMUNADO",
  "ADMIN_PJ",
];

const CARGOS_COLEGIADOS: TipoCondicion[] = [
  "PRESIDENTE",
  "VICEPRESIDENTE",
  "SECRETARIO",
  "CONSEJERO_COORDINADOR",
  "CONSEJERO",
];

const STEPS = ["Persona", "Cargo", "Designación", "Confirmar"];

export default function DesignarAdminStepper() {
  const { id: entityId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const bodyIdFromUrl = searchParams.get("bodyId") ?? "";
  const navigate = useNavigate();

  const { data: sociedad } = useSociedad(entityId);
  const { data: personas } = usePersonasCanonical({});
  const [bodies, setBodies] = useState<BodyRow[]>([]);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    person_id: "",
    tipo_condicion: "CONSEJERO",
    body_id: bodyIdFromUrl,
    representative_person_id: "",
    fuente_designacion: "ACTA_NOMBRAMIENTO",
    inscripcion_rm_referencia: "",
    inscripcion_rm_fecha: "",
    fecha_inicio: new Date().toISOString().slice(0, 10),
  });

  // Si viene bodyId por URL, pre-cargamos la lista de órganos para poder
  // renderizar el nombre en el step "Cargo".
  useEffect(() => {
    if (bodyIdFromUrl && entityId && bodies.length === 0) {
      void (async () => {
        const { data } = await supabase
          .from("governing_bodies")
          .select("id, name, body_type")
          .eq("entity_id", entityId);
        if (data) setBodies(data as BodyRow[]);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyIdFromUrl, entityId]);

  // Cargar órganos de la sociedad si el cargo es colegiado
  const esColegiado = CARGOS_COLEGIADOS.includes(draft.tipo_condicion);
  const esAdminPJ = draft.tipo_condicion === "ADMIN_PJ";
  const personaSeleccionada = (personas ?? []).find((p) => p.id === draft.person_id);
  const personaEsPJ = personaSeleccionada?.person_type === "PJ";

  // Load bodies on demand
  const loadBodies = async () => {
    if (!entityId) return;
    const { data, error } = await supabase
      .from("governing_bodies")
      .select("id,name,body_type")
      .eq("tenant_id", DEMO_TENANT)
      .eq("entity_id", entityId)
      .order("name", { ascending: true });
    if (!error && data) setBodies(data as BodyRow[]);
  };

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const next = () => {
    if (step === 1 && esColegiado && bodies.length === 0) {
      void loadBodies();
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const canNext = (() => {
    if (step === 0) return !!draft.person_id;
    if (step === 1) {
      if (esColegiado && !draft.body_id) return false;
      if (esAdminPJ && !personaEsPJ) return false;
      if (esAdminPJ && !draft.representative_person_id) return false;
      return true;
    }
    if (step === 2) return !!draft.fuente_designacion && !!draft.fecha_inicio;
    return true;
  })();

  async function guardar() {
    if (!entityId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        tenant_id: DEMO_TENANT,
        person_id: draft.person_id,
        entity_id: entityId,
        body_id: esColegiado ? draft.body_id : null,
        tipo_condicion: draft.tipo_condicion,
        estado: "VIGENTE",
        fecha_inicio: draft.fecha_inicio,
        fecha_fin: null,
        fuente_designacion: draft.fuente_designacion,
        inscripcion_rm_referencia: draft.inscripcion_rm_referencia || null,
        inscripcion_rm_fecha: draft.inscripcion_rm_fecha || null,
      };
      if (esAdminPJ && draft.representative_person_id) {
        payload.representative_person_id = draft.representative_person_id;
      }

      const { error } = await supabase.from("condiciones_persona").insert(payload);
      if (error) throw error;

      toast.success("Cargo registrado correctamente. Se sincroniza authority_evidence si corresponde.");
      navigate(`/secretaria/sociedades/${entityId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo registrar el cargo: " + msg);
    } finally {
      setSaving(false);
    }
  }

  if (!entityId) {
    return <div className="mx-auto max-w-[960px] p-6 text-sm text-[var(--g-text-secondary)]">Falta id de sociedad.</div>;
  }

  return (
    <div className="mx-auto max-w-[960px] p-6">
      <div className="mb-4">
        <Link
          to={`/secretaria/sociedades/${entityId}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> {sociedad?.common_name ?? "Sociedad"}
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Gavel className="h-3.5 w-3.5" />
          Secretaría · Designación de cargo
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Designar administrador/consejero — {sociedad?.common_name ?? sociedad?.legal_name ?? "…"}
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
        {step === 0 && (
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

        {step === 1 && (
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

            {esAdminPJ && (
              <>
                {!personaEsPJ && draft.person_id && (
                  <div className="md:col-span-2 rounded-md bg-[var(--status-warning)]/10 p-3 text-xs text-[var(--g-text-primary)]">
                    El cargo ADMIN_PJ requiere que la persona designada sea PJ. Cambia a otra persona o selecciona otro tipo de cargo.
                  </div>
                )}
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Representante permanente (PF) *
                  </span>
                  <select
                    value={draft.representative_person_id}
                    onChange={(e) => update("representative_person_id", e.target.value)}
                    className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                    style={{ borderRadius: "var(--g-radius-md)" }}
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
                </label>
              </>
            )}
          </div>
        )}

        {step === 2 && (
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

        {step === 3 && (
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
              <Field label="Tipo de cargo" value={CARGO_LABELS[draft.tipo_condicion]} />
              {esColegiado && (
                <Field
                  label="Órgano"
                  value={bodies.find((b) => b.id === draft.body_id)?.name ?? "—"}
                />
              )}
              {esAdminPJ && (
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
            disabled={saving}
            aria-busy={saving}
            className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {saving ? "Registrando…" : "Designar"}
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
