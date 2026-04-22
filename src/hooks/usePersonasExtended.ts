import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export interface MandateWithCapital {
  id: string;
  body_id: string;
  person_id: string;
  role: string | null;
  type: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  capital_participacion: number | null;
  porcentaje_capital: number | null;
  tiene_derecho_voto: boolean | null;
  clase_accion: string | null;
  representative_person_id: string | null;
  person_type: string | null;
  denomination: string | null;
  full_name: string | null;
  [key: string]: unknown;
}

export interface AsistenteConCapital {
  id: string;
  meeting_id: string;
  person_id: string;
  role: string | null;
  present: boolean | null;
  capital_representado: number | null;
  via_representante: boolean | null;
  person_type: string | null;
  full_name: string | null;
  [key: string]: unknown;
}

export interface RepresentanteValidationError {
  mandate_id: string;
  person_name: string;
  severity: "BLOCKING";
  message: string;
}

/**
 * Load all mandates for a body with person capital information.
 * Returns mandate data enriched with person_type, denomination, and representative_person_id.
 *
 * F6.2: Migrado de `mandates` a `condiciones_persona` (SSOT canónica).
 * El shape MandateWithCapital se preserva para compatibilidad con consumidores.
 * Las columnas capital_participacion/porcentaje_capital/etc. son null aquí —
 * la información de capital vive en `capital_holdings` y se une por person_id
 * a nivel de entity, no de body (órgano). Para los flujos de voting/representación
 * los validadores toman person_id y resuelven el capital por separado.
 */
export function usePersonasConCapital(bodyId: string | undefined) {
  return useQuery({
    enabled: !!bodyId,
    queryKey: ["condiciones_persona", "withCapital", bodyId],
    staleTime: 60_000,
    queryFn: async (): Promise<MandateWithCapital[]> => {
      const { data, error } = await supabase
        .from("condiciones_persona")
        .select(
          "id, body_id, person_id, tipo_condicion, fecha_inicio, fecha_fin, estado, persons!inner(person_type, full_name, denomination, representative_person_id)"
        )
        .eq("body_id", bodyId!)
        .order("tipo_condicion", { ascending: true });
      if (error) throw error;
      type CondRaw = {
        id: string;
        body_id: string;
        person_id: string;
        tipo_condicion: string | null;
        fecha_inicio: string | null;
        fecha_fin: string | null;
        estado: string | null;
        persons?: {
          person_type?: string | null;
          full_name?: string | null;
          denomination?: string | null;
          representative_person_id?: string | null;
        } | null;
      };
      return ((data ?? []) as CondRaw[]).map((m) => ({
        id: m.id,
        body_id: m.body_id,
        person_id: m.person_id,
        role: m.tipo_condicion,
        type: null,
        start_date: m.fecha_inicio,
        end_date: m.fecha_fin,
        status: m.estado === "VIGENTE" ? "Activo" : "Cesado",
        capital_participacion: null,
        porcentaje_capital: null,
        tiene_derecho_voto: null,
        clase_accion: null,
        representative_person_id: m.persons?.representative_person_id ?? null,
        person_type: m.persons?.person_type ?? null,
        denomination: m.persons?.denomination ?? null,
        full_name: m.persons?.full_name ?? null,
      }));
    },
  });
}

/**
 * Load all meeting attendees with capital information.
 * Returns attendee data enriched with person_type and full_name.
 */
export function useAsistentesConCapital(meetingId: string | undefined) {
  return useQuery({
    enabled: !!meetingId,
    queryKey: ["meeting_attendees", "withCapital", meetingId],
    staleTime: 60_000,
    queryFn: async (): Promise<AsistenteConCapital[]> => {
      const { data, error } = await supabase
        .from("meeting_attendees")
        .select("*, persons!inner(person_type, full_name)")
        .eq("meeting_id", meetingId!)
        .order("role", { ascending: true });
      if (error) throw error;
      type AttendeeRaw = AsistenteConCapital & {
        persons?: {
          person_type?: string | null;
          full_name?: string | null;
        } | null;
      };
      return ((data ?? []) as AttendeeRaw[]).map((a) => ({
        ...a,
        person_type: a.persons?.person_type ?? null,
        full_name: a.persons?.full_name ?? null,
      }));
    },
  });
}

/**
 * Pure function: Validate that every legal person (JURIDICA) in the mandate list
 * has a non-null representative_person_id.
 * Returns array of blocking validation errors for mandates missing representative.
 */
export function validarRepresentantesPJ(mandates: MandateWithCapital[]): RepresentanteValidationError[] {
  // F6.2: el dominio canónico usa 'PJ' (modelo canónico Fase 0+1) pero
  // aceptamos también 'JURIDICA' por si hay datos legacy residuales.
  return mandates
    .filter((m) => (m.person_type === "PJ" || m.person_type === "JURIDICA") && !m.representative_person_id)
    .map((m) => ({
      mandate_id: m.id,
      person_name: m.full_name ?? m.denomination ?? "Sin nombre",
      severity: "BLOCKING" as const,
      message: `Persona jurídica sin representante designado. Designar representante antes de la reunión.`,
    }));
}
