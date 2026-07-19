import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { normalizeMateriaForRulePack } from "@/lib/rules-engine";
import { rulePackOrganoFamily } from "@/lib/secretaria/rule-pack-organo";
import {
  selectRulePackForOrgano,
  type RulePackSelectionReason,
} from "@/lib/secretaria/rule-pack-selection";

export interface PostAcuerdoPayload {
  inscribible: boolean;
  instrumentoRequerido: "ESCRITURA" | "INSTANCIA" | "NINGUNO";
  publicacionRequerida: boolean;
  canalesPublicacion?: string[];
  // ITEM-135: el payload persistido admite la forma escalar (número de días) o
  // la estructurada {dias, fuente, referencia}; la normalización de este hook
  // maneja ambas, así que el tipo las declara en vez de solo `number`.
  plazoInscripcion?: number | { dias: number; fuente?: string; referencia?: string };
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
  /**
   * Por qué se eligió este pack. `FALLBACK_ORGANO_DISTINTO` significa que la
   * regla es de otro órgano que el que adopta el acuerdo — la UI debe
   * advertirlo. Ver `rule-pack-selection`.
   */
  selectionReason?: RulePackSelectionReason | null;
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
// ITEM-133: el desempate por órgano entre packs que comparten materia (p. ej.
// AUTORIZACION_GARANTIA tiene uno de Junta y otro de Consejo) vive ahora en
// `rule-pack-organo` (criterio) y `rule-pack-selection` (elección), compartidos
// y con tests. La versión anterior comparaba por substring, no reconocía
// SOCIO_UNICO ni COMISION_DELEGADA, y no la cubría ningún test.
export function useRulePackForMateria(materiaInput: string | undefined, organoTipo?: string | null) {
  const { tenantId } = useTenantContext();
  // ITEM-006: el catálogo UI y los packs sembrados divergen en grafías —
  // normalizamos al id canónico del pack antes de consultar Cloud.
  const materiaCla = materiaInput ? normalizeMateriaForRulePack(materiaInput) : materiaInput;
  const organo = rulePackOrganoFamily(organoTipo);
  return useQuery<RulePackData | null, Error>({
    enabled: !!materiaCla && !!tenantId,
    queryKey: ["rule_packs", tenantId, "byMateria", materiaCla, organo ?? "any"],
    queryFn: async () => {
      if (!materiaCla) return null;

      // ITEM-133: sin filtrar órgano ni ordenar, dos packs activos de la misma
      // materia (Junta vs Consejo) hacían que limit(1) devolviera uno arbitrario.
      // Se traen todos los packs activos de la materia con orden determinista y se
      // prefiere el del órgano del acuerdo cuando se conoce; si no hay match de
      // órgano, se cae al primero determinista (compatibilidad legacy).
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
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as unknown as RulePackWithVersions[];
      const selection = selectRulePackForOrgano(rows, organoTipo);
      const first = selection.pack;
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
        // Motivo de la elección: permite a la UI advertir de que la regla
        // servida no es la del órgano que adopta el acuerdo. No bloquea nada.
        selectionReason: selection.reason,
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
