// scripts/garrigues/gobierno/governance-catalog.ts
// Catálogo tipado del gobierno de la matriz (G2). Envuelve los datasets del
// Carril B y resuelve el matching comités↔censo. Los SOCIO de comités DEBEN
// resolver a un único nombre del censo (346); ambigüedades → MATCH_OVERRIDES.
import comitesJson from "./comites-2026.json";
import censoJson from "../censo/socios-acta-2026-05-06.json";
import eadJson from "../borme/ead-trust-sl.json";

export interface MiembroResuelto {
  nombreComite: string;
  nombreCanonico: string;
  categoria: string;
  rol?: string;
  esSocioCenso: boolean;
}

export interface EstructuraResuelta {
  slug: string; nombre: string; dependeDe: string[]; mision: string;
  mandatoAnios?: number; informePreceptivo?: boolean; incidencias?: string[];
  miembros: MiembroResuelto[];
}

export interface EadCargo {
  nombre: string;
  tipoCondicion: "PRESIDENTE" | "VICEPRESIDENTE" | "CONSEJERO" | "SECRETARIO" | "VICESECRETARIO";
  desde: string | null;
  metadata?: Record<string, unknown>;
  inscripcionRef?: string;
}

// Overrides curables: nombre tal como aparece en el comité → nombre exacto del censo.
// Se rellenan cuando el test de matching reporte AMBIGUO/SIN_MATCH.
export const MATCH_OVERRIDES: Record<string, string> = {
  // Match claro: "M." es abreviatura de "Mª" (María). El tokenizador no expande
  // abreviaturas y "ª" (U+00AA) no se descompone en NFD, así que el primer token
  // "m" nunca casa contra "mª". Único candidato en el censo con esos apellidos
  // completos (Ángeles Pérez de Ayala): grep -i "ayala" sobre el censo devuelve
  // una única fila, "Mª Angeles Pérez de Ayala Becerril" (línea 259 del JSON).
  "M. Angeles Pérez De Ayala": "Mª Angeles Pérez de Ayala Becerril",
};

// Excepciones documentadas: SOCIO de comité que NO está en el censo de la Junta
// (p. ej. socio no de cuota). Añadir SOLO con justificación; el test las respeta.
// Cada entrada se verificó con grep -i tolerante a tildes/grafías sobre
// socios-acta-2026-05-06.json (346 nombres): cero coincidencias del apellido
// distintivo en todo el fichero, ni como palabra completa ni como subcadena.
export const SOCIOS_SIN_CENSO: string[] = [
  // No localizado en el censo de la Junta — posible socio no de cuota o alta
  // posterior. "Rui" y "Valente" no aparecen ni una sola vez en el fichero.
  "Rui Valente",
  // No localizado en el censo de la Junta — posible socio no de cuota o alta
  // posterior. "Tenor" no aparece; los 3 "Ramón/Ramon" del censo (líneas
  // 319-321) son otras personas (Jareño Moreno, Javier Gómez Coll, Tejada
  // Fernández), ninguno "Jose Ramon Tenor".
  "Jose Ramon Tenor",
  // No localizado en el censo de la Junta — posible socio no de cuota o alta
  // posterior. "Corbera" no aparece (tampoco variantes "Corvera"/"Cordera");
  // los 9 "Ignacio" del censo llevan otros apellidos.
  "Ignacio Corbera",
  // No localizado en el censo de la Junta — posible socio no de cuota o alta
  // posterior. Ni "Dias" (palabra completa) ni "Lino" aparecen en el fichero
  // (nombre de pila y grafía portuguesa — Garrigues Portugal es entidad
  // separada de la matriz cuya Junta certifica este censo).
  "Mário Lino Dias",
  // No localizado en el censo de la Junta — posible socio no de cuota o alta
  // posterior. El único "Sousa" del censo es "Joao Paulo de Oliveira Vaz
  // Miranda de Sousa" (línea 192) — comparte "Joao"+"Sousa" pero no contiene
  // el apellido "Duarte", así que no es candidato (0, no ambiguo).
  "Joao Duarte De Sousa",
  // No localizado en el censo de la Junta — posible socio no de cuota o alta
  // posterior. Ni "Sofía"/"Sofia" ni "Lazcano"/"Lascano" aparecen en el
  // fichero.
  "Sofía Lazcano",
  // No localizado en el censo de la Junta — posible socio no de cuota o alta
  // posterior. Ni "Vasco" ni la grafía portuguesa "Rodrigues" (con "s")
  // aparecen; el censo solo tiene "Rodríguez"/"Rodriguez" (con "z") de otras
  // personas.
  "Vasco Rodrigues",
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.-]/g, " ").replace(/\s+/g, " ").trim();

