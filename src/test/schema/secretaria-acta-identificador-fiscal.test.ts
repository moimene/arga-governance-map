import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// H-28 (MOI-15): fn_secretaria_build_minute_legal_manifest exigía
// entities.registration_number como único identificador fiscal de la
// sociedad. El alta societaria (SociedadNuevaStepper) guarda el NIF de la
// persona jurídica en persons.tax_id (via entities.person_id) y nunca
// rellena registration_number: las 3 sociedades del grupo nuevo (…0003) lo
// tienen NULL, así que generar el acta de CUALQUIER reunión de ese tenant
// fallaba con 400 "authoritative minute: entity, tax id, body and meeting
// officers require identified legal names".
//
// Este test falla si la función vuelve a resolver el identificador fiscal
// leyendo SOLO entities.registration_number (sin el fallback a
// persons.tax_id vía entities.person_id), que es exactamente la regresión
// que reabriría H-28.

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260928150000_secretaria_acta_identificador_fiscal.sql",
  ),
  "utf8",
);

function rpc(name: string): string {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const body = migration.indexOf("AS $function$", start);
  const end = migration.indexOf("$function$;", body);
  expect(body).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(body);
  return migration.slice(start, end + "$function$;".length);
}

describe("secretaria acta: identificador fiscal con fallback al NIF de la persona jurídica", () => {
  it("resuelve resolved_entity_tax_id con COALESCE(registration_number, persons.tax_id), nunca solo registration_number", () => {
    const manifest = rpc("fn_secretaria_build_minute_legal_manifest");

    // El fallback tiene que existir: NULLIF/btrim sobre registration_number
    // y un fallback al tax_id de la persona jurídica del entities.person_id.
    expect(manifest).toMatch(/NULLIF\(btrim\(e\.registration_number\),\s*''\)/);
    expect(manifest).toContain("entity_owner.tax_id");
    expect(manifest).toMatch(
      /LEFT JOIN public\.persons entity_owner[\s\S]{0,120}entity_owner\.id = e\.person_id[\s\S]{0,120}entity_owner\.tenant_id = e\.tenant_id/,
    );

    // La regresión exacta que reabriría H-28: volver a proyectar
    // registration_number en crudo, sin ningún fallback.
    expect(manifest).not.toMatch(/\be\.registration_number AS resolved_entity_tax_id\b/);

    // El gate que exige el identificador fiscal (y el resto de nombres
    // legales) sigue intacto: no se ha retirado la validación, solo se ha
    // cambiado de dónde se lee el dato.
    expect(manifest).toContain(
      "entity, tax id, body and meeting officers require identified legal names",
    );
    expect(manifest).toMatch(
      /COALESCE\(btrim\(v_meeting\.resolved_entity_tax_id\), ''\) = ''/,
    );
  });

  it("no toca la plantilla del acta ni rellena registration_number con ningún dato", () => {
    // No se inventa NIF ni se escribe en entities: el fix es puramente de
    // lectura (SELECT), sin ningún UPDATE/INSERT sobre entities.
    expect(migration).not.toMatch(/UPDATE\s+public\.entities/i);
    expect(migration).not.toContain("fn_secretaria_render_authoritative_minute");
    expect(migration).not.toContain("CREATE OR REPLACE FUNCTION public.fn_generar_acta");
  });

  it("lleva verificación que aborta la migración si el fix no queda aplicado", () => {
    expect(migration).toContain("do $verificacion_h28$");
    expect(migration).toContain("VERIFICACION H-28");
    // Control de cero-cambio ARGA y control del fix sobre el grupo nuevo,
    // ambos contra el identificador real medido en Cloud.
    expect(migration).toContain("6d7ed736-f263-4531-a59d-c6ca0cd41602");
    expect(migration).toContain("A-00001001");
    expect(migration).toContain("45c8df67-64c9-42a3-abff-8047dd23748b");
    expect(migration).toContain("A98765432");
  });
});
