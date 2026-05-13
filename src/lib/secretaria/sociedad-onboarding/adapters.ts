import { supabase } from "@/integrations/supabase/client";
import type { AdapterContext, CargoInputDraft, PersonaDraft } from "./types";

export interface PersistCargosResult {
  okCount: number;
  failedCargos: Array<{ cargo: CargoInputDraft; error: string }>;
}

export interface RepresentacionAdminPJInput {
  represented: PersonaDraft;
  representante: PersonaDraft;
  effective_from: string;
  fuente: CargoInputDraft["fuente_designacion"];
}

export interface PersistRepresentacionesResult {
  okCount: number;
  failedReps: Array<{ rep: RepresentacionAdminPJInput; error: string }>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function bodyIdForCargo(ctx: AdapterContext, cargo: CargoInputDraft) {
  if (!cargo.bodyKey) return null;
  if (cargo.bodyKey === "JUNTA") return ctx.bodyJuntaId;
  if (cargo.bodyKey === "ADMIN") return ctx.bodyAdminId;
  // bodyKey="CDA" solo es valido si existe bodyConsejoId. Si la forma admin
  // es ADMIN_UNICO/SOLIDARIOS/MANCOMUNADOS, bodyConsejoId es null y el
  // fallback previo a ctx.bodyAdminId persistia un cargo PRESIDENTE/CONSEJERO
  // sobre un body no-colegiado, contaminando fn_refresh_parte_votante_body
  // que lo trataba como voting member (review Codex P2). Retornar null
  // marca el cargo como failed con mensaje claro en TX2.
  if (cargo.bodyKey === "CDA") return ctx.bodyConsejoId ?? null;
  return ctx.bodyComisiones[cargo.bodyKey] ?? null;
}

export async function resolvePersonByTaxIdOrCreate(tenantId: string, person: PersonaDraft) {
  const taxId = person.tax_id.trim();
  if (!taxId) throw new Error("La persona necesita NIF/CIF para persistirse");

  const { data: existing, error: existingError } = await supabase
    .from("persons")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("tax_id", taxId)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from("persons")
    .insert({
      tenant_id: tenantId,
      full_name: person.full_name,
      denomination: person.denomination || null,
      tax_id: taxId,
      person_type: person.person_type,
      email: person.email || null,
    })
    .select("id")
    .single();
  if (createError) throw createError;
  if (!created?.id) throw new Error("No se pudo crear la persona");
  return created.id as string;
}

export async function persistInitialCargos(
  ctx: AdapterContext,
  cargos: CargoInputDraft[],
): Promise<PersistCargosResult> {
  let okCount = 0;
  const failedCargos: PersistCargosResult["failedCargos"] = [];

  for (const cargo of cargos) {
    try {
      if (!cargo.persona) throw new Error("Cargo sin persona");
      const personId = await resolvePersonByTaxIdOrCreate(ctx.tenantId, cargo.persona);
      let representativePersonId: string | null = null;

      if (cargo.tipo_condicion === "ADMIN_PJ") {
        if (!cargo.persona.representante) throw new Error("Administrador PJ sin representante permanente");
        representativePersonId = await resolvePersonByTaxIdOrCreate(ctx.tenantId, cargo.persona.representante);
      }

      const payload: Record<string, unknown> = {
        tenant_id: ctx.tenantId,
        person_id: personId,
        entity_id: ctx.entityId,
        body_id: bodyIdForCargo(ctx, cargo),
        tipo_condicion: cargo.tipo_condicion,
        estado: "VIGENTE",
        fecha_inicio: cargo.fecha_inicio,
        fecha_fin: null,
        fuente_designacion: cargo.fuente_designacion,
        metadata: cargo.metadata ?? {},
      };
      if (representativePersonId) payload.representative_person_id = representativePersonId;

      const { error } = await supabase.from("condiciones_persona").insert(payload);
      if (error) throw error;
      okCount += 1;
    } catch (error) {
      failedCargos.push({ cargo, error: errorMessage(error) });
    }
  }

  return { okCount, failedCargos };
}

export async function persistInitialRepresentaciones(
  ctx: AdapterContext,
  reps: RepresentacionAdminPJInput[],
): Promise<PersistRepresentacionesResult> {
  let okCount = 0;
  const failedReps: PersistRepresentacionesResult["failedReps"] = [];

  for (const rep of reps) {
    try {
      const representedId = await resolvePersonByTaxIdOrCreate(ctx.tenantId, rep.represented);
      const representativeId = await resolvePersonByTaxIdOrCreate(ctx.tenantId, rep.representante);
      const { error } = await supabase.from("representaciones").insert({
        tenant_id: ctx.tenantId,
        entity_id: ctx.entityId,
        represented_person_id: representedId,
        representative_person_id: representativeId,
        scope: "ADMIN_PJ_REPRESENTANTE",
        meeting_id: null,
        porcentaje_delegado: null,
        effective_from: rep.effective_from,
        effective_to: null,
        evidence: {
          fuente: rep.fuente,
          referencia: "Alta sociedad onboarding D6",
        },
      });
      if (error) throw error;
      okCount += 1;
    } catch (error) {
      failedReps.push({ rep, error: errorMessage(error) });
    }
  }

  return { okCount, failedReps };
}
