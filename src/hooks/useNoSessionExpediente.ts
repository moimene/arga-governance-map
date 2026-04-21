import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

// ============================================================================
// Row interfaces (WORM — Write-Once tables)
// ============================================================================

export interface NoSessionExpedienteRow {
  id: string;
  tenant_id: string;
  agreement_id: string;
  entity_id: string;
  body_id: string;
  tipo_proceso: string; // UNANIMIDAD_ESCRITA_SL | CIRCULACION_CONSEJO | DECISION_SOCIO_UNICO_SL | DECISION_SOCIO_UNICO_SA
  propuesta_texto: string | null;
  propuesta_documentos: unknown | null;
  propuesta_fecha: string | null;
  propuesta_firmada_por: string | null;
  ventana_inicio: string | null;
  ventana_fin: string | null;
  ventana_dias_habiles: number | null;
  ventana_fuente: string | null;
  estado: string; // BORRADOR | NOTIFICADO | ABIERTO | CERRADO_OK | CERRADO_FAIL | PROCLAMADO
  condicion_adopcion: string; // UNANIMIDAD_CAPITAL | UNANIMIDAD_CONSEJEROS | MAYORIA_CONSEJEROS_ESCRITA | DECISION_UNICA
  fecha_cierre: string | null;
  motivo_cierre: string | null;
  rule_pack_id: string | null;
  rule_pack_version: string | null;
  snapshot_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoSessionRespuestaRow {
  id: string;
  tenant_id: string;
  expediente_id: string;
  person_id: string;
  capital_participacion: number | null;
  porcentaje_capital: number | null;
  es_consejero: boolean;
  sentido: string; // CONSENTIMIENTO | OBJECION | OBJECION_PROCEDIMIENTO | SILENCIO
  texto_respuesta: string | null;
  fecha_respuesta: string;
  firma_qes_ref: string | null;
  firma_qes_timestamp: string | null;
  ocsp_status: string | null;
  notificacion_certificada_ref: string | null;
}

export interface NoSessionNotificacionRow {
  id: string;
  tenant_id: string;
  expediente_id: string;
  person_id: string;
  canal: string; // NOTIFICACION_CERTIFICADA | EMAIL_SIMPLE | BUROFAX | ENTREGA_PERSONAL
  enviada_at: string | null;
  entregada_at: string | null;
  evidencia_ref: string | null;
  evidencia_hash: string | null;
  estado: string; // PENDIENTE | ENVIADA | ENTREGADA | FALLIDA | RECHAZADA
}

// ============================================================================
// Detail row with joins
// ============================================================================

export interface NoSessionExpedienteDetailRow extends NoSessionExpedienteRow {
  agreement_info?: {
    id?: string;
    matter_class?: string;
    adoption_mode?: string;
  } | null;
  entity_info?: {
    id?: string;
    common_name?: string;
    legal_form?: string;
  } | null;
  body_info?: {
    id?: string;
    name?: string;
    body_type?: string;
  } | null;
  proposer?: {
    id?: string;
    nombre_completo?: string;
  } | null;
}

// ============================================================================
// Query hooks
// ============================================================================

/**
 * useNoSessionExpediente — Loads single expediente with full joins
 * Includes agreement, entity, body, proposer, and related respuestas/notificaciones
 */
export function useNoSessionExpediente(expedienteId?: string) {
  return useQuery({
    enabled: !!expedienteId,
    queryKey: ["no_session_expedientes", "byId", expedienteId],
    staleTime: 30_000,
    queryFn: async (): Promise<NoSessionExpedienteDetailRow | null> => {
      const { data, error } = await supabase
        .from("no_session_expedientes")
        .select(
          "*, agreements(id, matter_class, adoption_mode), entities(id, common_name, legal_form), governing_bodies(id, name, body_type), persons(id, nombre_completo)"
        )
        .eq("tenant_id", DEMO_TENANT)
        .eq("id", expedienteId!)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      type RawDetail = Omit<
        NoSessionExpedienteDetailRow,
        "agreement_info" | "entity_info" | "body_info" | "proposer"
      > & {
        agreements?: {
          id?: string;
          matter_class?: string;
          adoption_mode?: string;
        } | null;
        entities?: {
          id?: string;
          common_name?: string;
          legal_form?: string;
        } | null;
        governing_bodies?: {
          id?: string;
          name?: string;
          body_type?: string;
        } | null;
        persons?: {
          id?: string;
          nombre_completo?: string;
        } | null;
      };

      const raw = data as RawDetail;
      return {
        ...raw,
        agreement_info: raw.agreements ?? undefined,
        entity_info: raw.entities ?? undefined,
        body_info: raw.governing_bodies ?? undefined,
        proposer: raw.persons ?? undefined,
      };
    },
  });
}

/**
 * useNoSessionExpedientes — Lists expedientes for an agreement (or all)
 * Includes basic entity/body info
 */
export function useNoSessionExpedientes(agreementId?: string) {
  return useQuery({
    queryKey: ["no_session_expedientes", "list", agreementId ?? "all"],
    staleTime: 60_000,
    queryFn: async (): Promise<NoSessionExpedienteDetailRow[]> => {
      let query = supabase
        .from("no_session_expedientes")
        .select(
          "*, agreements(id, matter_class, adoption_mode), entities(id, common_name, legal_form), governing_bodies(id, name, body_type)"
        )
        .eq("tenant_id", DEMO_TENANT);

      if (agreementId) {
        query = query.eq("agreement_id", agreementId);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      type RawDetail = Omit<
        NoSessionExpedienteDetailRow,
        "agreement_info" | "entity_info" | "body_info" | "proposer"
      > & {
        agreements?: {
          id?: string;
          matter_class?: string;
          adoption_mode?: string;
        } | null;
        entities?: {
          id?: string;
          common_name?: string;
          legal_form?: string;
        } | null;
        governing_bodies?: {
          id?: string;
          name?: string;
          body_type?: string;
        } | null;
        persons?: {
          id?: string;
          nombre_completo?: string;
        } | null;
      };

      return ((data ?? []) as RawDetail[]).map((row) => ({
        ...row,
        agreement_info: row.agreements ?? undefined,
        entity_info: row.entities ?? undefined,
        body_info: row.governing_bodies ?? undefined,
        proposer: row.persons ?? undefined,
      }));
    },
  });
}

/**
 * useNoSessionRespuestas — Lists all respuestas for an expediente
 * WORM table — no edits allowed
 */
export function useNoSessionRespuestas(expedienteId?: string) {
  return useQuery({
    enabled: !!expedienteId,
    queryKey: ["no_session_respuestas", expedienteId],
    staleTime: 30_000,
    queryFn: async (): Promise<NoSessionRespuestaRow[]> => {
      const { data, error } = await supabase
        .from("no_session_respuestas")
        .select("*")
        .eq("tenant_id", DEMO_TENANT)
        .eq("expediente_id", expedienteId!)
        .order("fecha_respuesta", { ascending: false });

      if (error) throw error;
      return (data ?? []) as NoSessionRespuestaRow[];
    },
  });
}

/**
 * useNoSessionNotificaciones — Lists all notificaciones for an expediente
 * WORM table — no edits allowed
 */
export function useNoSessionNotificaciones(expedienteId?: string) {
  return useQuery({
    enabled: !!expedienteId,
    queryKey: ["no_session_notificaciones", expedienteId],
    staleTime: 30_000,
    queryFn: async (): Promise<NoSessionNotificacionRow[]> => {
      const { data, error } = await supabase
        .from("no_session_notificaciones")
        .select("*")
        .eq("tenant_id", DEMO_TENANT)
        .eq("expediente_id", expedienteId!)
        .order("enviada_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as NoSessionNotificacionRow[];
    },
  });
}

// ============================================================================
// Mutation hooks
// ============================================================================

/**
 * useCrearExpediente — Creates a new no_session_expediente
 * Input: agreement_id, tipo_proceso, condicion_adopcion, and optional propuesta data
 */
export function useCrearExpediente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      agreement_id: string;
      entity_id: string;
      body_id: string;
      tipo_proceso: string;
      condicion_adopcion: string;
      propuesta_texto?: string;
      ventana_inicio?: string;
      ventana_fin?: string;
      ventana_dias_habiles?: number;
    }) => {
      const { data, error } = await supabase
        .from("no_session_expedientes")
        .insert({
          tenant_id: DEMO_TENANT,
          agreement_id: input.agreement_id,
          entity_id: input.entity_id,
          body_id: input.body_id,
          tipo_proceso: input.tipo_proceso,
          condicion_adopcion: input.condicion_adopcion,
          propuesta_texto: input.propuesta_texto ?? null,
          ventana_inicio: input.ventana_inicio ?? null,
          ventana_fin: input.ventana_fin ?? null,
          ventana_dias_habiles: input.ventana_dias_habiles ?? null,
          ventana_fuente: "LEY",
          estado: "BORRADOR",
        })
        .select()
        .single();

      if (error) throw error;
      return data as NoSessionExpedienteRow;
    },
    onSuccess: () => {
      // Invalidate lists
      qc.invalidateQueries({
        queryKey: ["no_session_expedientes", "list"],
      });
    },
  });
}

