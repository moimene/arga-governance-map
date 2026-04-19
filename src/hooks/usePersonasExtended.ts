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
 */
export function usePersonasConCapital(bodyId: string | undefined) {
  return useQuery({
    enabled: !!bodyId,
    queryKey: ["mandates", "withCapital", bodyId],
    staleTime: 60_000,
    queryFn: async (): Promise<MandateWithCapital[]> => {
      const { data, error } = await supabase
        .from("mandates")
        .select("*, persons!inner(person_type, full_name, denomination, representative_person_id)")
        .eq("body_id", bodyId!)
        .order("role", { ascending: true });
      if (error) throw error;
      type MandateRaw = MandateWithCapital & {
        persons?: {
          person_type?: string | null;
          full_name?: string | null;
          denomination?: string | null;
          representative_person_id?: string | null;
        } | null;
      };
      return ((data ?? []) as MandateRaw[]).map((m) => ({
        ...m,
        person_type: m.persons?.person_type ?? null,
        full_name: m.persons?.full_name ?? null,
        denomination: m.persons?.denomination ?? null,
        representative_person_id: m.persons?.representative_person_id ?? null,
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
  return mandates
    .filter((m) => m.person_type === "JURIDICA" && !m.representative_person_id)
    .map((m) => ({
      mandate_id: m.id,
      person_name: m.full_name ?? m.denomination ?? "Sin nombre",
      severity: "BLOCKING" as const,
      message: `Persona jurídica sin representante designado. Designar representante antes de la reunión.`,
    }));
}
