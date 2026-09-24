// src/test/aims/formas-juridicas-medidas.ts
//
// F2.T1 — copia DECLARADA de las formas jurídicas de ARGA que hay en Cloud.
//
// ARGA no tiene catálogo en el repo (Garrigues sí: `scripts/garrigues/entities-catalog.ts`),
// así que su perímetro solo se conoce midiéndolo. Esta copia existe para que el
// test de unidad pueda correr sin red, y NO se la cree nadie por sí sola: el
// contraste con Cloud lo hace `src/test/schema/aims-sujeto-juridico-live.test.ts`
// con login real, y cae si la copia diverge en cualquiera de las dos direcciones
// —una forma nueva que aquí no está, o una de aquí que ya no está en Cloud—.
//
// Medido el 20-09-2026 sobre las 31 entidades del tenant `…0001`: 16 formas.
// La spec del programa decía 17; manda el dato.
export const FORMAS_ARGA_MEDIDAS = [
  "A.Ş.",
  "AG",
  "Corporation",
  "Fundación",
  "Inc.",
  "Ltd.",
  "PT",
  "S.A.",
  "S.A. de C.V.",
  "S.L.",
  "S.p.A.",
  "SICAV",
  "SLU",
  "SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE",
  "SOCIEDADE LIMITADA UNIPESSOAL",
  "SOCIEDADE POR QUOTAS UNIPESSOAL",
] as const;

/** Fecha de la medición, para que el informe de una divergencia diga desde cuándo. */
export const FORMAS_ARGA_MEDIDAS_EL = "2026-09-20";
