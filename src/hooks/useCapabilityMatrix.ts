import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Capability =
  | "SNAPSHOT_CREATION"
  | "VOTE_EMISSION"
  | "CERTIFICATION"
  // AIMS (F2.T5/T6, migración 20260927132000): 9 capacidades sembradas por
  // rol en `capability_matrix`. SECRETARIO las tiene todas salvo GOBIERNO;
  // COMPLIANCE y ADMIN_TENANT las 9; CONSEJERO y AUDITOR ninguna.
  | "AIMS_INVENTARIO"
  | "AIMS_CLASIFICAR"
  | "AIMS_EVALUAR"
  | "AIMS_REVISAR"
  | "AIMS_OBLIGACIONES"
  | "AIMS_ENTREGABLE_APROBAR"
  | "AIMS_INCIDENTE"
  | "AIMS_REGISTRO"
  | "AIMS_GOBIERNO";

export interface CapabilityRow {
  id: string;
  role: string;
  action: Capability;
  enabled: boolean;
  reason: string | null;
  created_at: string;
}

/**
 * NO lleva `tenantId` en la queryKey, y es correcto: `capability_matrix` no
 * tiene columna `tenant_id` en Cloud (verificado 2026-09-05: columnas
 * id, role, action, enabled, reason, created_at; 40 filas). Es una matriz
 * global del producto —qué puede hacer cada ROL—, no dato de tenant, así que
 * añadir el tenant a la clave solo multiplicaría entradas de caché idénticas.
 * Si algún día gana `tenant_id`, esta clave tiene que cambiar con él.
 */
export function useCapabilityMatrix() {
  return useQuery({
    queryKey: ["capability_matrix", "all"],
    staleTime: 5 * 60 * 1000, // 5 min — estable en runtime
    queryFn: async (): Promise<CapabilityRow[]> => {
      const { data, error } = await supabase
        .from("capability_matrix")
        .select("*")
        .order("role", { ascending: true })
        .order("action", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CapabilityRow[];
    },
  });
}

/**
 * Devuelve true si el rol tiene la capacidad pedida según la matriz.
 * Usa resultado cacheado — no hace fetch adicional.
 */
export function useHasCapability(role: string | undefined, action: Capability) {
  const { data } = useCapabilityMatrix();
  if (!role || !data) return false;
  const row = data.find((r) => r.role === role && r.action === action);
  return row?.enabled ?? false;
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  SNAPSHOT_CREATION: "Creación de censo",
  VOTE_EMISSION: "Emisión de voto",
  CERTIFICATION: "Certificación",
  AIMS_INVENTARIO: "Alta de sistemas IA",
  AIMS_CLASIFICAR: "Clasificación guiada",
  AIMS_EVALUAR: "Autodiagnóstico de conformidad",
  AIMS_REVISAR: "Revisión a cuatro ojos",
  AIMS_OBLIGACIONES: "Obligaciones AIMS",
  AIMS_ENTREGABLE_APROBAR: "Aprobación de entregables",
  AIMS_INCIDENTE: "Incidentes IA",
  AIMS_REGISTRO: "Registro AIMS",
  AIMS_GOBIERNO: "Gobierno de AIMS",
};

/** Aviso homogéneo cuando el rol puede leer pero no ejecutar la acción
 * (mismo texto que `DocumentosPendientesRevision.tsx` en Secretaría). */
export const SIN_CAPACIDAD_AVISO =
  "Tu rol puede consultar esta información, pero no ejecutar esta acción.";