/**
 * useRegistrarRespuesta — Registers a response (WORM — immutable)
 * Input: expediente_id, person_id, sentido (CONSENTIMIENTO|OBJECION|OBJECION_PROCEDIMIENTO|SILENCIO)
 */
export function useRegistrarRespuesta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      expediente_id: string;
      person_id: string;
      sentido: string;
      capital_participacion?: number;
      porcentaje_capital?: number;
      es_consejero?: boolean;
      texto_respuesta?: string;
      firma_qes_ref?: string;
      firma_qes_timestamp?: string;
      ocsp_status?: string;
    }) => {
      const { data, error } = await supabase
        .from("no_session_respuestas")
        .insert({
          tenant_id: DEMO_TENANT,
          expediente_id: input.expediente_id,
          person_id: input.person_id,
          sentido: input.sentido,
          capital_participacion: input.capital_participacion ?? null,
          porcentaje_capital: input.porcentaje_capital ?? null,
          es_consejero: input.es_consejero ?? false,
          texto_respuesta: input.texto_respuesta ?? null,
          firma_qes_ref: input.firma_qes_ref ?? null,
          firma_qes_timestamp: input.firma_qes_timestamp ?? null,
          ocsp_status: input.ocsp_status ?? null,
          notificacion_certificada_ref: null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as NoSessionRespuestaRow;
    },
    onSuccess: (_, input) => {
      // Invalidate respuestas list
      qc.invalidateQueries({
        queryKey: ["no_session_respuestas", input.expediente_id],
      });
    },
  });
}

