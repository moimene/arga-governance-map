import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

/**
 * M01 (F1.T14) — forma de la migración de enlaces ANTES de aplicarla, sobre el
 * SQL EJECUTABLE (sin comentarios).
 *
 * Capa DÉBIL: un regex comprueba que el fichero dice lo que se espera, no que
 * lo haga. La capa fuerte es el bloque de verificación de la propia migración
 * —que ABORTA con sondas de comportamiento revertidas— y, una vez aplicada, el
 * test vivo `aims-checks-enlaces-live.test.ts`.
 *
 * Lo que vigila por encima de todo es la enmienda E-01: `checked_by_id` y
 * `assessor_id` son FK a `persons`, y `auth.uid()` es un usuario de Auth. Con un
 * `DEFAULT auth.uid()` ninguna evaluación se habría podido guardar en ninguno de
 * los dos tenants, y comparar un id de usuario con uno de persona deja el control
 * a cuatro ojos sin comprobar nada.
 */
const DIR = "supabase/migrations";
const M01 = `${DIR}/20260919100000_aims_checks_enlaces_evaluacion.sql`;
const ejecutable = (ruta: string) => readFileSync(ruta, "utf8").replace(/^\s*--.*$/gm, "");

const todas = readdirSync(DIR).filter((f) => f.endsWith(".sql")).map((f) => `${DIR}/${f}`);

/**
 * Columnas FK a `persons` que no pueden recibir un id de usuario de Auth,
 * DERIVADAS de lo que declaran las migraciones (`<col> uuid … references
 * persons` y `foreign key (<col>) references persons`), no escritas a mano.
 *
 * Por NOMBRE de columna: si el mismo nombre existe en otra tabla sin ser FK a
 * `persons`, el gate lo trata como si lo fuera. Es conservador a propósito.
 * No ve la asignación indirecta (`v := auth.uid(); new.x := v`): esa, y la
 * comparación de un id de usuario con uno de persona que pide E-01 para el
 * control a cuatro ojos, quedan para F2.T7.
 */
function columnasPersona(ficheros: string[]): string[] {
  const cols = new Set<string>();
  for (const f of ficheros) {
    const sql = ejecutable(f);
    for (const m of sql.matchAll(/\b([a-z_]+)\s+uuid(?:\s+not\s+null)?(?:\s+constraint\s+\w+)?\s+references\s+(?:public\.)?persons\b/gi)) cols.add(m[1].toLowerCase());
    for (const m of sql.matchAll(/foreign\s+key\s*\(\s*([a-z_]+)\s*\)\s*references\s+(?:public\.)?persons\b/gi)) cols.add(m[1].toLowerCase());
  }
  return [...cols].sort();
}
const COLUMNAS_PERSONA = columnasPersona(todas).join("|");
// `[^,;]` y no `[^;]`: con un universo amplio, `[^;]` cruzaría de una columna a
// otra dentro de un mismo CREATE TABLE.
const DEFAULT_USUARIO = new RegExp(`\\b(${COLUMNAS_PERSONA})\\b[^,;]*?default\\s+auth\\.uid\\(\\)`, "i");
const ASIGNA_USUARIO = new RegExp(`\\b(${COLUMNAS_PERSONA})\\s*:?=\\s*auth\\.uid\\(\\)`, "i");

