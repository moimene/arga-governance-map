// src/test/schema/garrigues-rule-packs-seed.test.ts
// G3 Task 3 gate de datos: el tenant Garrigues tiene sus 4 rule packs de
// órgano (GARR_*) + (fix round 2) 6 rule packs por-materia bajo RLS
// per-tenant, y ARGA queda intacta y aislada de los 10. Patrón graceful-skip
// de garrigues-gobierno-seed.test.ts (post-fix, con cliente `arga` propio y
// flag `argaAuthed` independiente).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.ANON_PUBLIC ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

const GARR_PACK_IDS = [
  "GARR_DECISION_ADMIN_UNICO",
  "GARR_JUNTA_SOCIOS",
  "GARR_SOCIO_UNICO_FILIAL",
  "GARR_CONSEJO_EAD",
] as const;

// Fix round 2 — 6 packs POR MATERIA (pack_id = materia), añadidos porque el
// panel "Reglas aplicables" del ConvocatoriasStepper resuelve por materia,
// sin fallback a órgano (rule-resolution.ts:310-317); los 4 GARR_* de arriba
// nunca cubrían ese camino.
const MATERIA_PACK_IDS = [
  "ADMISION_SOCIO_CUOTA",
  "EXCLUSION_SOCIO_ESTATUTARIA",
  "CONTINUIDAD_SOCIO_POST_60",
  "NOMBRAMIENTO_ADMINISTRADOR_UNICO",
  "RETRIBUCION_PRESTACIONES_ACCESORIAS",
  "INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA",
] as const;