/**
 * useEnviarNotificacion — Sends a notification and updates expediente estado
 * Input: expediente_id, person_id, canal
 */
export function useEnviarNotificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      expediente_id: string;
      person_id: string;
      canal: string;
      evidencia_ref?: string;
      evidencia_hash?: string;
    }) => {
      // 1. Insert notificacion
      const { data: notif, error: notifError } = await supabase
        .from("no_session_notificaciones")
        .insert({
          tenant_id: DEMO_TENANT,
          expediente_id: input.expediente_id,
          person_id: input.person_id,
          canal: input.canal,
          estado: "ENVIADA",
          enviada_at: new Date().toISOString(),
          evidencia_ref: input.evidencia_ref ?? null,
          evidencia_hash: input.evidencia_hash ?? null,
        })
        .select()
        .single();

      if (notifError) throw notifError;

      // 2. Update expediente estado to NOTIFICADO (if BORRADOR)
      const { data: expData, error: expError } = await supabase
        .from("no_session_expedientes")
        .select("estado")
        .eq("id", input.expediente_id)
        .eq("tenant_id", DEMO_TENANT)
        .single();

      if (expError) throw expError;

      if (expData?.estado === "BORRADOR") {
        await supabase
          .from("no_session_expedientes")
          .update({ estado: "NOTIFICADO" })
          .eq("id", input.expediente_id)
          .eq("tenant_id", DEMO_TENANT);
      }

      return notif as NoSessionNotificacionRow;
    },
    onSuccess: (_, input) => {
      // Invalidate related queries
      qc.invalidateQueries({
        queryKey: ["no_session_notificaciones", input.expediente_id],
      });
      qc.invalidateQueries({
        queryKey: ["no_session_expedientes", "byId", input.expediente_id],
      });
      qc.invalidateQueries({
        queryKey: ["no_session_expedientes", "list"],
      });
    },
  });
}

/**
 * useActualizarExpediente — Updates expediente (non-WORM fields: estado, fecha_cierre, motivo_cierre)
 */
export function useActualizarExpediente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      expediente_id: string;
      estado?: string;
      fecha_cierre?: string;
      motivo_cierre?: string;
    }) => {
      const updateData: Record<string, unknown> = {};

      if (input.estado) updateData.estado = input.estado;
      if (input.fecha_cierre) updateData.fecha_cierre = input.fecha_cierre;
      if (input.motivo_cierre) updateData.motivo_cierre = input.motivo_cierre;

      const { data, error } = await supabase
        .from("no_session_expedientes")
        .update(updateData)
        .eq("id", input.expediente_id)
        .eq("tenant_id", DEMO_TENANT)
        .select()
        .single();

      if (error) throw error;
      return data as NoSessionExpedienteRow;
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({
        queryKey: ["no_session_expedientes", "byId", input.expediente_id],
      });
      qc.invalidateQueries({
        queryKey: ["no_session_expedientes", "list"],
      });
    },
  });
}
