import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * MOI-170 — F2, carril A (capa de base de datos). Forma de las 6 migraciones
 * ANTES de aplicarlas, sobre el SQL EJECUTABLE (sin comentarios).
 *
 * Capa DÉBIL, como el resto de `*-migration-shape.test.ts` de este directorio:
 * un regex comprueba que el fichero dice lo que se espera, no que lo haga. La
 * capa fuerte es el bloque `do $verificacion$` de cada migración (que ABORTA
 * con sondas de comportamiento revertidas) y el ensayo acumulado
 * `supabase/migrations/proposed/20260927130000_f2_carril_a.probe.sql`
 * (ejecutado con `/tmp/probe_rollback.py`, exit=0).
 */
const DIR = "supabase/migrations";
const A1 = `${DIR}/20260927130000_f2_a1_aims_sujetos_especialidades.sql`;
const A2 = `${DIR}/20260927131000_f2_a2_ai_columnas_sujeto.sql`;
const A4 = `${DIR}/20260927132000_f2_a4_aims_rbac_capacidades.sql`;
const A3 = `${DIR}/20260927133000_f2_a3_aims_rpc_sujetos.sql`;
const A5 = `${DIR}/20260927134000_f2_a5_aims_cuatro_ojos_v2.sql`;
const A6 = `${DIR}/20260927135000_f2_a6_aims_rpc_especialidad.sql`;
const ejecutable = (ruta: string) => readFileSync(ruta, "utf8").replace(/^\s*--.*$/gm, "");

describe("F2 carril A — orden de aplicación y presencia de las 6 migraciones", () => {
  it("las seis existen, con sello de tiempo creciente en el orden A1,A2,A4,A3,A5,A6", () => {
    const orden = [A1, A2, A4, A3, A5, A6];
    for (const f of orden) {
      expect(() => readFileSync(f, "utf8"), `falta ${f}`).not.toThrow();
    }
    const sellos = orden.map((f) => f.match(/(\d{14})/)![1]);
    for (let i = 1; i < sellos.length; i++) {
      expect(sellos[i] > sellos[i - 1], `${orden[i]} no es posterior a ${orden[i - 1]}`).toBe(true);
    }
  });
});

describe("A1 (M02) — aims_ria_subjects / aims_specialty_bodies", () => {
  const sql = ejecutable(A1);

  it("tiene cuerpo (control positivo del instrumento)", () => {
    expect(sql.split("\n").length).toBeGreaterThan(150);
  });

  it("las dos tablas nacen con tenant_id NOT NULL sin DEFAULT (RS-TABLA 1)", () => {
    expect(sql).toMatch(/create table public\.aims_ria_subjects\s*\(\s*id uuid primary key default gen_random_uuid\(\),\s*tenant_id uuid not null,/);
    expect(sql).toMatch(/create table public\.aims_specialty_bodies\s*\(\s*id uuid primary key default gen_random_uuid\(\),\s*tenant_id uuid not null,/);
  });

  it("system_id y entity_id son ON DELETE RESTRICT hacia ai_systems/entities (RS-TABLA 9)", () => {
    expect(sql).toMatch(/system_id uuid not null references public\.ai_systems\(id\) on delete restrict/);
    expect(sql).toMatch(/entity_id uuid not null references public\.entities\(id\) on delete restrict/);
  });

  it("no hay model_id ni FK a aims_model_registry (deuda declarada, D-U7 fuera de carril)", () => {
    expect(sql).not.toMatch(/aims_model_registry/);
    expect(sql).not.toMatch(/\bmodel_id\b/);
  });

  it("revoca TODO de anon y authenticated antes de conceder solo SELECT (el esquema concede por defecto)", () => {
    for (const tabla of ["aims_ria_subjects", "aims_specialty_bodies"]) {
      expect(sql).toMatch(new RegExp(`revoke all on table public\\.${tabla} from public, anon, authenticated;`));
      expect(sql).toMatch(new RegExp(`grant select on table public\\.${tabla} to authenticated;`));
    }
    // Nunca INSERT/UPDATE/DELETE a authenticated sobre estas dos tablas: solo por RPC.
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|truncate)\s+on table public\.aims_ria_subjects/i);
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|truncate)\s+on table public\.aims_specialty_bodies/i);
  });

  it("hoja de elegibilidad (espejo de sujeto-juridico.ts): oficinas y sucursales quedan fuera", () => {
    expect(sql).toMatch(/function public\.fn_aims_entidad_puede_ser_sujeto/);
    expect(sql).toMatch(/'SUCURSAL', 'OFICINA', 'OFICINA_REPRESENTACION', 'DIVISION'/);
    expect(sql).toMatch(/v_clase in \('SOCIEDAD', 'FUNDACION'\)/);
  });

  it("verifica y aborta, con sondas negativas de elegibilidad y de tenant cruzado", () => {
    expect(sql).toMatch(/do \$verificacion\$/);
    for (const codigo of ["ENTIDAD_NO_ELEGIBLE%", "REFERENCIA_DE_OTRO_TENANT%"]) {
      expect(sql, `falta la sonda que espera ${codigo}`).toContain(`like '${codigo}'`);
    }
    expect(sql).toMatch(/raise exception 'SONDA_REVERTIDA'/);
  });
});

