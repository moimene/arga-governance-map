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
      if (cargo.metadata && Object.keys(cargo.metadata).length > 0) {
        throw new Error(
          "El alta autoritativa de cargos no admite metadata libre; debe modelarse en la RPC antes de persistirla",
        );
      }
      const bodyId = bodyIdForCargo(ctx, cargo);
      if (cargo.bodyKey && !bodyId) {
        throw new Error(`No se pudo resolver el órgano ${cargo.bodyKey} para el cargo ${cargo.tipo_condicion}`);
      }
      const personId = await resolvePersonByTaxIdOrCreate(ctx.tenantId, cargo.persona);
      let representativePersonId: string | null = null;

      if (cargo.persona.representante) {
        representativePersonId = await resolvePersonByTaxIdOrCreate(ctx.tenantId, cargo.persona.representante);
      }

      const { data, error } = await supabase.rpc("fn_designar_cargo", {
        p_tenant_id: ctx.tenantId,
        p_person_id: personId,
        p_entity_id: ctx.entityId,
        p_body_id: bodyId,
        p_tipo_condicion: cargo.tipo_condicion,
        p_fecha_inicio: cargo.fecha_inicio,
        p_fuente_designacion: cargo.fuente_designacion,
        p_inscripcion_rm_referencia: null,
        p_inscripcion_rm_fecha: null,
        p_representative_person_id: representativePersonId,
        p_cesar_singleton_previo: true,
        p_idempotency_key: [
          "onboarding-designar-cargo",
          ctx.tenantId,
          ctx.entityId,
          personId,
          bodyId ?? "no-body",
          cargo.tipo_condicion,
          cargo.fecha_inicio,
          cargo.fuente_designacion,
          representativePersonId ?? "no-representative",
        ].join(":"),
      });
      if (error) throw error;
      if (!data) throw new Error("La RPC autoritativa no devolvió el identificador del cargo");
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
      const { data, error } = await supabase.rpc("fn_upsert_representante_admin_pj", {
        p_tenant_id: ctx.tenantId,
        p_represented_person_id: representedId,
        p_representative_person_id: representativeId,
        p_entity_id: ctx.entityId,
        p_effective_from: rep.effective_from,
        p_inscripcion_rm_referencia: null,
        p_inscripcion_rm_fecha: null,
        p_idempotency_key: [
          "onboarding-representante-admin-pj",
          ctx.tenantId,
          ctx.entityId,
          representedId,
          representativeId,
          rep.effective_from,
          rep.fuente,
        ].join(":"),
      });
      if (error) throw error;
      if (!data) throw new Error("La RPC autoritativa no devolvió el identificador de la representación");
      okCount += 1;
    } catch (error) {
      failedReps.push({ rep, error: errorMessage(error) });
    }
  }

  return { okCount, failedReps };
}
