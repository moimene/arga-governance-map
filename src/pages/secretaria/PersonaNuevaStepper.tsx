import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Check, ChevronLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { PersonType } from "@/hooks/usePersonasCanonical";
import { useTenantContext } from "@/context/TenantContext";

// G1.3: tipo del resultado del precheck de colisión de tax_id.
// "entity"  = el tax_id ya pertenece a una sociedad gestionada (BLOQUEA)
// "person"  = existe persona con mismo tax_id pero NO está vinculada a
//             entity (ADVIERTE; BD rechazará si hay UNIQUE)
type TaxIdConflict =
  | { kind: "entity"; person_id: string; person_name: string; entity_id: string; entity_name: string }
  | { kind: "person"; person_id: string; person_name: string }
  | null;

interface Draft {
  person_type: PersonType;
  full_name: string;
  tax_id: string;
  email: string;
  denomination: string; // solo PJ
}

const EMPTY: Draft = {
  person_type: "PF",
  full_name: "",
  tax_id: "",
  email: "",
  denomination: "",
};

const STEPS = ["Tipo", "Datos", "Confirmar"];

export default function PersonaNuevaStepper() {
  const navigate = useNavigate();
  const { tenantId } = useTenantContext();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  // G1.3: precheck colisión tax_id.
  const [taxIdConflict, setTaxIdConflict] = useState<TaxIdConflict>(null);
  const [checkingTaxId, setCheckingTaxId] = useState(false);

  useEffect(() => {
    const raw = draft.tax_id.trim();
    if (!raw || !tenantId) {
      setTaxIdConflict(null);
      setCheckingTaxId(false);
      return;
    }
    setCheckingTaxId(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data: personMatch, error: pErr } = await supabase
          .from("persons")
          .select("id, full_name")
          .eq("tenant_id", tenantId)
          .eq("tax_id", raw)
          .abortSignal(controller.signal)
          .maybeSingle();
        if (pErr && pErr.code !== "PGRST116") throw pErr;
        if (!personMatch) {
          setTaxIdConflict(null);
          setCheckingTaxId(false);
          return;
        }
        const { data: entityMatch, error: eErr } = await supabase
          .from("entities")
          .select("id, common_name, legal_name")
          .eq("tenant_id", tenantId)
          .eq("person_id", personMatch.id)
          .abortSignal(controller.signal)
          .maybeSingle();
        if (eErr && eErr.code !== "PGRST116") throw eErr;
        if (entityMatch) {
          setTaxIdConflict({
            kind: "entity",
            person_id: personMatch.id,
            person_name: personMatch.full_name,
            entity_id: entityMatch.id,
            entity_name: entityMatch.common_name ?? entityMatch.legal_name,
          });
        } else {
          setTaxIdConflict({
            kind: "person",
            person_id: personMatch.id,
            person_name: personMatch.full_name,
          });
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        // Errores no bloqueantes: no mostrar UI de conflicto ante fallo de red.
        setTaxIdConflict(null);
      } finally {
        setCheckingTaxId(false);
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [draft.tax_id, tenantId]);

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const canNext = (() => {
    if (step === 0) return !!draft.person_type;
    if (step === 1) {
      // L19/G1.3: NIF/CIF debe ser unico por tenant. Bloqueamos ambos casos:
      //  - "entity": el NIF ya pertenece a una sociedad gestionada.
      //  - "person": ya existe persona con ese NIF (no es entity). La BD
      //    rechazaria con UNIQUE de todos modos; el bloqueo previo evita el
      //    intento y propone abrir la ficha existente.
      if (taxIdConflict?.kind === "entity" || taxIdConflict?.kind === "person") return false;
      return draft.full_name.trim() && draft.tax_id.trim();
    }
    return true;
  })();

  async function guardar() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        tenant_id: tenantId!,
        person_type: draft.person_type,
        full_name: draft.full_name.trim(),
        tax_id: draft.tax_id.trim() || null,
        email: draft.email.trim() || null,
      };
      if (draft.person_type === "PJ") {
        payload.denomination = draft.denomination.trim() || draft.full_name.trim();
      }
      const { data: person, error } = await supabase
        .from("persons")
        .insert(payload)
        .select()
        .single();
      if (error || !person) throw error ?? new Error("No se creó la persona");
      toast.success("Persona creada correctamente");
      navigate(`/secretaria/personas/${person.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo crear la persona: " + msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[960px] p-6">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigate("/secretaria/personas")}
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> Personas
        </button>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Users className="h-3.5 w-3.5" />
          Secretaría · Nueva persona
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Alta de persona {draft.person_type === "PF" ? "física" : "jurídica"}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Tipo de persona *
              </span>
              <select
                value={draft.person_type}
                onChange={(e) => update("person_type", e.target.value as PersonType)}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="PF">PF — Persona física</option>
                <option value="PJ">PJ — Persona jurídica</option>
              </select>
            </label>
            <div className="rounded-md bg-[var(--g-surface-subtle)] p-3 text-sm text-[var(--g-text-secondary)]">
              {draft.person_type === "PF"
                ? "Persona individual (DNI/NIE). Puede ser socio, consejero, apoderado, representante permanente de una PJ, etc."
                : "Sociedad o entidad con CIF. Puede actuar como socio o como administrador PJ (en cuyo caso necesita un representante permanente PF)."}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={draft.person_type === "PF" ? "Nombre completo *" : "Denominación legal *"}
              value={draft.full_name}
              onChange={(v) => update("full_name", v)}
              placeholder={draft.person_type === "PF" ? "Lucía Martín García" : "ARGA Cartera, S.L.U."}
            />
            <div className="flex flex-col gap-1">
              <Input
                label={draft.person_type === "PF" ? "DNI/NIE *" : "CIF *"}
                value={draft.tax_id}
                onChange={(v) => update("tax_id", v)}
                placeholder={draft.person_type === "PF" ? "00000000-A" : "B-99999999"}
              />
              {checkingTaxId && (
                <span className="text-[11px] text-[var(--g-text-secondary)]">
                  Comprobando disponibilidad…
                </span>
              )}
              {!checkingTaxId && taxIdConflict?.kind === "entity" && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="flex items-start gap-2 border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 p-2 text-xs text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-error)]" />
                  <div>
                    Este NIF ya corresponde a la sociedad{" "}
                    <strong>{taxIdConflict.entity_name}</strong>, que se gestiona
                    en el sistema.{" "}
                    <Link
                      to={`/secretaria/sociedades/${taxIdConflict.entity_id}`}
                      className="text-[var(--g-brand-3308)] underline"
                    >
                      Abrir en Sociedades
                    </Link>{" "}
                    o cambia el NIF.
                  </div>
                </div>
              )}
              {!checkingTaxId && taxIdConflict?.kind === "person" && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="flex items-start gap-2 border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 p-2 text-xs text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-error)]" />
                  <div className="flex-1">
                    Ya existe una persona con este NIF/CIF:{" "}
                    <strong>{taxIdConflict.person_name}</strong>. Para evitar duplicidades, abre la
                    ficha existente y vincula desde ahí.
                    <div className="mt-2">
                      <Link
                        to={`/secretaria/personas/${taxIdConflict.person_id}`}
                        className="inline-flex items-center gap-1 bg-[var(--g-brand-3308)] px-2.5 py-1 text-xs font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        Abrir ficha existente
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Input
              label="Email"
              value={draft.email}
              onChange={(v) => update("email", v)}
              placeholder="persona@arga-seguros.com"
              type="email"
            />
            {draft.person_type === "PJ" && (
              <>
                <Input
                  label="Denominación comercial"
                  value={draft.denomination}
                  onChange={(v) => update("denomination", v)}
                  placeholder="ARGA Cartera"
                />
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-4 text-sm text-[var(--g-text-primary)]">
              Revisa los datos antes de crear la persona.
            </p>
            <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Tipo" value={draft.person_type === "PF" ? "Persona física" : "Persona jurídica"} />
              <Field label="Nombre / Denominación" value={draft.full_name} />
              <Field label="NIF/CIF" value={draft.tax_id || "—"} />
              <Field label="Email" value={draft.email || "—"} />
              {draft.person_type === "PJ" && (
                <>
                  <Field label="Denominación comercial" value={draft.denomination || "—"} />
                </>
              )}
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
            {saving ? "Creando…" : "Crear persona"}
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