describe("E-01 — ninguna migración mete un usuario de Auth en una columna FK a persons", () => {
  it("control positivo: el universo es el de las FK declaradas y los patrones casan con lo que prohíben", () => {
    const cols = COLUMNAS_PERSONA.split("|");
    // Las dos de M01 y otras de AIMS y de Secretaría: si la derivación se
    // rompiera, el universo encogería en silencio.
    for (const c of ["checked_by_id", "assessor_id", "assessed_by_id", "owner_id", "reviewed_by_id", "person_id"]) {
      expect(cols, `la derivación no ve ${c}`).toContain(c);
    }
    expect(cols.length).toBeGreaterThan(20);
    expect(DEFAULT_USUARIO.test("alter column checked_by_id set default auth.uid()")).toBe(true);
    expect(DEFAULT_USUARIO.test("add column assessor_id uuid default auth.uid()")).toBe(true);
    expect(DEFAULT_USUARIO.test("executed_by_id uuid references persons(id) default auth.uid()")).toBe(true);
    expect(ASIGNA_USUARIO.test("new.assessor_id := auth.uid();")).toBe(true);
    expect(ASIGNA_USUARIO.test("set checked_by_id = auth.uid()")).toBe(true);
    // Y no cruza columnas: el DEFAULT de otra columna del mismo CREATE no cuenta.
    expect(DEFAULT_USUARIO.test("create table t (owner_id uuid references persons(id), created_by uuid default auth.uid())")).toBe(false);
    expect(todas.length, "el universo de migraciones está vacío").toBeGreaterThan(100);
    expect(todas, "la migración M01 no está en el universo barrido").toContain(M01);
  });

  it("ni DEFAULT ni asignación de auth.uid() a una FK a persons en ninguna migración", () => {
    for (const f of todas) {
      const sql = ejecutable(f);
      expect(DEFAULT_USUARIO.test(sql), `${f}: DEFAULT auth.uid() sobre una FK a persons`).toBe(false);
      expect(ASIGNA_USUARIO.test(sql), `${f}: asigna auth.uid() a una FK a persons`).toBe(false);
    }
  });
});

