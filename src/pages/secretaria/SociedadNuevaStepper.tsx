import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

type TipoSocial = "SA" | "SL" | "SLU" | "SAU";
type TipoOrgano = "ADMIN_UNICO" | "SOLIDARIO" | "MANCOMUNADO" | "CONSEJO";

interface Draft {
  // Paso 1 — identidad
  legal_name: string;
  common_name: string;
  tax_id: string;
  tipo_social: TipoSocial;
  jurisdiction: string;
  registration_number: string;
  // Paso 2 — forma de administración
  forma_administracion: string;
  tipo_organo_admin: TipoOrgano;
  es_unipersonal: boolean;
  es_cotizada: boolean;
  // Paso 3 — capital
  currency: string;
  capital_escriturado: string;
  numero_titulos: string;
  valor_nominal: string;
}

const EMPTY: Draft = {
  legal_name: "",
  common_name: "",
  tax_id: "",
  tipo_social: "SL",
  jurisdiction: "ES",
  registration_number: "",
  forma_administracion: "SOLIDARIO",
  tipo_organo_admin: "SOLIDARIO",
  es_unipersonal: false,
  es_cotizada: false,
  currency: "EUR",
  capital_escriturado: "3000",
  numero_titulos: "3000",
  valor_nominal: "1",
};

const STEPS = ["Identidad", "Administración", "Capital", "Confirmar"];

