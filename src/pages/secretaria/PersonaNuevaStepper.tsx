import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePersonasCanonical, type PersonType } from "@/hooks/usePersonasCanonical";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

interface Draft {
  person_type: PersonType;
  full_name: string;
  tax_id: string;
  email: string;
  denomination: string; // solo PJ
  representative_person_id: string; // solo PJ
}

const EMPTY: Draft = {
  person_type: "PF",
  full_name: "",
  tax_id: "",
  email: "",
  denomination: "",
  representative_person_id: "",
};

const STEPS = ["Tipo", "Datos", "Confirmar"];

export default function PersonaNuevaStepper() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  // lista PF disponibles (para elegir representante si es PJ)
  const { data: personasPF } = usePersonasCanonical({ person_type: "PF" });

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const canNext = (() => {
    if (step === 0) return !!draft.person_type;
    if (step === 1) return draft.full_name.trim() && draft.tax_id.trim();
    return true;
  })();

  async function guardar() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        tenant_id: DEMO_TENANT,
        person_type: draft.person_type,
        full_name: draft.full_name.trim(),
        tax_id: draft.tax_id.trim() || null,
        email: draft.email.trim() || null,
      };
      if (draft.person_type === "PJ") {
        payload.denomination = draft.denomination.trim() || draft.full_name.trim();
        if (draft.representative_person_id) {
          payload.representative_person_id = draft.representative_person_id;
        }
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
            <Input
              label={draft.person_type === "PF" ? "DNI/NIE *" : "CIF *"}
              value={draft.tax_id}
              onChange={(v) => update("tax_id", v)}
              placeholder={draft.person_type === "PF" ? "00000000-A" : "B-99999999"}
            />
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
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Representante permanente (PF)
                  </span>
                  <select
                    value={draft.representative_person_id}
                    onChange={(e) => update("representative_person_id", e.target.value)}
                    className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <option value="">— Sin asignar —</option>
                    {(personasPF ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} {p.tax_id ? `· ${p.tax_id}` : ""}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-[var(--g-text-secondary)]">
                    Obligatorio si esta PJ actuará como administrador (admin PJ).
                  </span>
                </label>
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
                  <Field
                    label="Representante"
                    value={
                      draft.representative_person_id
                        ? (personasPF ?? []).find((p) => p.id === draft.representative_person_id)?.full_name ?? "—"
                        : "—"
                    }
                  />
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