describe("A2 (M03) — columnas de sujeto, autoría por persona (E-01), guardias DS-32", () => {
  const sql = ejecutable(A2);

  it("tiene cuerpo (control positivo del instrumento)", () => {
    expect(sql.split("\n").length).toBeGreaterThan(200);
  });

  it("assessor_id y created_by NUNCA con DEFAULT auth.uid() (E-01)", () => {
    expect(sql).not.toMatch(/assessor_id[^,;]*default\s+auth\.uid\(\)/i);
    expect(sql).not.toMatch(/created_by uuid references public\.persons\(id\)[^,;]*default/i);
  });

  it("la persona sale del perfil de la sesión, con PERFIL_SIN_PERSONA si falta (E-01)", () => {
    expect(sql).toMatch(
      /select up\.person_id into v_persona\s+from public\.user_profiles up\s+where up\.user_id = auth\.uid\(\)\s+and up\.tenant_id = public\.fn_current_tenant_id\(\)/,
    );
    expect(sql).toMatch(/raise exception 'PERFIL_SIN_PERSONA:[^']*'\s+using errcode = '42501'/);
    expect(sql).toMatch(/new\.assessor_id := v_persona;/);
    expect(sql).toMatch(/new\.created_by := v_persona;/);
  });

  it("ai_incidents.entity_id es ON DELETE RESTRICT hacia entities (E-02 / RS-TABLA 9)", () => {
    expect(sql).toMatch(/entity_id uuid references public\.entities\(id\) on delete restrict/);
  });

  it("review_decision/review_motivation solo por RPC (flag aims.revision_rpc)", () => {
    expect(sql).toMatch(/current_setting\('aims\.revision_rpc', true\)/);
    expect(sql).toMatch(/raise exception 'REVISION_SOLO_POR_RPC:/);
  });

  it("inventory_kind guardado con su propio flag, distinto del de clasificación (E-08)", () => {
    expect(sql).toMatch(/current_setting\('aims\.inventario_rpc', true\)/);
    expect(sql).toMatch(/raise exception 'INVENTARIO_SOLO_POR_RPC:/);
    // Y el trigger existente de clasificación se amplía a prohibited_practice_status.
    expect(sql).toMatch(/before insert or update of regulatory_role, risk_level, prohibited_practice_status on public\.ai_systems/);
  });

  it("la calificación del incidente (art. 73) solo por RPC", () => {
    expect(sql).toMatch(/current_setting\('aims\.calificacion_incidente_rpc', true\)/);
    expect(sql).toMatch(/raise exception 'CALIFICACION_SOLO_POR_RPC:/);
  });

  it("las dos vistas son security_invoker y sin anon", () => {
    expect(sql).toMatch(/create or replace view public\.v_aims_sistemas_por_entidad\s*\nwith \(security_invoker = on\)/);
    expect(sql).toMatch(/create or replace view public\.v_aims_sistemas_por_organo\s*\nwith \(security_invoker = on\)/);
    expect(sql).toMatch(/revoke all on public\.v_aims_sistemas_por_entidad from public, anon;/);
    expect(sql).toMatch(/revoke all on public\.v_aims_sistemas_por_organo from public, anon;/);
  });

  it("verifica y aborta, con al menos las sondas de autoría y de las 3 guardias", () => {
    expect(sql).toMatch(/do \$verificacion\$/);
    for (const codigo of ["PERFIL_SIN_PERSONA%", "REVISION_SOLO_POR_RPC%", "INVENTARIO_SOLO_POR_RPC%", "CLASIFICACION_SOLO_POR_CUESTIONARIO%"]) {
      expect(sql, `falta la sonda que espera ${codigo}`).toContain(`like '${codigo}'`);
    }
  });
});

describe("A4 (M04) — capacidades AIMS en capability_matrix + fn_aims_assert_capacidad", () => {
  const sql = ejecutable(A4);

  it("tiene cuerpo (control positivo del instrumento)", () => {
    expect(sql.split("\n").length).toBeGreaterThan(150);
  });

  it("añade las 9 capacidades al CHECK sin quitar las de Secretaría", () => {
    for (const accion of [
      "SNAPSHOT_CREATION", "CERTIFICATION", // Secretaría, deben seguir
      "AIMS_INVENTARIO", "AIMS_CLASIFICAR", "AIMS_EVALUAR", "AIMS_REVISAR",
      "AIMS_OBLIGACIONES", "AIMS_ENTREGABLE_APROBAR", "AIMS_INCIDENTE",
      "AIMS_REGISTRO", "AIMS_GOBIERNO",
    ]) {
      expect(sql, `falta ${accion} en el CHECK`).toContain(`'${accion}'`);
    }
  });

  it("CONSEJERO y AUDITOR se siembran en false para las 9 acciones AIMS", () => {
    expect(sql).toMatch(/insert into public\.capability_matrix \(role, action, enabled, reason\)\s*\n\s*values \('CONSEJERO', v_accion, false,/);
    expect(sql).toMatch(/insert into public\.capability_matrix \(role, action, enabled, reason\)\s*\n\s*values \('AUDITOR', v_accion, false,/);
  });

  it("fn_aims_assert_capacidad relanza el P0001 de fn_secretaria_assert_capability como 42501/AIMS_CAPACIDAD_DENEGADA", () => {
    expect(sql).toMatch(/perform public\.fn_secretaria_assert_capability\(public\.fn_current_tenant_id\(\), p_action\);/);
    expect(sql).toMatch(/exception when sqlstate 'P0001' then\s*\n\s*raise exception 'AIMS_CAPACIDAD_DENEGADA: %', sqlerrm using errcode = '42501';/);
  });

  it("ninguna política nueva es FOR ALL: SELECT, INSERT y UPDATE separados por tabla (evita el OR de dos permisivas)", () => {
    for (const tabla of ["ai_systems", "ai_incidents", "ai_risk_assessments", "ai_compliance_checks"]) {
      expect(sql, `${tabla} sin política de SELECT propia`).toMatch(new RegExp(`create policy ${tabla}(_[a-z]+)?_select on public\\.${tabla} for select`));
      const bloqueInsert = sql.match(new RegExp(`create policy ${tabla}(_[a-z]+)?_insert on public\\.${tabla} for insert[\\s\\S]*?;`));
      expect(bloqueInsert, `${tabla} sin política de INSERT`).not.toBeNull();
      expect(bloqueInsert![0], `${tabla}: el INSERT no exige capacidad`).toContain("fn_aims_tiene_capacidad");
    }
    expect(sql).not.toMatch(/create policy \w+ on public\.(ai_systems|ai_incidents|ai_risk_assessments|ai_compliance_checks) for all/i);
  });

  it("ai_systems conserva su DELETE tal cual (DA-16), sin capacidad exigida", () => {
    expect(sql).toMatch(/create policy ai_systems_delete on public\.ai_systems for delete\s*\n\s*using \(tenant_id = public\.fn_current_tenant_id\(\)\);/);
  });

  it("verifica y aborta, con el rechazo real de un CONSEJERO por RLS", () => {
    expect(sql).toMatch(/do \$verificacion\$/);
    expect(sql).toMatch(/set local role authenticated;/);
    expect(sql).toContain("row-level security");
  });
});

describe("A3 — fn_aims_proponer_sujeto / fn_aims_confirmar_sujeto", () => {
  const sql = ejecutable(A3);

  it("proponer exige AIMS_CLASIFICAR y confirmar exige AIMS_GOBIERNO", () => {
    expect(sql).toMatch(/function public\.fn_aims_proponer_sujeto/);
    expect(sql).toMatch(/perform public\.fn_aims_assert_capacidad\('AIMS_CLASIFICAR'\);/);
    expect(sql).toMatch(/function public\.fn_aims_confirmar_sujeto/);
    expect(sql).toMatch(/perform public\.fn_aims_assert_capacidad\('AIMS_GOBIERNO'\);/);
  });

  it("confirmar exige motivo y, si pasa a VIGENTE, responsable interno", () => {
    expect(sql).toMatch(/raise exception 'MOTIVO_OBLIGATORIO:/);
    expect(sql).toMatch(/raise exception 'RESPONSABLE_OBLIGATORIO:/);
  });

  it("un sistema de otro tenant se rechaza al proponer", () => {
    expect(sql).toMatch(/raise exception 'SISTEMA_DE_OTRO_TENANT:/);
  });

  it("sin EXECUTE para anon", () => {
    expect(sql).toMatch(/revoke all on function public\.fn_aims_proponer_sujeto\([^)]*\) from public, anon;/);
    expect(sql).toMatch(/revoke all on function public\.fn_aims_confirmar_sujeto\([^)]*\) from public, anon;/);
  });
});

describe("A5 — fn_aims_review_assessment v2, cuatro ojos en dominio persona", () => {
  const sql = ejecutable(A5);

  it("resuelve al revisor como PERSONA de la sesión, nunca como usuario", () => {
    expect(sql).toMatch(
      /select up\.person_id into v_revisor_persona\s*\n\s*from public\.user_profiles up\s*\n\s*where up\.user_id = auth\.uid\(\) and up\.tenant_id = v_tenant;/,
    );
    expect(sql).toMatch(/raise exception 'PERFIL_SIN_PERSONA:/);
  });

  it("compara redactor y evaluador SIEMPRE en dominio persona (E-01)", () => {
    expect(sql).toMatch(/v_revisor_persona is not distinct from v_row\.assessor_id\s*\n\s*or v_revisor_persona is not distinct from v_row\.created_by/);
    expect(sql).toMatch(/raise exception 'MISMO_REDACTOR:/);
    // frozen_by_id (usuario) se TRADUCE a persona antes de comparar; no se compara el usuario directamente.
    expect(sql).toMatch(/select up\.person_id into v_evaluador_persona\s*\n\s*from public\.user_profiles up\s*\n\s*where up\.user_id = v_row\.frozen_by_id/);
    expect(sql).toMatch(/raise exception 'MISMO_EVALUADOR:/);
    expect(sql).not.toMatch(/auth\.uid\(\)\s*=\s*v_row\.frozen_by_id/);
  });

  it("exige órgano acreditado del sujeto y membresía vigente", () => {
    expect(sql).toMatch(/raise exception 'SIN_ORGANO_ACREDITADO:/g);
    expect(sql).toMatch(/function public\.fn_aims_es_miembro_organo/);
    expect(sql).toMatch(/cp\.estado = 'VIGENTE'/);
    expect(sql).toMatch(/raise exception 'REVISOR_NO_MIEMBRO_ORGANO:/);
  });

  it("exige decisión explícita y no toca review_decision sin el flag de la propia RPC", () => {
    expect(sql).toMatch(/raise exception 'DECISION_INVALIDA:/);
    expect(sql).toMatch(/perform set_config\('aims\.revision_rpc', 'on', true\);/);
    expect(sql).toMatch(/perform set_config\('aims\.revision_rpc', '', true\);/);
  });

  it("no reescribe fn_aims_freeze_assessment (eso es A4)", () => {
    expect(sql).not.toMatch(/function public\.fn_aims_freeze_assessment/);
  });
});

describe("A6 — fn_aims_declarar_especialidad", () => {
  const sql = ejecutable(A6);

  it("exige AIMS_GOBIERNO y valida el catálogo cerrado de especialidades", () => {
    expect(sql).toMatch(/perform public\.fn_aims_assert_capacidad\('AIMS_GOBIERNO'\);/);
    expect(sql).toMatch(/'JURIDICO', 'TECNICO', 'RIESGOS', 'CIBERSEGURIDAD', 'DATOS'/);
    expect(sql).toMatch(/raise exception 'ESPECIALIDAD_INVALIDA:/);
  });

  it("el órgano tiene que ser del mismo tenant", () => {
    expect(sql).toMatch(/raise exception 'ORGANO_DE_OTRO_TENANT:/);
  });

  it("upsert idempotente por (tenant_id, especialidad)", () => {
    expect(sql).toMatch(/on conflict \(tenant_id, especialidad\) do update/);
  });
});