export default function SociedadNuevaStepper() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const canNext = (() => {
    if (step === 0) return draft.legal_name.trim() && draft.tax_id.trim() && draft.jurisdiction;
    if (step === 1) return draft.tipo_organo_admin;
    if (step === 2) return Number(draft.capital_escriturado) > 0;
    return true;
  })();

  async function guardar() {
    setSaving(true);
    try {
      // 1) Crear persona jurídica (PJ) para la sociedad
      const { data: person, error: pErr } = await supabase
        .from("persons")
        .insert({
          tenant_id: DEMO_TENANT,
          full_name: draft.legal_name,
          denomination: draft.legal_name,
          tax_id: draft.tax_id,
          person_type: "PJ",
        })
        .select()
        .single();
      if (pErr || !person) throw pErr ?? new Error("No se creó la PJ");

      // 2) Crear entity con FK person_id
      const slug = draft.legal_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);
      const { data: entity, error: eErr } = await supabase
        .from("entities")
        .insert({
          tenant_id: DEMO_TENANT,
          person_id: person.id,
          slug: `${slug}-${Date.now()}`,
          legal_name: draft.legal_name,
          common_name: draft.common_name || draft.legal_name,
          jurisdiction: draft.jurisdiction,
          legal_form: draft.tipo_social,
          tipo_social: draft.tipo_social,
          registration_number: draft.registration_number || null,
          forma_administracion: draft.forma_administracion,
          tipo_organo_admin: draft.tipo_organo_admin,
          es_unipersonal: draft.es_unipersonal,
          es_cotizada: draft.es_cotizada,
          entity_status: "Active",
          materiality: "Medium",
        })
        .select()
        .single();
      if (eErr || !entity) throw eErr ?? new Error("No se creó la entidad");

      // 3) Crear entity_capital_profile VIGENTE
      const { error: cErr } = await supabase.from("entity_capital_profile").insert({
        tenant_id: DEMO_TENANT,
        entity_id: entity.id,
        currency: draft.currency,
        capital_escriturado: Number(draft.capital_escriturado),
        capital_desembolsado: Number(draft.capital_escriturado),
        numero_titulos: Number(draft.numero_titulos),
        valor_nominal: Number(draft.valor_nominal),
        estado: "VIGENTE",
        effective_from: new Date().toISOString().slice(0, 10),
      });
      if (cErr) throw cErr;

      // 4) Clase única "A" por defecto
      const { error: scErr } = await supabase.from("share_classes").insert({
        tenant_id: DEMO_TENANT,
        entity_id: entity.id,
        class_code: "A",
        name: "Clase ordinaria",
        votes_per_title: 1,
        economic_rights_coeff: 1,
        voting_rights: true,
        veto_rights: false,
      });
      if (scErr) throw scErr;

      toast.success("Sociedad creada correctamente");
      navigate(`/secretaria/sociedades/${entity.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo crear la sociedad: " + msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[960px] p-6">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigate("/secretaria/sociedades")}
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> Sociedades
        </button>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Building2 className="h-3.5 w-3.5" />
          Secretaría · Nueva sociedad
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Alta de sociedad
        </h1>
      </div>

      {/* Stepper */}
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
        {step === 0 && <StepIdentidad draft={draft} update={update} />}
        {step === 1 && <StepAdmin draft={draft} update={update} />}
        {step === 2 && <StepCapital draft={draft} update={update} />}
        {step === 3 && <StepConfirm draft={draft} />}
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
            {saving ? "Creando…" : "Crear sociedad"}
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

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--g-brand-3308)]"
      />
      <div>
        <div className="text-sm text-[var(--g-text-primary)]">{label}</div>
        {help ? <div className="text-xs text-[var(--g-text-secondary)]">{help}</div> : null}
      </div>
    </label>
  );
}

// Paso 1
function StepIdentidad({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input
        label="Denominación legal *"
        value={draft.legal_name}
        onChange={(v) => update("legal_name", v)}
        placeholder="ARGA SEGUROS, S.A."
      />
      <Input
        label="Nombre común"
        value={draft.common_name}
        onChange={(v) => update("common_name", v)}
        placeholder="ARGA Seguros"
      />
      <Input
        label="NIF/CIF *"
        value={draft.tax_id}
        onChange={(v) => update("tax_id", v)}
        placeholder="A-XXXXXXXX"
      />
      <Select
        label="Tipo social"
        value={draft.tipo_social}
        onChange={(v) => update("tipo_social", v)}
        options={[
          { value: "SA", label: "S.A. — Sociedad Anónima" },
          { value: "SL", label: "S.L. — Sociedad Limitada" },
          { value: "SAU", label: "S.A.U. — S.A. unipersonal" },
          { value: "SLU", label: "S.L.U. — S.L. unipersonal" },
        ]}
      />
      <Input
        label="Jurisdicción *"
        value={draft.jurisdiction}
        onChange={(v) => update("jurisdiction", v)}
        placeholder="ES"
      />
      <Input
        label="Nº registral (RM)"
        value={draft.registration_number}
        onChange={(v) => update("registration_number", v)}
        placeholder="T 1234, F 56, H M-12345"
      />
    </div>
  );
}

// Paso 2
function StepAdmin({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Select
        label="Órgano de administración"
        value={draft.tipo_organo_admin}
        onChange={(v) => {
          update("tipo_organo_admin", v);
          update("forma_administracion", v);
        }}
        options={[
          { value: "ADMIN_UNICO", label: "Administrador único" },
          { value: "SOLIDARIO", label: "Administradores solidarios" },
          { value: "MANCOMUNADO", label: "Administradores mancomunados" },
          { value: "CONSEJO", label: "Consejo de Administración" },
        ]}
      />
      <div className="flex flex-col gap-3">
        <Checkbox
          label="Sociedad unipersonal"
          value={draft.es_unipersonal}
          onChange={(v) => update("es_unipersonal", v)}
          help="Marca si la sociedad tiene un único socio (SLU/SAU)."
        />
        <Checkbox
          label="Sociedad cotizada"
          value={draft.es_cotizada}
          onChange={(v) => update("es_cotizada", v)}
          help="Motor LSC evaluará + advertirá sobre implicaciones LMV (DL-2)."
        />
      </div>
    </div>
  );
}

// Paso 3
function StepCapital({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  const valueNominal =
    Number(draft.capital_escriturado) > 0 && Number(draft.numero_titulos) > 0
      ? Number(draft.capital_escriturado) / Number(draft.numero_titulos)
      : 0;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input
        label="Moneda"
        value={draft.currency}
        onChange={(v) => update("currency", v)}
      />
      <Input
        label="Capital escriturado *"
        type="number"
        value={draft.capital_escriturado}
        onChange={(v) => update("capital_escriturado", v)}
      />
      <Input
        label="Número de títulos"
        type="number"
        value={draft.numero_titulos}
        onChange={(v) => update("numero_titulos", v)}
      />
      <Input
        label="Valor nominal (auto)"
        type="number"
        value={valueNominal ? valueNominal.toString() : draft.valor_nominal}
        onChange={(v) => update("valor_nominal", v)}
      />
    </div>
  );
}

// Paso 4 — Confirmación
function StepConfirm({ draft }: { draft: Draft }) {
  return (
    <div>
      <p className="mb-4 text-sm text-[var(--g-text-primary)]">
        Revisa los datos antes de crear la sociedad. Esta acción crea:
      </p>
      <ul className="mb-4 list-disc pl-6 text-sm text-[var(--g-text-secondary)]">
        <li>Persona jurídica (persons) con denominación y NIF.</li>
        <li>Entidad (entities) con FK a la PJ.</li>
        <li>Perfil de capital VIGENTE (entity_capital_profile).</li>
        <li>Clase de títulos &ldquo;A&rdquo; ordinaria por defecto.</li>
      </ul>
      <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Denominación" value={draft.legal_name} />
        <Field label="NIF/CIF" value={draft.tax_id} />
        <Field label="Tipo" value={draft.tipo_social} />
        <Field label="Jurisdicción" value={draft.jurisdiction} />
        <Field label="Órgano" value={draft.tipo_organo_admin} />
        <Field label="Unipersonal / Cotizada" value={`${draft.es_unipersonal ? "Sí" : "No"} · ${draft.es_cotizada ? "Sí" : "No"}`} />
        <Field label="Capital" value={`${draft.capital_escriturado} ${draft.currency}`} />
        <Field label="Títulos" value={`${draft.numero_titulos} × ${draft.valor_nominal}`} />
      </dl>
    </div>
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
