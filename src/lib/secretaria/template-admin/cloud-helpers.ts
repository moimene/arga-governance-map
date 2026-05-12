/**
 * Helpers read-only que consultan Cloud para la consola del Gestor.
 * Sprint 1 — usados por DashboardTab, ValidacionTab y tests de schema.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PlantillaCandidate } from "./types";
import { CORE_V1_MATERIAS } from "./functional-key";
import {
  buildFunctionalKey,
  serializeFunctionalKey,
} from "./functional-key";

export async function loadAllActiveTemplates(tenantId: string): Promise<PlantillaCandidate[]> {
  const { data, error } = await supabase
    .from("plantillas_protegidas")
    .select(
      "id, tipo, materia, materia_acuerdo, jurisdiccion, version, estado, organo_tipo, adoption_mode, aprobada_por, fecha_aprobacion, referencia_legal, capa1_inmutable, capa2_variables, capa3_editables",
    )
    .eq("tenant_id", tenantId)
    .eq("estado", "ACTIVA");
  if (error) throw error;
  return (data ?? []) as PlantillaCandidate[];
}

export async function computeCoreCoverage(tenantId: string): Promise<{
  covered: number;
  gaps: Array<{ organo: string; materia: string }>;
}> {
  const active = await loadAllActiveTemplates(tenantId);
  const gaps: Array<{ organo: string; materia: string }> = [];
  let covered = 0;
  for (const target of CORE_V1_MATERIAS) {
    const found = active.some(
      (t) =>
        t.tipo === "MODELO_ACUERDO" &&
        t.organo_tipo === target.organo &&
        (t.materia === target.materia || t.materia_acuerdo === target.materia),
    );
    if (found) covered += 1;
    else gaps.push(target);
  }
  return { covered, gaps };
}

export async function detectAllActiveDuplicates(tenantId: string): Promise<
  Array<{ key: string; ids: string[] }>
> {
  const active = await loadAllActiveTemplates(tenantId);
  const groups = new Map<string, string[]>();
  for (const t of active) {
    const key = serializeFunctionalKey(buildFunctionalKey(t, tenantId));
    const prev = groups.get(key) ?? [];
    prev.push(t.id);
    groups.set(key, prev);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));
}

export async function countOrphanTemplates(tenantId: string): Promise<number> {
  const { data: plantillas, error: e1 } = await supabase
    .from("plantillas_protegidas")
    .select("id")
    .eq("tenant_id", tenantId);
  if (e1) throw e1;
  const { data: changelog, error: e2 } = await supabase
    .from("plantilla_changelog")
    .select("plantilla_id")
    .eq("tenant_id", tenantId);
  if (e2) throw e2;
  const withLog = new Set((changelog ?? []).map((c) => c.plantilla_id as string));
  return (plantillas ?? []).filter((p) => !withLog.has(p.id)).length;
}
