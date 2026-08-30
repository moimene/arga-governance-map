import { describe, expect, it, beforeAll } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveReunionInitialStep } from "@/pages/secretaria/ReunionStepper";
import { GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

/**
 * El aviso de acreditación del acta se pinta en los pasos 1 y 6. La doctrina de
 * la Task 8 es que el hueco se explique DONDE alguien va a buscar lo que falta,
 * así que hace falta que esta Junta aterrice siempre en uno de esos dos.
 *
 * Los pasos 2, 3 y 4 no lo llevan. Son alcanzables como aterrizaje solo con la
 * sesión abierta y SIN resoluciones — y `hasResolutions` se comprueba ANTES que
 * quórum y asistentes. Esta Junta tiene 10 resoluciones, así que no puede caer
 * ahí salvo que alguien las borre. Este test cae si eso deja de ser cierto:
 * porque se borren, o porque alguien reordene las comprobaciones.
 */
const PASOS_CON_AVISO = new Set([1, 6]);

describe("C1 — la reunión aterriza siempre en un paso que explica el hueco del acta", () => {
  let garr: SupabaseClient;
  let hasAttendees = false;
  let hasQuorum = false;
  let hasResolutions = false;
  let status = "";

  beforeAll(async () => {
    garr = await sesionDe("GARRIGUES");
    const { data: m, error } = await garr.from("meetings")
      .select("id, status, quorum_data").eq("tenant_id", GARRIGUES_TENANT).maybeSingle();
    if (error || !m) throw new Error(`no se pudo leer la reunión: ${error?.message}`);
    status = String(m.status);
    hasQuorum = Boolean((m.quorum_data as Record<string, unknown> | null)?.quorum);
    const { count: nAsis } = await garr.from("meeting_attendees")
      .select("id", { count: "exact", head: true }).eq("meeting_id", m.id);
    const { count: nRes } = await garr.from("meeting_resolutions")
      .select("id", { count: "exact", head: true }).eq("meeting_id", m.id);
    hasAttendees = (nAsis ?? 0) > 0;
    hasResolutions = (nRes ?? 0) > 0;
  });

  it("con el estado real de Cloud, aterriza en el paso 1", () => {
    const meetingOpen = status === "EN_CURSO" || status === "CELEBRADA";
    expect(meetingOpen).toBe(false);   // DRAFT, y así se decidió dejarlo
    const paso = deriveReunionInitialStep({ meetingOpen, hasAttendees, hasQuorum, hasResolutions });
    expect(paso).toBe(1);
    expect(PASOS_CON_AVISO.has(paso)).toBe(true);
  });

  it("y si alguien abriera la sesión, aterrizaría en el 6 — no en 2, 3 ni 4", () => {
    // Éste es el que sostiene la doctrina: el hueco del stepper es real en
    // general, pero no vivo en este expediente, y la razón es que tiene
    // resoluciones y `hasResolutions` se comprueba primero.
    expect(hasResolutions).toBe(true);
    const paso = deriveReunionInitialStep({
      meetingOpen: true, hasAttendees, hasQuorum, hasResolutions,
    });
    expect(paso).toBe(6);
    expect(PASOS_CON_AVISO.has(paso)).toBe(true);
  });

  it("el hueco EXISTE: sin resoluciones sí se aterriza donde el aviso no está", () => {
    // Sin esta aserción el fichero diría «no hay problema», que es falso. El
    // defecto es general y queda declarado; lo que no es, es alcanzable aquí.
    for (const [entrada, esperado] of [
      [{ meetingOpen: true, hasAttendees: false, hasQuorum: false, hasResolutions: false }, 2],
      [{ meetingOpen: true, hasAttendees: true,  hasQuorum: false, hasResolutions: false }, 3],
      [{ meetingOpen: true, hasAttendees: true,  hasQuorum: true,  hasResolutions: false }, 4],
    ] as const) {
      const paso = deriveReunionInitialStep(entrada);
      expect(paso).toBe(esperado);
      expect(PASOS_CON_AVISO.has(paso)).toBe(false);
    }
  });
});