describe("M01 — enlaces de comprobaciones y evaluación", () => {
  const sql = ejecutable(M01);

  it("el fichero tiene cuerpo (control positivo del instrumento)", () => {
    expect(sql.split("\n").length).toBeGreaterThan(120);
  });

  it("añade los dos enlaces, anulables y con ON DELETE RESTRICT (E-02)", () => {
    expect(sql).toMatch(
      /alter table public\.ai_compliance_checks\s+add column if not exists assessment_id uuid\s+constraint ai_compliance_checks_assessment_id_fkey\s+references public\.ai_risk_assessments\(id\) on delete restrict/,
    );
    expect(sql).toMatch(
      /alter table public\.ai_risk_assessments\s+add column if not exists questionnaire_id uuid\s+constraint ai_risk_assessments_questionnaire_id_fkey\s+references public\.aims_classification_questionnaires\(id\) on delete restrict/,
    );
    expect(sql, "una columna nueva no puede nacer NOT NULL: las legacy quedan NULL").not.toMatch(/(assessment_id|questionnaire_id) uuid not null/);
  });

  it("no rellena las legacy: ni backfill del enlace ni de la autoría", () => {
    // Fuera del bloque de verificación no se escribe dato. Dentro, las sondas
    // escriben en subtransacciones que se revierten siempre (SONDA_REVERTIDA).
    const ddl = sql.split("do $verificacion$")[0];
    expect(ddl.length, "control: el DDL precede al bloque de verificación").toBeLessThan(sql.length);
    expect(ddl).not.toMatch(/\bupdate\s+public\./i);
    expect(ddl).not.toMatch(/\binsert\s+into\b/i);
    expect(ddl).not.toMatch(/set\s+assessment_id\s*=/i);
    // En la verificación, la única escritura del enlace es la sonda 3.14 (una
    // fila de la propia sonda, por id, en una subtransacción revertida). Un
    // relleno de las legacy no tendría esta forma.
    const enlaces = sql.match(/set\s+assessment_id\s*=/gi) ?? [];
    const deSonda = sql.match(/set\s+assessment_id\s*=\s*v_\w+\s+where\s+id\s*=\s*v_\w+;/gi) ?? [];
    expect(deSonda.length, "control: la sonda que enlaza a una congelada sigue ahí").toBeGreaterThan(0);
    expect(enlaces.length, "escritura del enlace que no es una sonda puntual").toBe(deSonda.length);
    // Como sentencia (a principio de línea): la verificación nombra 'TRUNCATE'
    // como privilegio que comprueba, y eso no es borrar.
    expect(sql).not.toMatch(/^\s*(delete\s+from|truncate)\b/im);
    expect(/^\s*(delete\s+from|truncate)\b/im.test("  truncate public.ai_compliance_checks;"), "control del patrón").toBe(true);
  });

  it("la persona sale del perfil de la sesión, en su tenant, y sin ella se rechaza (E-01)", () => {
    expect(sql).toMatch(
      /select up\.person_id into v_persona\s+from public\.user_profiles up\s+where up\.user_id = auth\.uid\(\)\s+and up\.tenant_id = public\.fn_current_tenant_id\(\)/,
    );
    expect(sql).toMatch(/raise exception 'PERFIL_SIN_PERSONA:[^']*'\s+using errcode = '42501'/);
    // Pisa lo que mande el cliente: aceptar el suyo sería firmar por otro.
    expect(sql).toMatch(/new\.checked_by_id := v_persona;/);
    expect(sql).toMatch(/create trigger trg_aims_comprobacion_autoria_y_enlace\s+before insert or update on public\.ai_compliance_checks/);
  });

  it("el enlace no cruza sistemas: la evaluación y el cuestionario son del mismo sistema", () => {
    expect(sql).toMatch(/where a\.id = new\.assessment_id and a\.system_id = new\.system_id/);
    expect(sql).toMatch(/where q\.id = new\.questionnaire_id and q\.system_id = new\.system_id/);
    expect(sql).toMatch(/create trigger trg_aims_evaluacion_enlace_cuestionario\s+before insert or update on public\.ai_risk_assessments/);
  });

  it("una evaluación congelada no recibe comprobaciones ni se le cambian las que tiene", () => {
    // Sin esto, una sesión anexa por PostgREST un CONFORME a una evaluación ya
    // congelada, o corrige el estado de una suya, y el resultado vigente de lo
    // «que no se toca» cambia sin que cambie la fila congelada.
    const fn = sql.slice(
      sql.indexOf("create or replace function public.fn_aims_comprobacion_autoria_y_enlace()"),
      sql.indexOf("revoke all on function public.fn_aims_comprobacion_autoria_y_enlace()"),
    );
    expect(fn.length, "control: se aísla el cuerpo de la función").toBeGreaterThan(200);
    // Enlazar (alta o cambio de enlace) a una congelada.
    expect(fn).toMatch(/where a\.id = new\.assessment_id and a\.frozen_at is not null/);
    // Cambiar una comprobación de una congelada (salvo la autoría sin sesión: mantenimiento).
    expect(fn).toMatch(/where a\.id = old\.assessment_id and a\.frozen_at is not null/);
    expect((fn.match(/raise exception 'EVALUACION_CONGELADA:[^']*'[^;]*using errcode = '42501'/g) ?? []).length).toBe(2);
    // Sondas: la de alta, la de corrección y la ya existente del cuestionario.
    expect((sql.match(/not like 'EVALUACION_CONGELADA%'/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("no concede nada nuevo y cierra las funciones a anon", () => {
    expect(sql).not.toMatch(/\bgrant\b/i);
    expect(sql).toMatch(/revoke all on function public\.fn_aims_comprobacion_autoria_y_enlace\(\) from public, anon;/);
    expect(sql).toMatch(/revoke all on function public\.fn_aims_evaluacion_enlace_cuestionario\(\) from public, anon;/);
  });

  it("verifica y aborta, con sondas de comportamiento revertidas y control positivo", () => {
    expect(sql).toMatch(/do \$verificacion\$/);
    expect((sql.match(/raise exception 'VERIFICACION/g) ?? []).length).toBeGreaterThanOrEqual(12);
    // Negativos: sin persona, enlace ajeno, UPDATE de autoría, cuestionario ajeno, congelada.
    for (const codigo of ["PERFIL_SIN_PERSONA%", "EVALUACION_DE_OTRO_SISTEMA%", "COMPROBACION_INMUTABLE%", "CUESTIONARIO_DE_OTRO_SISTEMA%", "EVALUACION_CONGELADA%"]) {
      expect(sql, `falta la sonda que espera ${codigo}`).toContain(`not like '${codigo}'`);
    }
    // Positivos: la inserción legítima y el camino de mantenimiento entran (y se revierten).
    expect((sql.match(/raise exception 'SONDA_REVERTIDA'/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // Los claims simulados no sobreviven a la migración.
    expect(sql).toMatch(/perform set_config\('request\.jwt\.claims', '', true\);\s+raise notice 'VERIFICACION OK/);
  });
});