export function matchCenso(nombreComite: string, censo: string[]): { estado: "UNICO" | "AMBIGUO" | "SIN_MATCH"; candidatos: string[] } {
  const tokens = norm(nombreComite).split(" ");
  const candidatos = censo.filter((c) => {
    const ct = norm(c).split(" ");
    // todos los tokens del nombre de comité aparecen, en orden, en el nombre del censo
    let i = 0;
    for (const t of tokens) {
      while (i < ct.length && ct[i] !== t) i += 1;
      if (i >= ct.length) return false;
      i += 1;
    }
    return true;
  });
  if (candidatos.length === 1) return { estado: "UNICO", candidatos };
  if (candidatos.length > 1) return { estado: "AMBIGUO", candidatos };
  return { estado: "SIN_MATCH", candidatos: [] };
}

export function loadGovernanceCatalog() {
  const presenciales = censoJson.presenciales as string[];
  const representados = censoJson.representados as string[];
  const todos = [...presenciales, ...representados];

  const estructuras: EstructuraResuelta[] = (comitesJson.estructuras as EstructuraResuelta[]).map((e) => ({
    ...e,
    miembros: (e.miembros as { nombre: string; categoria: string; rol?: string }[]).map((m) => {
      if (m.categoria !== "SOCIO") {
        return { nombreComite: m.nombre, nombreCanonico: m.nombre, categoria: m.categoria, rol: m.rol, esSocioCenso: false };
      }
      if (SOCIOS_SIN_CENSO.includes(m.nombre)) {
        return { nombreComite: m.nombre, nombreCanonico: m.nombre, categoria: m.categoria, rol: m.rol, esSocioCenso: false };
      }
      const override = MATCH_OVERRIDES[m.nombre];
      if (override) {
        return { nombreComite: m.nombre, nombreCanonico: override, categoria: m.categoria, rol: m.rol, esSocioCenso: true };
      }
      const res = matchCenso(m.nombre, todos);
      return {
        nombreComite: m.nombre,
        nombreCanonico: res.estado === "UNICO" ? res.candidatos[0] : m.nombre,
        categoria: m.categoria,
        rol: m.rol,
        esSocioCenso: res.estado === "UNICO",
      };
    }),
  }));

  return {
    estructuras,
    censo: { presenciales, representados, todos },
    adminUnico: {
      nombreCenso: "Fernando Vives Ruiz",
      fechaInicio: "2026-06-30",
      fechaFin: "2032-06-30",
      inscripcionRef: "Anuncio BORME 338618/2026, S 8, H M-190538, I/A 960",
      inscripcionFecha: "2026-07-13",
      nota: "Reelección por 6 años acordada por la Junta de 06/05/2026 (terminación anticipada del mandato que vencía 31/01/2028)",
    },
    seniorPartner: {
      nombreCenso: "Rosa Zarza Jimeno",
      cargoMetadata: "SENIOR_PARTNER",
      nota: "Cargo de supervisión (no órgano): preside el Consejo de Socios (art. 29 Estatutos), supervisa PPD y PBC/FT",
    },
    eadBoard: [
      { nombre: "Julián Ramón Inza Aldaz", tipoCondicion: "PRESIDENTE", desde: null },
      { nombre: "Eduardo Abad Valdenebro", tipoCondicion: "VICEPRESIDENTE", desde: null },
      { nombre: "Eduardo Inza Blasco", tipoCondicion: "CONSEJERO", desde: "2023-05-03", metadata: { consejero_delegado: true } },
      { nombre: "Cristina Mesa Sánchez", tipoCondicion: "CONSEJERO", desde: null },
      { nombre: "Moisés Menéndez Andrés", tipoCondicion: "CONSEJERO", desde: null },
      { nombre: "Roberto Delgado Gil", tipoCondicion: "SECRETARIO", desde: "2023-04-20", metadata: { no_consejero: true } },
      { nombre: "Belén Aguayo", tipoCondicion: "VICESECRETARIO", desde: null, metadata: { no_consejero: true, apellido_completo_pendiente: true } },
    ] as EadCargo[],
    fuenteEad: (eadJson as { fuente_captura?: string }).fuente_captura ?? "Cosecha BORME 2026-08-03",
  };
}
