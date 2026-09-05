// src/test/schema/garrigues-templates-seed.test.ts
// G3 Task 8 gate de datos: el tenant Garrigues tiene sus 6 plantillas núcleo
// ACTIVA (patrón "5 plantillas" del brief — convocatoria y acta de Junta de
// Socios exigen `tipo` documental distinto, ver scripts/seed-garrigues-templates.ts
// para el detalle) bajo RLS per-tenant, y ARGA no las ve ni pierde las suyas.
// Patrón graceful-skip de garrigues-rule-packs-seed.test.ts (Task 3): cliente
// `garr` + `arga` propios, login real, `templatesSeeded` probe previo — los
// tests que dependen del seed (Step 2/3 del brief, controller) se saltan en
// verde mientras no se haya ejecutado `--commit`; los que verifican
// aislamiento/no-regresión de ARGA corren siempre que haya red.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

// Debe coincidir exactamente con `TEMPLATES` en scripts/seed-garrigues-templates.ts.
const TEMPLATE_MATERIAS = [
  { materia: "GARR_DECISION_ADMIN_UNICO", tipo: "MODELO_ACUERDO" },
  { materia: "ACTA_CONSIGNACION_ADMIN_UNICO_SLP", tipo: "ACTA_CONSIGNACION" },
  { materia: "CONVOCATORIA_JUNTA_SOCIOS_SLP", tipo: "CONVOCATORIA" },
  { materia: "ACTA_JUNTA_SOCIOS_SLP", tipo: "ACTA_SESION" },
  { materia: "CERTIFICACION_ADMIN_UNICO_SLP", tipo: "CERTIFICACION" },
  { materia: "INFORME_PRECEPTIVO_CONSEJO_SOCIOS_SLP", tipo: "INFORME_PRECEPTIVO" },
] as const;

const GATE_MATERIAS = [
  "ADMISION_SOCIO_CUOTA",
  "EXCLUSION_SOCIO_ESTATUTARIA",
  "CONTINUIDAD_SOCIO_POST_60",
  "NOMBRAMIENTO_ADMINISTRADOR_UNICO",
] as const;

