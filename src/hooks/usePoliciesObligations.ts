import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface PolicyRow {
  id: string;
  policy_code: string;
  title: string;
  policy_type: string | null;
  normative_tier: string | null;
  scope_level: string | null;
  owner_function: string | null;
  approval_body_id: string | null;
  // G4: FK real al comité responsable. `owner_function` es texto libre y
  // coincide con el nombre del comité solo porque el seed escribió los dos
  // campos; la navegación política → comité → personas exige la FK.
  // NULL en las 25 filas de ARGA (columna nunca sembrada para ese tenant).
  owner_body_id?: string | null;
  status: string;
  effective_date: string | null;
  next_review_date: string | null;
  current_version: number | null;
  // G4 Task 1/3: apartado "Objeto" y índice del documento fuente. NULL/[] en
  // las 3 filas Garrigues citadas-no-incorporadas (PPD-01/02/CAT); siempre
  // NULL en ARGA (columna nunca sembrada para ese tenant).
  summary?: string | null;
  content_outline?: string[] | null;
  // Procedencia del dato — mismo patrón que entities.data_provenance (G1),
  // pero forma distinta ({origen, fuente, ownership_acreditado}). NULL en
  // ARGA = sin badge (ver PoliticaDetalle.tsx).
  data_provenance?: unknown;
}

export interface PolicyWithBody extends PolicyRow {
  approval_body_name: string | null;
  // El detalle de órgano resuelve por slug (`/organos/:slug`, useBodyBySlug),
  // no por UUID: sin slug no hay enlace, solo texto.
  owner_body_name: string | null;
  owner_body_slug: string | null;
}

export interface ObligationRow {
  id: string;
  code: string;
  title: string;
  source: string | null;
  criticality: string | null;
  policy_id: string | null;
  country_scope: string[] | null;
  // G4 Task 1/4: artículo concreto de la norma. `source` sigue siendo el
  // marco. NULL en las 5 filas de ARGA (columna nunca sembrada).
  legal_reference?: string | null;
  // G4: comité responsable. 21/21 en Garrigues, NULL en las 5 de ARGA.
  owner_body_id?: string | null;
}

export interface ObligationWithPolicy extends ObligationRow {
  policy_code: string | null;
  policy_title: string | null;
  owner_body_name: string | null;
  owner_body_slug: string | null;
}

export interface ControlRow {
  id: string;
  code: string;
  name: string;
  status: string | null;
  owner_id: string | null;
  obligation_id: string | null;
  last_test_date: string | null;
  next_test_date: string | null;
}

export interface ControlWithOwner extends ControlRow {
  owner_name: string | null;
}

export interface EvidenceRow {
  id: string;
  control_id: string;
  title: string;
  ev_type: string | null;
  status: string | null;
  owner_id: string | null;
  rejection_reason: string | null;
  file_url: string | null;
  legal_hold: boolean | null;
  created_at: string;
}

// ───────── Exclusiones y cautela de firmeza ─────────
// G4 Task 4/7/8: dos filas de obligations son EXCLUSIONES (no sujeción /
// excepción legal), no obligaciones cubiertas. El seed las marca abriendo el
// título por "Exención"/"Excepción" — no hay columna propia. Y embebe la
// cautela de firmeza pendiente del Comité Legal en el propio título, con un
// token de enum interno (DEMO_PILOTO) que no debe llegar a pantalla.
//
// El criterio vive aquí, no en cada página: sobrevivió sin tratamiento en la
// pestaña "Obligaciones" de PoliticaDetalle justamente porque estaba
// duplicado en dos pantallas en vez de compartido.
const EXCLUSION_TITLE_RE = /^(Exención|Excepción)\b/i;
const FIRMEZA_RE = /\s*\(criterio DEMO_PILOTO,\s*([^)]+)\)\s*$/i;

export const isExclusionTitle = (title: string) => EXCLUSION_TITLE_RE.test(title);

export const exclusionKind = (title: string) =>
  EXCLUSION_TITLE_RE.exec(title)?.[1] ?? "Exclusión";

export function splitFirmeza(title: string): { title: string; pending: string | null } {
  const m = FIRMEZA_RE.exec(title);
  if (!m) return { title, pending: null };
  return { title: title.slice(0, m.index).trim(), pending: m[1].trim() };
}

// ───────── Status mapping helpers ─────────

export const policyStatusLabel = (s: string | null | undefined) => {
  switch (s) {
    case "Draft": return "BORRADOR";
    case "In Review": return "EN REVISIÓN";
    case "Legal Review": return "REVISIÓN JURÍDICA";
    case "Approval Pending": return "PENDIENTE APROBACIÓN";
    case "Approved": return "APROBADA";
    case "Published": return "VIGENTE";
    case "Superseded": return "SUSTITUIDA";
    case "Archived": return "ARCHIVADA";
    default: return (s ?? "—").toUpperCase();
  }
};

export const policyStatusToStep = (s: string | null | undefined): number => {
  switch (s) {
    case "Draft": return 1;
    case "In Review": return 2;
    case "Legal Review": return 3;
    case "Approval Pending": return 4;
    case "Approved": return 5;
    case "Published": return 6;
    case "Superseded":
    case "Archived": return 7;
    default: return 1;
  }
};

export const obligationCriticalityTone = (c: string | null | undefined) => {
  switch (c) {
    case "Crítico": return "critical" as const;
    case "Alto": return "warning" as const;
    case "Medio": return "warning" as const;
    case "Bajo": return "neutral" as const;
    default: return "neutral" as const;
  }
};

