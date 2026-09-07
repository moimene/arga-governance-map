import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

/**
 * B1 — Forma de la migración multirrégimen/FRIA antes de aplicarla.
 *
 * Esta migración estuvo commiteada y sin aplicar durante un día con un P0:
 * sus diez políticas RLS hardcodeaban el tenant de ARGA, de modo que el tenant
 * Garrigues habría quedado fuera de sus propias tablas. La migración que debía
 * habilitar el módulo era la que se lo impedía.
 *
 * El gate asierta sobre el SQL EJECUTABLE, no sobre los comentarios: documentar
 * por qué se retiró algo es valioso y no es lo mismo que hacerlo.
 */
const RUTA = "supabase/migrations/20260828190000_aims_multiregime_incidents_and_fria.sql";
const sqlEjecutable = () => readFileSync(RUTA, "utf8").replace(/^\s*--.*$/gm, "");

/**
 * Derivadas del propio SQL, no enumeradas. Una lista literal deja entrar una
 * tabla nueva sin política sin que el gate se entere — y este commit aplaza
 * precisamente la tabla del art. 27.1(e).
 */
function tablasDelSql(): string[] {
  return [...sqlEjecutable().matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/g)].map((m) => m[1]);
}

describe("B1 — la migración aísla por el tenant de la sesión", () => {
  it("ninguna política se anula con una condición siempre cierta", () => {
    // `USING (tenant_id = fn_current_tenant_id() OR true)` cumplía todas las
    // demás aserciones y dejaba a cualquier autenticado leer todos los tenants.
    for (const pol of sqlEjecutable().match(/CREATE POLICY[\s\S]*?;/g) ?? []) {
      expect(/\bOR\s+true\b|USING\s*\(\s*true\s*\)|WITH CHECK\s*\(\s*true\s*\)/i.test(pol),
        `política anulada: ${pol.slice(0, 90)}`).toBe(false);
    }
  });

  it("las políticas se pueden reaplicar sin romper", () => {
    // 36 de las 53 migraciones del repo con CREATE POLICY hacen DROP antes.
    // PG no tiene CREATE POLICY IF NOT EXISTS: sin el DROP, una aplicación a
    // medias —que es el historial de este proyecto— deja la migración
    // irrepetible.
    const sql = sqlEjecutable();
    const creadas = (sql.match(/CREATE POLICY/g) ?? []).length;
    const soltadas = (sql.match(/DROP POLICY IF EXISTS/g) ?? []).length;
    expect(soltadas, `${creadas} políticas creadas y sólo ${soltadas} con DROP previo`)
      .toBeGreaterThanOrEqual(creadas);
  });

  it("ninguna política hardcodea un tenant", () => {
    // Buscar `tenant_id = '0000…'` dejaba pasar `IN ('0000…'::uuid)`, que es la
    // forma natural de escribirlo si alguien "arregla" el aislamiento a mano.
    for (const pol of sqlEjecutable().match(/CREATE POLICY[\s\S]*?;/g) ?? []) {
      expect(/'[0-9a-f]{8}-[0-9a-f]{4}-/i.test(pol),
        `política con un tenant en duro: ${pol.slice(0, 90)}`).toBe(false);
    }
  });

  it("toda tabla creada tiene política con fn_current_tenant_id y TO authenticated", () => {
    const sql = sqlEjecutable();
    const tablas = tablasDelSql();
    expect(tablas.length, "la migración no crea ninguna tabla").toBeGreaterThanOrEqual(10);
    for (const t of tablas) {
      const m = sql.match(new RegExp(`CREATE POLICY ${t}_tenant_isolation[\\s\\S]*?;`));
      expect(m, `${t} no tiene política de aislamiento`).not.toBeNull();
      const pol = m![0];
      expect(/TO authenticated/.test(pol), `${t}: la política se crea contra PUBLIC`).toBe(true);
      expect((pol.match(/fn_current_tenant_id\(\)/g) ?? []).length,
        `${t}: falta USING o WITH CHECK con el tenant de sesión`).toBeGreaterThanOrEqual(2);
    }
  });

  it("RLS habilitada en toda tabla creada", () => {
    const sql = sqlEjecutable();
    const tablas = tablasDelSql();
    // Sin ancla, un cambio que vaciara `tablasDelSql()` dejaría este bucle
    // asertando sobre cero tablas y pasando por verde.
    expect(tablas.length, "la migración no crea ninguna tabla").toBeGreaterThanOrEqual(10);
    for (const t of tablas) {
      expect(sql, `${t} sin RLS`).toContain(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    }
  });
});

describe("B1 — no se hornean capacidades que no existen", () => {
  it("no hay columnas de sello ni canal de entrega certificada", () => {
    const sql = sqlEjecutable();
    // El módulo no llama a ningún prestador de confianza: 0 imports de cliente,
    // 0 fetch, 0 functions.invoke. Declararlo en el schema lo daba por hecho.
    for (const re of [/qseal_token/, /tsq_token/, /ERDS/]) {
      expect(re.test(sql), `el schema sigue horneando ${re}`).toBe(false);
    }
  });

  it("el órgano de gobierno es una arista, no un rótulo", () => {
    const sql = sqlEjecutable();
    expect(/governance_body_id\s+uuid\s+REFERENCES\s+governing_bodies/.test(sql),
      "el órgano no es FK contra governing_bodies").toBe(true);
    expect(/DEFAULT\s+'COMITE_RIESGOS'/.test(sql),
      "sobrevive el default de ownership de otro tenant").toBe(false);
  });
});

describe("B1 — las FK llevan coherencia de tenant", () => {
  it("ninguna FK hacia un padre de la propia migración es de una sola columna", () => {
    // Sin coherencia de tenant, el tenant B puede colgar una fila del padre del
    // tenant A y pasar el WITH CHECK: la política sólo mira el `tenant_id`
    // propio, nunca el del padre. En un producto cuyo argumento es el
    // aislamiento, eso no se mergea con una nota.
    const sql = sqlEjecutable();
    const simples = sql.match(
      /\b(fria_id|incident_regime_id|incident_id|system_id|version_id)\s+uuid[^,]*REFERENCES\s+(aims_|ai_)/g,
    ) ?? [];
    expect(simples, `FK sin coherencia de tenant: ${simples.join(" | ")}`).toEqual([]);
  });

  it("los padres exponen (tenant_id, id) para poder ser referenciados así", () => {
    const sql = sqlEjecutable();
    for (const padre of ["aims_incident_regimes", "aims_fria_assessments"]) {
      const bloque = sql.slice(sql.indexOf(`CREATE TABLE IF NOT EXISTS ${padre} (`));
      expect(/UNIQUE \(tenant_id, id\)/.test(bloque.slice(0, bloque.indexOf(");"))),
        `${padre} no expone (tenant_id, id)`).toBe(true);
    }
    for (const previo of ["ai_incidents", "ai_systems", "aims_system_versions"]) {
      // `toContain("ALTER TABLE x")` lo satisface CUALQUIER ALTER: sustituir la
      // clave compuesta por un ADD COLUMN dejaba el gate verde y a las hijas sin
      // padre al que colgarse por (tenant_id, id).
      expect(new RegExp(`ALTER TABLE ${previo}[^;]{0,200}?UNIQUE \\(tenant_id, id\\)`).test(sql),
        `${previo} no expone UNIQUE (tenant_id, id)`).toBe(true);
    }
  });

  it("las FK hacia superficie compartida quedan DECLARADAS como deuda", () => {
    // `entities`, `evidence_bundles` y `governing_bodies` no tienen
    // UNIQUE(tenant_id, id) y no son superficie de este carril: la coherencia
    // no puede cerrarse aquí. Se declara en el propio fichero para que no pase
    // por resuelta.
    const conComentarios = readFileSync(RUTA, "utf8");
    for (const t of ["entities", "evidence_bundles", "governing_bodies"]) {
      const i = conComentarios.indexOf(`REFERENCES ${t}(id)`);
      expect(i, `no se referencia ${t}`).toBeGreaterThan(0);
      expect(/DEUDA DECLARADA/.test(conComentarios.slice(Math.max(0, i - 500), i)),
        `la FK a ${t} no declara su deuda de coherencia de tenant`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-07 — n=1005 / gate vacuo nº9.
//
// El bloque de arriba se titula «la migración aísla por el tenant de la sesión»
// pero su RUTA es UN fichero. No podía ponerse rojo por los 16 literales de
// ARGA que seguían vivos en `20260418154408_fase4_ai_governance_tables.sql` y
// `20260426151000_000043_aims360_core.sql`, que es donde estaba el defecto: el
// repo decía una cosa y Cloud —medido el 2026-09-07 en `pg_policies`— otra.
//
// El historial es forward-only: esos dos ficheros SIGUEN teniendo el literal y
// no se reescriben. Lo que se vigila es lo que el repo AFIRMA hoy, o sea la
// ÚLTIMA definición de cada política: si la última cablea un tenant, el repo
// está diciendo que el aislamiento de esa tabla es de ARGA y de nadie más.
const MIGRACIONES = "supabase/migrations";

interface DefinicionPolitica {
  fichero: string;
  tabla: string;
  politica: string;
  cuerpo: string;
}

/** Última definición de cada política `ai_*`/`aims_*` en el orden del historial. */
function ultimasPoliticasIa(): Map<string, DefinicionPolitica> {
  const ficheros = readdirSync(MIGRACIONES).filter((f) => f.endsWith(".sql")).sort();
  const ultima = new Map<string, DefinicionPolitica>();
  for (const fichero of ficheros) {
    const sql = readFileSync(`${MIGRACIONES}/${fichero}`, "utf8").replace(/^\s*--.*$/gm, "");
    for (const m of sql.matchAll(/CREATE POLICY\s+"?([\w]+)"?\s+ON\s+(?:public\.)?"?(\w+)"?/g)) {
      const [, politica, tabla] = m;
      if (!/^(ai|aims)_/.test(tabla)) continue;
      // Sin `;` fiable: 000043 separa sentencias por línea en blanco. Se corta
      // por lo primero que aparezca.
      const resto = sql.slice(m.index!);
      const fin = Math.min(
        ...[resto.indexOf(";"), resto.search(/\n[ \t]*\n/)].filter((i) => i > 0),
      );
      ultima.set(`${tabla}.${politica}`, {
        fichero,
        tabla,
        politica,
        cuerpo: resto.slice(0, Number.isFinite(fin) ? fin : resto.length),
      });
    }
  }
  return ultima;
}

describe("2026-09-07 — el repo dice de las RLS de IA lo que dice Cloud", () => {
  it("el barrido ve el historial que dice ver (control positivo)", () => {
    // Aserción de ausencia dentro de un bucle: si el barrido dejara de
    // encontrar políticas, «ninguna cablea un tenant» pasaría por ceguera.
    const todas = ultimasPoliticasIa();
    expect(todas.size, "el barrido no encuentra políticas ai_*/aims_*").toBeGreaterThanOrEqual(16);
    for (const clave of [
      "ai_systems.tenant_isolation",
      "ai_incidents.tenant_isolation",
      "aims_technical_file_sections.aims_technical_file_sections_tenant_isolation",
    ]) {
      expect([...todas.keys()], `${clave} ha salido del barrido`).toContain(clave);
    }
    // Y el barrido tiene que ver el HISTORIAL, no un fichero: las definiciones
    // vigentes salen de más de un `.sql`.
    expect(new Set([...todas.values()].map((d) => d.fichero)).size).toBeGreaterThan(1);
  });

  it("ninguna política vigente de ai_*/aims_* cablea un tenant", () => {
    const culpables = [...ultimasPoliticasIa().values()].filter((d) =>
      /'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/i.test(d.cuerpo),
    );
    expect(
      culpables.map((d) => `${d.tabla}.${d.politica} (${d.fichero})`),
      "la última definición de estas políticas cablea un tenant: el tenant nuevo queda " +
        "fuera de sus propias tablas y el repo deja de decir lo que Cloud dice",
    ).toEqual([]);
  });

  it("y toda política vigente resuelve el tenant de la sesión", () => {
    // Quitar el literal no basta: `USING (true)` también lo quita.
    for (const d of ultimasPoliticasIa().values()) {
      expect(
        /fn_current_tenant_id\(\)/.test(d.cuerpo),
        `${d.tabla}.${d.politica} (${d.fichero}) no resuelve el tenant de la sesión`,
      ).toBe(true);
    }
  });
});
