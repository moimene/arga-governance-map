import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Check, ChevronLeft, ClipboardCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  useCreatePersonaCompleta,
  type PersonaCompletaInput,
  type PersonType,
} from "@/hooks/usePersonasCanonical";
import { cn } from "@/lib/utils";

type TaxIdConflict =
  | { kind: "entity"; person_id: string; person_name: string; entity_id: string; entity_name: string }
  | { kind: "person"; person_id: string; person_name: string }
  | null;

interface Draft {
  person_type: PersonType;
  full_name: string;
  tax_id: string;
  email: string;
  denomination: string;
  document_type: string;
  document_country: string;
  nationality: string;
  birth_date: string;
  birth_place: string;
  legal_form: string;
  jurisdiction: string;
  registry_name: string;
  registry_number: string;
  lei_code: string;
  phone: string;
  secondary_email: string;
  preferred_language: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  province: string;
  country: string;
  notification_address_same: boolean;
  notification_address_line1: string;
  notification_address_line2: string;
  notification_postal_code: string;
  notification_city: string;
  notification_province: string;
  notification_country: string;
  governance_role: string;
  kyc_status: string;
  evidence_type: string;
  evidence_reference: string;
  evidence_date: string;
  notes: string;
}

const EMPTY: Draft = {
  person_type: "PF",
  full_name: "",
  tax_id: "",
  email: "",
  denomination: "",
  document_type: "DNI",
  document_country: "ES",
  nationality: "ES",
  birth_date: "",
  birth_place: "",
  legal_form: "",
  jurisdiction: "ES",
  registry_name: "",
  registry_number: "",
  lei_code: "",
  phone: "",
  secondary_email: "",
  preferred_language: "es",
  address_line1: "",
  address_line2: "",
  postal_code: "",
  city: "",
  province: "",
  country: "ES",
  notification_address_same: true,
  notification_address_line1: "",
  notification_address_line2: "",
  notification_postal_code: "",
  notification_city: "",
  notification_province: "",
  notification_country: "ES",
  governance_role: "OTRO",
  kyc_status: "PENDIENTE",
  evidence_type: "",
  evidence_reference: "",
  evidence_date: "",
  notes: "",
};

const STEPS = ["Tipo", "Identidad", "Contacto", "Registro", "Gobierno", "Confirmar"];

const GOVERNANCE_ROLES = [
  ["SOCIO", "Socio"],
  ["CONSEJERO", "Consejero"],
  ["ADMINISTRADOR", "Administrador"],
  ["REPRESENTANTE", "Representante"],
  ["APODERADO", "Apoderado"],
  ["DIRECTIVO", "Directivo"],
  ["OTRO", "Otro"],
] as const;

const KYC_STATUS = [
  ["PENDIENTE", "Pendiente"],
  ["VERIFICADO", "Verificado"],
  ["NO_APLICA", "No aplica"],
  ["RECHAZADO", "Rechazado"],
] as const;

const DOCUMENT_TYPES_PF = [
  ["DNI", "DNI"],
  ["NIE", "NIE"],
  ["PASAPORTE", "Pasaporte"],
  ["TAX_ID_EXTRANJERO", "Tax ID extranjero"],
  ["OTRO", "Otro"],
] as const;

const DOCUMENT_TYPES_PJ = [
  ["CIF", "CIF"],
  ["NIF", "NIF"],
  ["TAX_ID_EXTRANJERO", "Tax ID extranjero"],
  ["OTRO", "Otro"],
] as const;

function trimOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validationIssues(draft: Draft, taxIdConflict: TaxIdConflict, includeAll: boolean) {
  const issuesByStep = new Map<number, string[]>();
  const add = (step: number, message: string) => {
    const current = issuesByStep.get(step) ?? [];
    current.push(message);
    issuesByStep.set(step, current);
  };

  if (!draft.person_type) add(0, "Selecciona PF o PJ.");

  if (!draft.full_name.trim()) {
    add(1, draft.person_type === "PJ" ? "La denominación legal es obligatoria." : "El nombre completo es obligatorio.");
  }
  if (!draft.tax_id.trim()) add(1, "El NIF/CIF es obligatorio.");
  if (!draft.document_type) add(1, "El tipo de documento es obligatorio.");
  if (!draft.document_country.trim()) add(1, "El país emisor del documento es obligatorio.");
  if (taxIdConflict?.kind === "entity") add(1, "El NIF/CIF ya corresponde a una sociedad gestionada.");
  if (taxIdConflict?.kind === "person") add(1, "Ya existe una persona con este NIF/CIF.");

  if (!draft.email.trim()) add(2, "El email principal es obligatorio.");
  if (!draft.phone.trim()) add(2, "El teléfono es obligatorio.");
  if (!draft.address_line1.trim()) add(2, "El domicilio es obligatorio.");
  if (!draft.postal_code.trim()) add(2, "El código postal es obligatorio.");
  if (!draft.city.trim()) add(2, "La localidad es obligatoria.");
  if (!draft.country.trim()) add(2, "El país del domicilio es obligatorio.");
  if (!draft.notification_address_same) {
    if (!draft.notification_address_line1.trim()) add(2, "El domicilio de notificaciones es obligatorio.");
    if (!draft.notification_postal_code.trim()) add(2, "El código postal de notificaciones es obligatorio.");
    if (!draft.notification_city.trim()) add(2, "La localidad de notificaciones es obligatoria.");
    if (!draft.notification_country.trim()) add(2, "El país de notificaciones es obligatorio.");
  }

  if (draft.person_type === "PF") {
    if (!draft.nationality.trim()) add(3, "La nacionalidad es obligatoria.");
    if (!draft.birth_date.trim()) add(3, "La fecha de nacimiento es obligatoria.");
  } else {
    if (!draft.legal_form.trim()) add(3, "La forma jurídica es obligatoria.");
    if (!draft.jurisdiction.trim()) add(3, "La jurisdicción es obligatoria.");
    if (!draft.registry_name.trim()) add(3, "El registro es obligatorio.");
    if (!draft.registry_number.trim()) add(3, "La hoja o número registral es obligatorio.");
  }

  if (!draft.governance_role.trim()) add(4, "El perfil societario es obligatorio.");
  if (!draft.kyc_status.trim()) add(4, "El estado KYC es obligatorio.");
  if (!draft.evidence_type.trim()) add(4, "El tipo de evidencia de alta es obligatorio.");
  if (!draft.evidence_reference.trim()) add(4, "La referencia de evidencia es obligatoria.");

  if (includeAll) {
    return Array.from(issuesByStep.values()).flat();
  }
  return issuesByStep;
}