export const controlStatusLabel = (s: string | null | undefined) => {
  switch (s) {
    case "Efectivo": return "EFECTIVO";
    case "Parcial": return "EN REMEDIACIÓN";
    case "Deficiente": return "DEFICIENTE";
    case "No probado": return "NO PROBADO";
    default: return (s ?? "—").toUpperCase();
  }
};

export const controlStatusTone = (s: string | null | undefined) => {
  switch (s) {
    case "Efectivo": return "active" as const;
    case "Parcial": return "warning" as const;
    case "Deficiente": return "critical" as const;
    case "No probado": return "neutral" as const;
    default: return "neutral" as const;
  }
};

export const evidenceStatusLabel = (s: string | null | undefined) => {
  switch (s) {
    case "Validada": return "VALIDADA";
    case "Rechazada": return "RECHAZADA";
    case "Pendiente": return "PENDIENTE VALIDACIÓN";
    case "Vencida": return "VENCIDA";
    default: return (s ?? "—").toUpperCase();
  }
};

export const evidenceStatusTone = (s: string | null | undefined) => {
  switch (s) {
    case "Validada": return "active" as const;
    case "Rechazada":
    case "Vencida": return "critical" as const;
    case "Pendiente": return "warning" as const;
    default: return "neutral" as const;
  }
};

// ───────── Queries ─────────

type BodyEmbed = { name?: string | null; slug?: string | null } | null;

type PolicyRaw = PolicyRow & {
  approval_body?: { name?: string | null } | null;
  owner_body?: BodyEmbed;
};

const withPolicyBodies = (row: PolicyRaw): PolicyWithBody => ({
  ...row,
  approval_body_name: row.approval_body?.name ?? null,
  owner_body_name: row.owner_body?.name ?? null,
  owner_body_slug: row.owner_body?.slug ?? null,
});

type ObligationRaw = ObligationRow & {
  policy?: { policy_code?: string | null; title?: string | null } | null;
  owner_body?: BodyEmbed;
};

const withObligationRefs = (row: ObligationRaw): ObligationWithPolicy => ({
  ...row,
  policy_code: row.policy?.policy_code ?? null,
  policy_title: row.policy?.title ?? null,
  owner_body_name: row.owner_body?.name ?? null,
  owner_body_slug: row.owner_body?.slug ?? null,
});

export function usePoliciesList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["policies", "list", tenantId],
    // TenantProvider arranca en null y lo resuelve por red: sin este guard la
    // clave de ese primer render es ["policies","list",null] — la MISMA para
    // los dos tenants — y un cambio de sesión dentro de la SPA pinta las
    // políticas del tenant anterior antes del skeleton.
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*, approval_body:approval_body_id(name), owner_body:owner_body_id(name, slug)")
        .order("policy_code");
      if (error) throw error;
      return ((data ?? []) as PolicyRaw[]).map(withPolicyBodies);
    },
  });
}

export function usePolicyByCode(code: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["policies", "byCode", tenantId, code],
    enabled: !!code && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*, approval_body:approval_body_id(name), owner_body:owner_body_id(name, slug)")
        .eq("policy_code", code!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return withPolicyBodies(data as PolicyRaw);
    },
  });
}

export function usePolicyObligations(policyId: string | undefined) {
  return useQuery({
    queryKey: ["obligations", "byPolicy", policyId],
    enabled: !!policyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obligations")
        .select("*")
        .eq("policy_id", policyId!)
        .order("code");
      if (error) throw error;
      return (data ?? []) as ObligationRow[];
    },
  });
}

export function useObligationsList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["obligations", "list", tenantId],
    // Misma fuga de caché que usePoliciesList: ver comentario allí.
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obligations")
        .select("*, policy:policy_id(policy_code, title), owner_body:owner_body_id(name, slug)")
        .order("code");
      if (error) throw error;
      return ((data ?? []) as ObligationRaw[]).map(withObligationRefs);
    },
  });
}

export function useObligationByCode(code: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["obligations", "byCode", tenantId, code],
    enabled: !!code && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obligations")
        .select("*, policy:policy_id(policy_code, title), owner_body:owner_body_id(name, slug)")
        .eq("code", code!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return withObligationRefs(data as ObligationRaw);
    },
  });
}

export function useObligationControls(obligationId: string | undefined) {
  return useQuery({
    queryKey: ["controls", "byObligation", obligationId],
    enabled: !!obligationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controls")
        .select("*, owner:owner_id(full_name)")
        .eq("obligation_id", obligationId!)
        .order("code");
      if (error) throw error;
      type Raw = ControlRow & { owner?: { full_name?: string | null } | null };
      return ((data ?? []) as Raw[]).map((row) => ({
        ...row,
        owner_name: row.owner?.full_name ?? null,
      })) as ControlWithOwner[];
    },
  });
}

export function useAllControlsByObligationIds(obligationIds: string[]) {
  return useQuery({
    queryKey: ["controls", "byObligationIds", obligationIds.sort().join(",")],
    enabled: obligationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controls")
        .select("*, owner:owner_id(full_name)")
        .in("obligation_id", obligationIds);
      if (error) throw error;
      type Raw = ControlRow & { owner?: { full_name?: string | null } | null };
      return ((data ?? []) as Raw[]).map((row) => ({
        ...row,
        owner_name: row.owner?.full_name ?? null,
      })) as ControlWithOwner[];
    },
  });
}

export function useEvidencesByControlIds(controlIds: string[]) {
  return useQuery({
    queryKey: ["evidences", "byControlIds", controlIds.sort().join(",")],
    enabled: controlIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidences")
        .select("*")
        .in("control_id", controlIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EvidenceRow[];
    },
  });
}
