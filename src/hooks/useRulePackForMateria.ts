import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface PostAcuerdoPayload {
  inscribible: boolean;
  instrumentoRequerido: "ESCRITURA" | "INSTANCIA" | "NINGUNO";
  publicacionRequerida: boolean;
  canalesPublicacion?: string[];
  plazoInscripcion?: number;
  notas?: string;
  [key: string]: unknown;
}

export interface RulePackVersionRow {
  id: string;
  pack_id: string;
  rule_pack_id: string;
  version: string;
  version_number: number;
  is_active: boolean;
  payload: unknown;
  created_at: string;
}

export interface RulePackRow {
  id: string;
  tenant_id: string;
  materia: string;
  materia_clase: string;
  nombre: string;
  descripcion?: string | null;
  organo_tipo?: string | null;
  created_at: string;
}

type RawRulePackVersionRow = {
  id: string;
  pack_id: string;
  version: string;
  is_active: boolean | null;
  payload: unknown;
  created_at: string | null;
};

type RulePackWithVersions = {
  id: string;
  tenant_id: string;
  materia: string;
  organo_tipo?: string | null;
  descripcion?: string | null;
  created_at: string | null;
  rule_pack_versions?: RawRulePackVersionRow[] | null;
};

export interface RulePackData {
  pack: RulePackRow;
  version: RulePackVersionRow;
  payload: PostAcuerdoPayload;
}

/**
 * useRulePackForMateria — legacy adapter for Tramitador.
 *
 * The current schema stores rule packs as rule_packs.materia +
 * rule_pack_versions.pack_id/version/payload. This hook keeps the old
 * Tramitador contract, but normalizes the actual rule payload from
 * payload.postAcuerdo when present.
 *
 * Usage:
 *   const { data, isLoading, error } = useRulePackForMateria("APROBACION_CUENTAS");
 *   if (data) {
 *     const { inscribible, instrumentoRequerido } = data.payload;
 *   }
 */
export function useRulePackForMateria(materiaCla: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery<RulePackData | null, Error>({
    enabled: !!materiaCla && !!tenantId,
    queryKey: ["rule_packs", tenantId, "byMateria", materiaCla],
    queryFn: async () => {
      if (!materiaCla) return null;

      const { data, error } = await supabase
        .from("rule_packs")
        .select(
          `
          id,
          tenant_id,
          materia,
          organo_tipo,
          descripcion,
          created_at,
          rule_pack_versions!inner (
            id,
            pack_id,
            version,
            is_active,
            payload,
            created_at
          )
        `
        )
        .eq("tenant_id", tenantId!)
        .eq("materia", materiaCla)
        .eq("rule_pack_versions.is_active", true)
        .limit(1);

      if (error) throw error;

      const first = ((data ?? []) as unknown as RulePackWithVersions[])[0];
      if (!first) return null;

      const versions = first.rule_pack_versions ?? [];
      const version = versions[0];

      if (!version || !version.payload) return null;

      const pack: RulePackRow = {
        id: first.id,
        tenant_id: first.tenant_id,
        materia: first.materia,
        materia_clase: first.materia,
        nombre: first.descripcion ?? first.materia,
        descripcion: first.descripcion,
        organo_tipo: first.organo_tipo,
        created_at: first.created_at ?? "",
      };

      return {
        pack,
        version: {
          id: version.id,
          pack_id: version.pack_id,
          rule_pack_id: version.pack_id,
          version: version.version,
          version_number: Number.parseInt(version.version, 10) || 1,
          is_active: Boolean(version.is_active),
          payload: version.payload,
          created_at: version.created_at ?? "",
        },
        payload: normalizePostAcuerdoPayload(version.payload),
      };
    },
  });
}

function normalizePostAcuerdoPayload(rawPayload: unknown): PostAcuerdoPayload {
  const root = asRecord(rawPayload);
  const post = asRecord(root.postAcuerdo) ?? root;
  const instrumento = normalizeInstrumento(post.instrumentoRequerido);
  const plazo = asNumber(post.plazoInscripcion) ?? asNumber(post.plazoInscripcionDias);
  const canales = Array.isArray(post.canalesPublicacion)
    ? post.canalesPublicacion.filter((canal): canal is string => typeof canal === "string")
    : undefined;

  return {
    ...root,
    ...post,
    inscribible: Boolean(post.inscribible),
    instrumentoRequerido: instrumento,
    publicacionRequerida: Boolean(post.publicacionRequerida),
    canalesPublicacion: canales,
    plazoInscripcion: plazo,
    notas: typeof post.notas === "string" ? post.notas : typeof post.nota === "string" ? post.nota : undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeInstrumento(value: unknown): PostAcuerdoPayload["instrumentoRequerido"] {
  if (value === "ESCRITURA" || value === "INSTANCIA" || value === "NINGUNO") return value;
  return "NINGUNO";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