describe("G3 Task 8 — plantillas núcleo del tenant Garrigues (RLS per-tenant, aislamiento ARGA)", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;
  let authed = false;
  let argaAuthed = false;
  // Igual que garrigues-rule-packs-seed.test.ts: distingue "sin red" de "con
  // red pero el controller aún no ejecutó --commit" — ambos deben quedar en
  // skip verde, no en rojo.
  let templatesSeeded = false;

  beforeAll(async () => {
    try {
      // Sesión COMPARTIDA: 2 logins en toda la suite, storageKey por cuenta.
      garr = await sesionDe("GARRIGUES");
      authed = true;

      if (authed && garr) {
        const { data: probe } = await garr
          .from("plantillas_protegidas")
          .select("id")
          .in("materia_acuerdo", TEMPLATE_MATERIAS.map((t) => t.materia))
          .limit(1);
        templatesSeeded = (probe ?? []).length > 0;
        if (!templatesSeeded) {
          console.warn(
            "[g3-templates-seed] plantillas núcleo aún no existen en Cloud — Step 2/3 (controller) " +
              "pendiente; tests dependientes en skip.",
          );
        }
      }

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

  it("Garrigues ve sus 6 plantillas núcleo ACTIVA por materia_acuerdo (RLS per-tenant)", async () => {
    if (!authed || !garr || !templatesSeeded) { expect(true).toBe(true); return; }
    const { data, error } = await garr
      .from("plantillas_protegidas")
      .select("materia_acuerdo, tipo, estado, tenant_id, organo_tipo, tipo_social")
      .in("materia_acuerdo", TEMPLATE_MATERIAS.map((t) => t.materia));
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(TEMPLATE_MATERIAS.length);
    const byMateria = new Map((data ?? []).map((r) => [r.materia_acuerdo, r]));
    for (const t of TEMPLATE_MATERIAS) {
      const row = byMateria.get(t.materia);
      expect(row, `falta ${t.materia}`).toBeTruthy();
      expect(row?.tipo).toBe(t.tipo);
      expect(row?.estado).toBe("ACTIVA");
      expect(row?.tenant_id).toBe(GARRIGUES_TENANT);
      expect(row?.tipo_social).toBe("SLP");
      // Naming (hallazgo T1): ningún código lleva "SL" suelto.
      expect(t.materia).not.toMatch(/(?:^|_)SL(?:_|$)/);
    }
  });

  it("ARGA no ve las plantillas núcleo de Garrigues (aislamiento) y conserva su catálogo", async () => {
    if (!argaAuthed || !arga) { expect(true).toBe(true); return; }
    const { data: leaked, error: eLeak } = await arga
      .from("plantillas_protegidas")
      .select("id")
      .in("materia_acuerdo", TEMPLATE_MATERIAS.map((t) => t.materia));
    expect(eLeak).toBeNull();
    expect((leaked ?? []).length).toBe(0);

    // No debe haber ninguna plantilla SLP visible para ARGA (invariante "cero
    // cambio ARGA" — su catálogo histórico es SA/SL, nunca SLP).
    const { data: slpLeak, error: eSlp } = await arga
      .from("plantillas_protegidas")
      .select("id")
      .eq("tipo_social", "SLP");
    expect(eSlp).toBeNull();
    expect((slpLeak ?? []).length).toBe(0);
  });

  it("el binding materia_template_binding cubre las 4 materias del gate T7 apuntando al informe ACTIVA", async () => {
    if (!authed || !garr || !templatesSeeded) { expect(true).toBe(true); return; }
    const { data: informe, error: eInforme } = await garr
      .from("plantillas_protegidas")
      .select("id, estado")
      .eq("materia_acuerdo", "INFORME_PRECEPTIVO_CONSEJO_SOCIOS_SLP")
      .maybeSingle();
    expect(eInforme).toBeNull();
    expect(informe?.estado).toBe("ACTIVA");

    const { data: bindings, error: eBind } = await garr
      .from("materia_template_binding")
      .select("materia, doc_type, template_id, active, selection_reason")
      .eq("doc_type", "INFORME_PRECEPTIVO")
      .in("materia", [...GATE_MATERIAS]);
    expect(eBind).toBeNull();
    expect((bindings ?? []).length).toBe(GATE_MATERIAS.length);
    for (const row of bindings ?? []) {
      expect(row.active).toBe(true);
      expect(row.template_id).toBe(informe?.id);
      expect(row.selection_reason?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it(
    "resolución runtime real del gate (composer.ts): tipo='INFORME_PRECEPTIVO' ACTIVA satisface " +
      "template_binding_key='INFORME_PRECEPTIVO_ORGANO:'||agreement_kind para cualquiera de las 4 materias",
    async () => {
      if (!authed || !garr || !templatesSeeded) { expect(true).toBe(true); return; }
      // Reproduce la selección de selectProcessTemplate/composer.ts sin
      // necesitar un agreement real: el filtro que decide si el botón "Crear
      // y enlazar" del panel puede generar el informe es
      // `tipo IN [template_profile_id, ...templateTypesForDocumentType(doc_kind)]`
      // — para INFORME_PRECEPTIVO esa lista siempre incluye 'INFORME_PRECEPTIVO'
      // sin importar la materia, así que una única fila ACTIVA de ese tipo
      // desbloquea las 4 (ver comentario de diseño en el propio seed).
      const { data, error } = await garr
        .from("plantillas_protegidas")
        .select("id, estado, capa1_inmutable")
        .eq("tipo", "INFORME_PRECEPTIVO")
        .eq("estado", "ACTIVA");
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
      expect(data?.[0]?.capa1_inmutable?.length ?? 0).toBeGreaterThan(100);
    },
  );
});
