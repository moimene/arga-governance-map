// scripts/garrigues/penal/generar-catalogo.ts
// Regenera scripts/garrigues/penal/mapa-penal.ts desde los PDF fuente.
// Se ejecuta a mano cuando cambia la fuente; el fichero generado se revisa y
// se commitea. Uso: bun run scripts/garrigues/penal/generar-catalogo.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { extraerMapa, AREAS_NEGOCIO, DEPARTAMENTOS_INTERNOS, PDF_AREAS, PDF_DEPTOS, type Celda } from "./extract-mapa";

const areas = extraerMapa(PDF_AREAS, AREAS_NEGOCIO);
const deptos = extraerMapa(PDF_DEPTOS, DEPARTAMENTOS_INTERNOS);

if (areas.filas.length !== deptos.filas.length)
  throw new Error(`los mapas no tienen las mismas filas: ${areas.filas.length} vs ${deptos.filas.length}`);

const banda = (cs: Celda[]) =>
  cs.includes("ROJO") ? "ROJO"
  : cs.includes("NARANJA") ? "NARANJA"
  : cs.includes("AMARILLO") ? "AMARILLO"
  // Los dos verdes se colapsan: su orden relativo no está publicado.
  : cs.some((c) => c === "VERDE_CLARO" || c === "VERDE_INTENSO") ? "VERDE"
  : "NO_EVALUADA";

const zip = (cols: readonly string[], cs: Celda[]) =>
  Object.fromEntries(cols.map((c, i) => [c, cs[i]]));

const delitos = areas.filas.map((f, i) => ({
  codigo: `RSK-GARR-PEN-${String(i + 1).padStart(3, "0")}`,
  articulo: f.articulo,
  delito: f.delito || f.articulo,
  banda: banda([...f.celdas, ...deptos.filas[i].celdas]),
  areas_negocio: zip(AREAS_NEGOCIO, f.celdas),
  departamentos_internos: zip(DEPARTAMENTOS_INTERNOS, deptos.filas[i].celdas),
}));

const altas = areas.filas.flatMap((f, i) =>
  f.celdas.flatMap((c, j) =>
    c === "NARANJA" || c === "ROJO"
      ? [{ codigo: delitos[i].codigo, delito: f.delito || f.articulo, columna: AREAS_NEGOCIO[j], celda: c }]
      : [],
  ),
);

const cab = `// scripts/garrigues/penal/mapa-penal.ts
// GENERADO por scripts/garrigues/penal/generar-catalogo.ts — no editar a mano.
// Fuente: Mapa de riesgos penales evaluado 2025 (áreas de negocio + departamentos
// internos). Los PDF están en .gitignore y no viajan con el repo, por eso este
// módulo es la única fuente de verdad del seed.
//
// El nivel es color, no texto: la fuente no publica leyenda ni criterio de
// bandas, y PPD-01 tampoco los documenta. Por eso las bandas no tienen nombre
// y los dos verdes se sirven colapsados a nivel de delito.
import type { Celda } from "./extract-mapa";

export type Banda = "ROJO" | "NARANJA" | "AMARILLO" | "VERDE" | "NO_EVALUADA";
export type DelitoPenal = {
  codigo: string; articulo: string; delito: string; banda: Banda;
  areas_negocio: Record<string, Celda>;
  departamentos_internos: Record<string, Celda>;
};

export const MAPA_PENAL: readonly DelitoPenal[] = `;

writeFileSync(
  join(import.meta.dir, "mapa-penal.ts"),
  `${cab}${JSON.stringify(delitos, null, 2)} as const;\n\n` +
  `export const CELDAS_BANDA_ALTA = ${JSON.stringify(altas, null, 2)} as const;\n`,
);
console.log(`escritas ${delitos.length} filas, ${altas.length} celdas de banda alta`);