describe("G3 Task 3 — rule packs núcleo del tenant Garrigues (RLS per-tenant, aislamiento ARGA)", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;
  let authed = false;
  let argaAuthed = false;
  // Además del graceful-skip por login (sin red / credenciales), esta sonda
  // se escribe ANTES de que el controller ejecute el Step 4 (aplicar la
  // migración en Cloud). Si el entorno de ejecución SÍ tiene red — como
  // ocurrió al verificar este fichero — el login puede tener éxito y las
  // queries GARR_* devolver 0 filas de forma legítima y esperada, no por
  // fallo de conexión. `packsSeeded` distingue ambos casos: los tests que
  // dependen de los 4 packs que crea la migración de este Task se saltan
  // (verde, no rojo) hasta que existan; los que verifican datos YA
  // existentes (aislamiento ARGA, invariante art. 4.3 de G2) se ejecutan
  // igual, con red, desde el primer momento.
  let packsSeeded = false;
  // Fix round 2: mismo patrón, gate independiente — la migración de los 6
  // packs por-materia es posterior a la de los 4 GARR_*, así que
  // `packsSeeded` (ya en true desde que el controller aplicó el Step 4
  // original) no sirve para saber si ESTOS 6 existen todavía.
  let materiaPacksSeeded = false;

  beforeAll(async () => {
    try {
      // Sesión COMPARTIDA: 2 logins en toda la suite, storageKey por cuenta.
      garr = await sesionDe("GARRIGUES");
      authed = true;

      if (authed && garr) {
        const { data: probe } = await garr.from("rule_packs").select("id").like("id", "GARR_%").limit(1);
        packsSeeded = (probe ?? []).length > 0;
        if (!packsSeeded) {
          console.warn("[g3-rule-packs-seed] packs GARR_* aún no existen en Cloud — Step 4 (controller) pendiente; tests dependientes en skip.");
        }

        const { data: materiaProbe } = await garr
          .from("rule_packs")
          .select("id")
          .eq("id", "ADMISION_SOCIO_CUOTA")
          .limit(1);
        materiaPacksSeeded = (materiaProbe ?? []).length > 0;
        if (!materiaPacksSeeded) {
          console.warn("[g3-rule-packs-seed] packs por-materia (fix round 2) aún no existen en Cloud — tests dependientes en skip.");
        }
      }

      // ARGA client para verificar aislamiento RLS — cliente e idempotencia
      // de login independientes del cliente Garrigues.
      arga = await sesionDe("ARGA");
      argaAuthed = true;
    } catch (error) {
      authed = false;
      // UN LOGIN FALLIDO NO ES «NADA QUE COMPROBAR». Al tragarse la excepción,
      // cada `it` de abajo caía en `if (!authed) { expect(true).toBe(true); return; }`
      // y la sonda Cloud terminaba VERDE sin asertar nada: rotar una contraseña
      // o caerse Cloud dejaba el gate en verde mudo. `sesionDe` ya lanza con el
      // motivo; aquí se propaga para que el fichero se ponga ROJO.
      throw error;
    }
  }, 30_000);

  // SIN afterAll con signOut: la sesión es COMPARTIDA. Cerrarla aquí dejaría sin
  // autenticar a las sondas posteriores, y el síntoma serían consultas vacías
  // en un fichero que no ha hecho nada mal.

  it("Garrigues ve sus 4 packs núcleo bajo su tenant (RLS per-tenant)", async () => {
    if (!authed || !garr || !packsSeeded) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("rule_packs").select("id, organo_tipo").like("id", "GARR_%");
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([...GARR_PACK_IDS]));
    // organo_tipo por pack — vocabulario de rule-pack-organo.ts (whitelist de
    // familias). GARR_DECISION_ADMIN_UNICO usa 'CONSEJO' a propósito: no hay
    // familia propia "ADMIN_UNICO", el resolver mapea la administración
    // genérica (incluida la unipersonal) a la familia CONSEJO.
    const organoById = new Map((data ?? []).map((r) => [r.id, r.organo_tipo]));
    expect(organoById.get("GARR_DECISION_ADMIN_UNICO")).toBe("CONSEJO");
    expect(organoById.get("GARR_JUNTA_SOCIOS")).toBe("JUNTA_GENERAL");
    expect(organoById.get("GARR_SOCIO_UNICO_FILIAL")).toBe("SOCIO_UNICO");
    expect(organoById.get("GARR_CONSEJO_EAD")).toBe("CONSEJO");
  });

  it("ARGA no ve los packs GARR_ (aislamiento) y conserva sus 59", async () => {
    if (!argaAuthed || !arga) { expect(true).toBe(true); return; }
    const { data: garrRows, error: eGarr } = await arga.from("rule_packs").select("id").like("id", "GARR_%");
    expect(eGarr).toBeNull();
    expect((garrRows ?? []).length).toBe(0);

    // Fix round 2: los 6 packs por-materia no llevan prefijo GARR_ (pack_id =
    // materia), así que necesitan su propio chequeo de aislamiento — el
    // filtro .like("GARR_%") de arriba no los alcanzaría aunque existieran.
    const { data: materiaRows, error: eMateria } = await arga
      .from("rule_packs")
      .select("id")
      .in("id", [...MATERIA_PACK_IDS]);
    expect(eMateria).toBeNull();
    expect((materiaRows ?? []).length).toBe(0);

    // RLS (rule_packs_tenant_isolation: tenant_id = fn_current_tenant_id())
    // ya garantiza que solo se ven filas del propio tenant; esto verifica
    // además que el recuento no se movió con las migraciones de Garrigues.
    const { data: allArga, error: eAll } = await arga.from("rule_packs").select("id").limit(200);
    expect(eAll).toBeNull();
    expect((allArga ?? []).length).toBe(59);
  });

  it("Garrigues ve además sus 6 packs por-materia (fix round 2), organo_tipo=JUNTA_GENERAL, y no ve ninguno ajeno", async () => {
    if (!authed || !garr || !materiaPacksSeeded) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("rule_packs").select("id, organo_tipo").in("id", [...MATERIA_PACK_IDS]);
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([...MATERIA_PACK_IDS]));
    expect((data ?? []).every((r) => r.organo_tipo === "JUNTA_GENERAL")).toBe(true);

    // Aquí había un total pinado (`length === 10`: 4 de órgano + 6 por materia).
    // Se rompió en cuanto C1 sembró 3 packs legítimos para las materias de la
    // Junta de 2026, y actualizarlo a 13 solo habría aplazado la siguiente
    // rotura: **un inventario no es una invariante**. Lo que sí lo es, y es lo
    // que este describe existe para probar, son estas dos cosas:
    const { data: allGarr, error: eAll } = await garr
      .from("rule_packs").select("id, tenant_id").limit(200);
    expect(eAll).toBeNull();

    // (1) Los 10 packs de G3 siguen ahí. Si alguien borra uno, cae — cosa que
    //     un total no distinguiría de «alguien añadió uno y borró otro».
    const idsGarr = (allGarr ?? []).map((r) => r.id);
    expect(idsGarr).toEqual(expect.arrayContaining([...GARR_PACK_IDS, ...MATERIA_PACK_IDS]));

    // (2) Ninguno de los que ve Garrigues es de otro tenant. Ésta es la
    //     invariante de aislamiento, y no caduca al añadir packs legítimos.
    expect((allGarr ?? []).length).toBeGreaterThanOrEqual(
      GARR_PACK_IDS.length + MATERIA_PACK_IDS.length,
    );
    expect((allGarr ?? []).every((r) => r.tenant_id === GARRIGUES_TENANT)).toBe(true);
  });

  it("los 6 packs por-materia pasan invariantes: nunca Ley 2/2007 en el plazo de convocatoria, y la mayoría real vive en votacion.mayoria.SL", async () => {
    if (!authed || !garr || !materiaPacksSeeded) { expect(true).toBe(true); return; }
    const { data, error } = await garr
      .from("rule_pack_versions")
      .select("pack_id, payload, is_active")
      .in("pack_id", [...MATERIA_PACK_IDS])
      .eq("is_active", true);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(6);

    for (const row of data ?? []) {
      const payload = row.payload;
      // Invariante transversal (Comité Legal 2026-08-04): la antelación de
      // convocatoria nunca cita Ley 2/2007 — igual que GARR_JUNTA_SOCIOS, del
      // que estos 6 son clon estructural.
      const antelacionSL = payload?.convocatoria?.antelacionDias?.SL?.referencia ?? "";
      expect(antelacionSL).not.toContain("Ley 2/2007");
      // Cada pack tiene mayoría real (LEY) en SL, y las ramas SA/CONSEJO
      // declaradas explícitamente "no aplicable" — nunca 'LEY' en esas dos.
      expect(payload?.votacion?.mayoria?.SL?.fuente).toBe("LEY");
      expect(payload?.votacion?.mayoria?.SA?.referencia).toContain("no aplicable");
      expect(payload?.votacion?.mayoria?.CONSEJO?.referencia).toContain("no aplicable");
    }

    // Spot-check de las 2 citas más sensibles de la tabla del coordinador.
    const byId = new Map((data ?? []).map((r) => [r.pack_id, r.payload]));
    expect(byId.get("ADMISION_SOCIO_CUOTA")?.votacion?.mayoria?.SL?.formula).toBe("favor >= 4/5_votos_totales");
    expect(byId.get("EXCLUSION_SOCIO_ESTATUTARIA")?.votacion?.mayoria?.sociosProfesionalesExclusion?.referencia).toBe(
      "arts. 15 y 16 Ley 2/2007",
    );
    // Las otras 5 materias NO deben llevar la rama de exclusión — es
    // exclusiva de EXCLUSION_SOCIO_ESTATUTARIA.
    for (const id of MATERIA_PACK_IDS) {
      if (id === "EXCLUSION_SOCIO_ESTATUTARIA") continue;
      expect(byId.get(id)?.votacion?.mayoria?.sociosProfesionalesExclusion).toBeUndefined();
    }
  });

  it("GARR_JUNTA_SOCIOS tiene versión ACTIVA con el overlay Ley 2/2007 (5 citas) y la doble mayoría de exclusión anidada en votacion.mayoria", async () => {
    if (!authed || !garr || !packsSeeded) { expect(true).toBe(true); return; }
    const { data, error } = await garr
      .from("rule_pack_versions")
      .select("payload, is_active, status")
      .eq("pack_id", "GARR_JUNTA_SOCIOS")
      .eq("is_active", true)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.status).toBe("ACTIVE");
    const payload = data?.payload;
    // Overlay completo (5 citas): transmisión (art. 13), separación (art. 14),
    // exclusión (arts. 15/16), mayoría de socios profesionales (art. 4),
    // inscribibilidad (art. 8) — Comité Legal 2026-08-04, Decisión 2.
    expect(payload?.reglaEspecifica?.overlayLey2007?.length).toBe(5);
    // Doble mayoría de la exclusión: anidada en votacion.mayoria, NO en un
    // campo de primer nivel del payload (el extractor legacy no la lee).
    expect(payload?.votacion?.mayoria?.sociosProfesionalesExclusion?.referencia).toBe("arts. 15 y 16 Ley 2/2007");
    expect(payload?.votacion?.mayoria?.sociosProfesionalesExclusion?.alcance).toContain("EXCLUSION_SOCIO_PROFESIONAL_UNICAMENTE");
    // Corrección de cita obligada: la antelación de 15 días para SL/SLP
    // SIEMPRE menciona "176 LSC (supletoria)" y NUNCA cita Ley 2/2007 (que no
    // regula plazos de convocatoria). No se pina el string exacto: esta
    // sonda corre contra Cloud, donde a fecha de este commit la versión
    // ACTIVA de GARR_JUNTA_SOCIOS sigue siendo v1.0.0 ("art. 176 LSC
    // (supletoria)"; Comité Legal 2026-08-04). La migración G3 Task 5
    // (20260805100000_g3_junta_socios_pack_v110.sql) sube el pack a v1.1.0
    // ("arts. 27.4 Estatutos y 176 LSC (supletoria)" — cotejo con Estatutos
    // 2026-08-05), pero aplicarla en Cloud es el Step 4 del controller, no
    // este commit. El `toContain` tolera ambas versiones sin romper el gate
    // en ningún punto del rollout.
    const antelacionSL = payload?.convocatoria?.antelacionDias?.SL?.referencia ?? "";
    const antelacionSLP = payload?.convocatoria?.antelacionDias?.SLP?.referencia ?? "";
    expect(antelacionSL).toContain("176 LSC (supletoria)");
    expect(antelacionSL).not.toContain("Ley 2/2007");
    expect(antelacionSLP).toContain("176 LSC (supletoria)");
    expect(antelacionSLP).not.toContain("Ley 2/2007");
  });

  // C1 Task 1 — GARR_CONSEJO_EAD sube a v1.1.0 (decisión del usuario
  // 2026-08-29, docs/legal/2026-08-29-decisiones-capital-firme-y-consejo-
  // ead.md, Decisión A). Estos dos tests NO llevan el guard `packsSeeded`
  // vacuo: la migración 20260829120000 la aplica el controller, y hasta
  // entonces deben salir en ROJO, no en verde silencioso. Un skip aquí sería
  // un gate que no asierta nada.
  it("GARR_CONSEJO_EAD tiene v1.1.0 activa con la práctica de 5 días confirmada y sin cita legal de plazo", async () => {
    const { data, error } = await garr
      .from("rule_pack_versions")
      .select("version, payload, is_active, status")
      .eq("pack_id", "GARR_CONSEJO_EAD")
      .eq("is_active", true);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const row = data[0];
    expect(row.version).toBe("1.1.0");

    const antelacion = row.payload?.reglaEspecifica?.antelacionConsejo;
    expect(antelacion).toBeDefined();
    expect(antelacion.valorDias).toBe(5);
    expect(antelacion.naturaleza).toBe("PRACTICA_SOCIETARIA_CONFIRMADA");
    expect(antelacion.nota).toContain("no fija plazo mínimo");

    // El 5 NO se convierte en cita legal de plazo: la referencia sigue negando el mínimo.
    for (const forma of ["SA", "SL"]) {
      const dias = row.payload.convocatoria.antelacionDias[forma];
      expect(dias.valor).toBe(5);
      expect(dias.fuente).toBe("ESTATUTOS");
      expect(dias.referencia).toBe("art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente");
    }
  });

  it("la v1.0.0 de GARR_CONSEJO_EAD queda archivada, no mutada", async () => {
    const { data: todas, error } = await garr
      .from("rule_pack_versions")
      .select("version, is_active, status, payload")
      .eq("pack_id", "GARR_CONSEJO_EAD");
    expect(error).toBeNull();

    // Invariante que se exige SIEMPRE, venga el pack de migración o de seed:
    // exactamente una versión activa, y es la 1.1.0.
    const activas = todas.filter((v) => v.is_active);
    expect(activas).toHaveLength(1);
    expect(activas[0].version).toBe("1.1.0");

    // Este Cloud se provisiona por migraciones, así que la v1.0.0 existe y
    // debe quedar archivada. (Un entorno provisionado solo por seed nunca
    // llega a crearla: el seed escribe ya la 1.1.0. Por eso el gate duro es la
    // invariante de arriba y no la existencia de la fila vieja.)
    const v100 = todas.find((v) => v.version === "1.0.0");
    expect(v100).toBeDefined();
    expect(v100.is_active).toBe(false);
    expect(v100.status).toBe("DEPRECATED");

    // "No mutada" se comprueba por contenido POSITIVO, no por ausencia de la
    // clave nueva: `toBeUndefined()` a secas pasaría igual con el payload
    // vaciado, a null o sustituido por otro pack (hallazgo P1 de la review).
    expect(v100.payload?.id).toBe("GARR_CONSEJO_EAD");
    expect(v100.payload?.votacion?.mayoria?.CONSEJO?.referencia).toBe("art. 247.1 LSC");
    expect(v100.payload?.convocatoria?.antelacionDias?.SA?.referencia).toBe(
      "art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente",
    );
    expect(v100.payload?.reglaEspecifica?.canalAcuseConsejo?.semanticaAcuse).toBe(
      "EAD_INTERPOSICION_ETIQUETADA",
    );
    // Y la clave nueva NO se le ha colado.
    expect(v100.payload?.reglaEspecifica?.antelacionConsejo).toBeUndefined();
  });

  // Sonda extra recomendada por el brief (art. 4.3 Ley 2/2007): el
  // administrador único de la matriz también debe figurar en el censo de
  // socios profesionales — es la invariante de composición que sostiene por
  // qué la mayoría de socios profesionales del overlay NO es una cita
  // decorativa. Verificado empíricamente contra Cloud antes de escribir este
  // test: hoy hay exactamente un ADMIN_UNICO en el tenant Garrigues (Vives,
  // matriz), así que .maybeSingle() sin filtro de entity_id es seguro, igual
  // que en garrigues-gobierno-seed.test.ts.
  it("art. 4.3 Ley 2/2007 — el administrador único de la matriz (Vives) figura también en el censo de socios profesionales", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data: adminUnico, error: eAdmin } = await garr
      .from("condiciones_persona")
      .select("person_id, person:person_id(full_name)")
      .eq("tipo_condicion", "ADMIN_UNICO")
      // to-ONE por la FK: PostgREST devuelve objeto, no array (ver nota gemela
      // en garrigues-gobierno-seed.test.ts).
      .maybeSingle<{ person_id: string; person: { full_name: string } | null }>();
    expect(eAdmin).toBeNull();
    expect(adminUnico?.person?.full_name).toBe("Fernando Vives Ruiz");

    const { data: socio, error: eSocio } = await garr
      .from("condiciones_persona")
      .select("id")
      .eq("tipo_condicion", "SOCIO")
      .eq("estado", "VIGENTE")
      .eq("person_id", adminUnico?.person_id ?? "")
      .maybeSingle();
    expect(eSocio).toBeNull();
    expect(socio?.id).toBeTruthy();
  });
});