export default function PersonaNuevaStepper() {
  const navigate = useNavigate();
  const { tenantId } = useTenantContext();
  const createPersona = useCreatePersonaCompleta();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
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
        if ((err as { name?: string })?.name !== "AbortError") setTaxIdConflict(null);
      } finally {
        setCheckingTaxId(false);
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [draft.tax_id, tenantId]);

  const issuesByStep = useMemo(
    () => validationIssues(draft, taxIdConflict, false) as Map<number, string[]>,
    [draft, taxIdConflict],
  );
  const currentIssues = issuesByStep.get(step) ?? [];
  const allIssues = useMemo(
    () => validationIssues(draft, taxIdConflict, true) as string[],
    [draft, taxIdConflict],
  );
  const canNext = currentIssues.length === 0 && !checkingTaxId;
  const isLastStep = step === STEPS.length - 1;

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const selectPersonType = (personType: PersonType) => {
    setDraft((current) => ({
      ...current,
      person_type: personType,
      document_type: personType === "PJ" ? "CIF" : "DNI",
      legal_form: personType === "PJ" ? current.legal_form : "",
      denomination: personType === "PJ" ? current.denomination : "",
    }));
  };

  async function guardar() {
    if (allIssues.length > 0 || checkingTaxId) {
      toast.error("Completa los campos obligatorios antes de crear la persona.");
      return;
    }

    const input: PersonaCompletaInput = {
      person_type: draft.person_type,
      full_name: draft.full_name,
      tax_id: draft.tax_id,
      email: trimOrNull(draft.email),
      denomination: draft.person_type === "PJ" ? trimOrNull(draft.denomination) : null,
      profile: {
        document_type: draft.document_type,
        document_country: draft.document_country,
        nationality: trimOrNull(draft.nationality),
        birth_date: trimOrNull(draft.birth_date),
        birth_place: trimOrNull(draft.birth_place),
        legal_form: trimOrNull(draft.legal_form),
        jurisdiction: trimOrNull(draft.jurisdiction),
        registry_name: trimOrNull(draft.registry_name),
        registry_number: trimOrNull(draft.registry_number),
        lei_code: trimOrNull(draft.lei_code),
        phone: trimOrNull(draft.phone),
        secondary_email: trimOrNull(draft.secondary_email),
        preferred_language: draft.preferred_language,
        address_line1: trimOrNull(draft.address_line1),
        address_line2: trimOrNull(draft.address_line2),
        postal_code: trimOrNull(draft.postal_code),
        city: trimOrNull(draft.city),
        province: trimOrNull(draft.province),
        country: draft.country,
        notification_address_same: draft.notification_address_same,
        notification_address_line1: trimOrNull(draft.notification_address_line1),
        notification_address_line2: trimOrNull(draft.notification_address_line2),
        notification_postal_code: trimOrNull(draft.notification_postal_code),
        notification_city: trimOrNull(draft.notification_city),
        notification_province: trimOrNull(draft.notification_province),
        notification_country: trimOrNull(draft.notification_country),
        governance_role: draft.governance_role,
        kyc_status: draft.kyc_status,
        onboarding_status: "COMPLETO",
        notes: trimOrNull(draft.notes),
      },
      evidence_summary: {
        type: draft.evidence_type.trim(),
        reference: draft.evidence_reference.trim(),
        date: trimOrNull(draft.evidence_date),
      },
    };

    try {
      const result = await createPersona.mutateAsync(input);
      toast.success("Persona creada con alta completa");
      navigate(`/secretaria/personas/${result.person_id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo crear la persona: " + msg);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] p-6">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigate("/secretaria/personas")}
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" aria-hidden="true" /> Personas
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Secretaría · Alta integral
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Alta completa de persona
          </h1>
        </div>
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-3 text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          {draft.person_type === "PF"
            ? "Persona física con identidad, contacto, domicilio, perfil societario y evidencia de alta."
            : "Persona jurídica externa o contraparte; las sociedades gestionadas se crean desde Nueva sociedad."}
        </div>
      </div>

      <ol className="mb-6 grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        {STEPS.map((label, index) => {
          const active = index === step;
          const done = index < step;
          const hasIssues = (issuesByStep.get(index) ?? []).length > 0;
          return (
            <li
              key={label}
              className={cn(
                "flex min-h-10 items-center gap-2 border px-3 py-2",
                active
                  ? "border-[var(--g-brand-3308)] bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                  : done && !hasIssues
                    ? "border-[var(--g-sec-100)] bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                    : hasIssues
                      ? "border-[var(--status-warning)] bg-[var(--status-warning)]/10 text-[var(--g-text-primary)]"
                      : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)]",
              )}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {done && !hasIssues ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              <span>{index + 1}. {label}</span>
            </li>
          );
        })}
      </ol>

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {currentIssues.length > 0 ? (
          <IssueBanner issues={currentIssues} />
        ) : null}

        {step === 0 ? (
          <StepTipo draft={draft} onSelect={selectPersonType} />
        ) : null}
        {step === 1 ? (
          <StepIdentidad
            draft={draft}
            update={update}
            taxIdConflict={taxIdConflict}
            checkingTaxId={checkingTaxId}
          />
        ) : null}
        {step === 2 ? (
          <StepContacto draft={draft} update={update} />
        ) : null}
        {step === 3 ? (
          <StepRegistro draft={draft} update={update} />
        ) : null}
        {step === 4 ? (
          <StepGobierno draft={draft} update={update} />
        ) : null}
        {step === 5 ? (
          <StepConfirmar draft={draft} issues={allIssues} />
        ) : null}
      </section>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(current - 1, 0))}
          disabled={step === 0}
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Atrás
        </button>
        {isLastStep ? (
          <button
            type="button"
            onClick={guardar}
            disabled={createPersona.isPending || allIssues.length > 0 || checkingTaxId}
            aria-busy={createPersona.isPending}
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            {createPersona.isPending ? "Creando…" : "Crear persona completa"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => canNext && setStep((current) => Math.min(current + 1, STEPS.length - 1))}
            disabled={!canNext}
            className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
}

function StepTipo({ draft, onSelect }: { draft: Draft; onSelect: (type: PersonType) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(["PF", "PJ"] as PersonType[]).map((type) => {
        const selected = draft.person_type === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className={cn(
              "border p-5 text-left transition-colors",
              selected
                ? "border-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)]"
                : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] hover:bg-[var(--g-surface-subtle)]/60",
            )}
            style={{ borderRadius: "var(--g-radius-lg)" }}
            aria-pressed={selected}
          >
            <span className="text-base font-semibold text-[var(--g-text-primary)]">
              {type === "PF" ? "Persona física" : "Persona jurídica"}
            </span>
            <span className="mt-2 block text-sm text-[var(--g-text-secondary)]">
              {type === "PF"
                ? "Consejeros, socios, representantes, apoderados, directivos o firmantes."
                : "Sociedades o entidades externas; si es sociedad gestionada, usa el alta de sociedad."}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StepIdentidad({
  draft,
  update,
  taxIdConflict,
  checkingTaxId,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  taxIdConflict: TaxIdConflict;
  checkingTaxId: boolean;
}) {
  const documentOptions = draft.person_type === "PJ" ? DOCUMENT_TYPES_PJ : DOCUMENT_TYPES_PF;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput
        label={draft.person_type === "PF" ? "Nombre completo *" : "Denominación legal *"}
        value={draft.full_name}
        onChange={(event) => update("full_name", event.target.value)}
        placeholder={draft.person_type === "PF" ? "Lucía Martín García" : "ARGA Servicios Externos, S.L."}
        required
      />
      <div className="flex flex-col gap-1">
        <TextInput
          label={draft.person_type === "PF" ? "DNI/NIE/Pasaporte *" : "CIF/NIF *"}
          value={draft.tax_id}
          onChange={(event) => update("tax_id", event.target.value)}
          placeholder={draft.person_type === "PF" ? "00000000-A" : "B-99999999"}
          required
        />
        {checkingTaxId ? (
          <span className="text-[11px] text-[var(--g-text-secondary)]">Comprobando disponibilidad…</span>
        ) : null}
        {!checkingTaxId && taxIdConflict ? (
          <TaxConflictNotice conflict={taxIdConflict} />
        ) : null}
      </div>
      <SelectField
        label="Tipo de documento *"
        value={draft.document_type}
        onChange={(value) => update("document_type", value)}
        options={documentOptions}
      />
      <TextInput
        label="País emisor *"
        value={draft.document_country}
        onChange={(event) => update("document_country", event.target.value.toUpperCase())}
        placeholder="ES"
        required
      />
      {draft.person_type === "PJ" ? (
        <TextInput
          label="Denominación comercial"
          value={draft.denomination}
          onChange={(event) => update("denomination", event.target.value)}
          placeholder="ARGA Servicios"
        />
      ) : null}
    </div>
  );
}

function StepContacto({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          label="Email principal *"
          type="email"
          value={draft.email}
          onChange={(event) => update("email", event.target.value)}
          placeholder="persona@arga-seguros.com"
          required
        />
        <TextInput
          label="Teléfono *"
          value={draft.phone}
          onChange={(event) => update("phone", event.target.value)}
          placeholder="+34 600 000 000"
          required
        />
        <TextInput
          label="Email alternativo"
          type="email"
          value={draft.secondary_email}
          onChange={(event) => update("secondary_email", event.target.value)}
          placeholder="contacto.secundario@arga-seguros.com"
        />
        <TextInput
          label="Domicilio *"
          value={draft.address_line1}
          onChange={(event) => update("address_line1", event.target.value)}
          placeholder="Paseo de la Castellana 00"
          required
        />
        <TextInput
          label="Domicilio, línea 2"
          value={draft.address_line2}
          onChange={(event) => update("address_line2", event.target.value)}
          placeholder="Planta, puerta, edificio"
        />
        <TextInput
          label="Código postal *"
          value={draft.postal_code}
          onChange={(event) => update("postal_code", event.target.value)}
          required
        />
        <TextInput
          label="Localidad *"
          value={draft.city}
          onChange={(event) => update("city", event.target.value)}
          required
        />
        <TextInput
          label="Provincia"
          value={draft.province}
          onChange={(event) => update("province", event.target.value)}
        />
        <TextInput
          label="País *"
          value={draft.country}
          onChange={(event) => update("country", event.target.value.toUpperCase())}
          placeholder="ES"
          required
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--g-text-primary)]">
        <input
          type="checkbox"
          checked={draft.notification_address_same}
          onChange={(event) => update("notification_address_same", event.target.checked)}
          className="h-4 w-4 accent-[var(--g-brand-3308)]"
        />
        El domicilio de notificaciones coincide con el domicilio principal.
      </label>

      {!draft.notification_address_same ? (
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Domicilio notificaciones *"
            value={draft.notification_address_line1}
            onChange={(event) => update("notification_address_line1", event.target.value)}
            required
          />
          <TextInput
            label="Domicilio notificaciones, línea 2"
            value={draft.notification_address_line2}
            onChange={(event) => update("notification_address_line2", event.target.value)}
          />
          <TextInput
            label="CP notificaciones *"
            value={draft.notification_postal_code}
            onChange={(event) => update("notification_postal_code", event.target.value)}
            required
          />
          <TextInput
            label="Localidad notificaciones *"
            value={draft.notification_city}
            onChange={(event) => update("notification_city", event.target.value)}
            required
          />
          <TextInput
            label="Provincia notificaciones"
            value={draft.notification_province}
            onChange={(event) => update("notification_province", event.target.value)}
          />
          <TextInput
            label="País notificaciones *"
            value={draft.notification_country}
            onChange={(event) => update("notification_country", event.target.value.toUpperCase())}
            required
          />
        </div>
      ) : null}
    </div>
  );
}

function StepRegistro({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  if (draft.person_type === "PF") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          label="Nacionalidad *"
          value={draft.nationality}
          onChange={(event) => update("nationality", event.target.value.toUpperCase())}
          placeholder="ES"
          required
        />
        <TextInput
          label="Fecha de nacimiento *"
          type="date"
          value={draft.birth_date}
          onChange={(event) => update("birth_date", event.target.value)}
          required
        />
        <TextInput
          label="Lugar de nacimiento"
          value={draft.birth_place}
          onChange={(event) => update("birth_place", event.target.value)}
        />
        <TextInput
          label="Idioma preferente"
          value={draft.preferred_language}
          onChange={(event) => update("preferred_language", event.target.value.toLowerCase())}
          placeholder="es"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput
        label="Forma jurídica *"
        value={draft.legal_form}
        onChange={(event) => update("legal_form", event.target.value)}
        placeholder="S.L., S.A., Fundación..."
        required
      />
      <TextInput
        label="Jurisdicción *"
        value={draft.jurisdiction}
        onChange={(event) => update("jurisdiction", event.target.value.toUpperCase())}
        placeholder="ES"
        required
      />
      <TextInput
        label="Registro *"
        value={draft.registry_name}
        onChange={(event) => update("registry_name", event.target.value)}
        placeholder="Registro Mercantil de Madrid"
        required
      />
      <TextInput
        label="Hoja / número registral *"
        value={draft.registry_number}
        onChange={(event) => update("registry_number", event.target.value)}
        placeholder="M-000000"
        required
      />
      <TextInput
        label="LEI"
        value={draft.lei_code}
        onChange={(event) => update("lei_code", event.target.value.toUpperCase())}
        placeholder="959800..."
      />
      <TextInput
        label="Idioma preferente"
        value={draft.preferred_language}
        onChange={(event) => update("preferred_language", event.target.value.toLowerCase())}
        placeholder="es"
      />
    </div>
  );
}

function StepGobierno({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SelectField
        label="Perfil societario *"
        value={draft.governance_role}
        onChange={(value) => update("governance_role", value)}
        options={GOVERNANCE_ROLES}
      />
      <SelectField
        label="Estado KYC *"
        value={draft.kyc_status}
        onChange={(value) => update("kyc_status", value)}
        options={KYC_STATUS}
      />
      <TextInput
        label="Tipo de evidencia de alta *"
        value={draft.evidence_type}
        onChange={(event) => update("evidence_type", event.target.value)}
        placeholder="DNI, escritura, certificación, poder..."
        required
      />
      <TextInput
        label="Referencia de evidencia *"
        value={draft.evidence_reference}
        onChange={(event) => update("evidence_reference", event.target.value)}
        placeholder="Nº protocolo, archivo, expediente..."
        required
      />
      <TextInput
        label="Fecha de evidencia"
        type="date"
        value={draft.evidence_date}
        onChange={(event) => update("evidence_date", event.target.value)}
      />
      <TextArea
        label="Notas de Secretaría"
        value={draft.notes}
        onChange={(event) => update("notes", event.target.value)}
        placeholder="Observaciones operativas, fuente de la información o pendiente de regularización."
      />
    </div>
  );
}

function StepConfirmar({ draft, issues }: { draft: Draft; issues: string[] }) {
  return (
    <div className="space-y-5">
      {issues.length > 0 ? <IssueBanner issues={issues} /> : null}
      <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Tipo" value={draft.person_type === "PF" ? "Persona física" : "Persona jurídica"} />
        <Field label="Nombre / denominación" value={draft.full_name} />
        <Field label="NIF/CIF" value={draft.tax_id} />
        <Field label="Documento" value={`${draft.document_type} · ${draft.document_country}`} />
        <Field label="Email" value={draft.email} />
        <Field label="Teléfono" value={draft.phone} />
        <Field label="Domicilio" value={`${draft.address_line1}, ${draft.postal_code} ${draft.city}`} />
        <Field label="Perfil" value={draft.governance_role} />
        <Field label="KYC" value={draft.kyc_status} />
        <Field label="Evidencia" value={`${draft.evidence_type} · ${draft.evidence_reference}`} />
        {draft.person_type === "PF" ? (
          <>
            <Field label="Nacionalidad" value={draft.nationality} />
            <Field label="Fecha nacimiento" value={draft.birth_date} />
          </>
        ) : (
          <>
            <Field label="Forma jurídica" value={draft.legal_form} />
            <Field label="Registro" value={`${draft.registry_name} · ${draft.registry_number}`} />
          </>
        )}
      </dl>
    </div>
  );
}

function TaxConflictNotice({ conflict }: { conflict: NonNullable<TaxIdConflict> }) {
  if (conflict.kind === "entity") {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="flex items-start gap-2 border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 p-2 text-xs text-[var(--g-text-primary)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-error)]" aria-hidden="true" />
        <span>
          Este NIF ya corresponde a la sociedad <strong>{conflict.entity_name}</strong>.{" "}
          <Link to={`/secretaria/sociedades/${conflict.entity_id}`} className="text-[var(--g-brand-3308)] underline">
            Abrir sociedad
          </Link>
        </span>
      </div>
    );
  }
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-2 border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 p-2 text-xs text-[var(--g-text-primary)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-error)]" aria-hidden="true" />
      <span>
        Ya existe una persona con este NIF/CIF: <strong>{conflict.person_name}</strong>.{" "}
        <Link to={`/secretaria/personas/${conflict.person_id}`} className="text-[var(--g-brand-3308)] underline">
          Abrir ficha
        </Link>
      </span>
    </div>
  );
}

function IssueBanner({ issues }: { issues: string[] }) {
  return (
    <div
      role="alert"
      className="mb-5 border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 p-3 text-sm text-[var(--g-text-primary)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="mb-1 font-semibold">Pendiente de completar</div>
      <ul className="space-y-1">
        {issues.map((issue) => (
          <li key={issue}>· {issue}</li>
        ))}
      </ul>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string }>(
  ({ label, className, ...props }, ref) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        {label}
      </span>
      <input
        ref={ref}
        className={cn(
          "border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20",
          className,
        )}
        style={{ borderRadius: "var(--g-radius-md)" }}
        {...props}
      />
    </label>
  ),
);
TextInput.displayName = "TextInput";

const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }>(
  ({ label, className, ...props }, ref) => (
    <label className="flex flex-col gap-1 md:col-span-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        {label}
      </span>
      <textarea
        ref={ref}
        rows={4}
        className={cn(
          "border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20",
          className,
        )}
        style={{ borderRadius: "var(--g-radius-md)" }}
        {...props}
      />
    </label>
  ),
);
TextArea.displayName = "TextArea";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--g-text-primary)]">{value || "—"}</dd>
    </div>
  );
}
