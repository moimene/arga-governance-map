/**
 * Plantilla de ejemplo para descarga / preview del importador.
 *
 * Sprint 1 — Commit 6 (Task 6.5 Step 1).
 *
 * Este payload pasa `TemplateImportSchema.safeParse` y Gate PRE sin
 * BLOCKING en un tenant vacío. Sirve como base de partida para el
 * usuario del wizard ("Descargar plantilla base") y como referencia
 * documental del formato `secretaria.template_import.v1`.
 *
 * El JSON estático equivalente vive en
 * `public/templates/secretaria/plantilla-base-importacion.v1.json` y
 * debe mantenerse sincronizado con este objeto si se modifica.
 */

import type { TemplateImportPayload } from "./template-import-schema";

export const SAMPLE_IMPORT: TemplateImportPayload = {
  schema_version: "secretaria.template_import.v1",
  template: {
    tipo: "MODELO_ACUERDO",
    materia: "AUMENTO_CAPITAL",
    materia_acuerdo: "AUMENTO_CAPITAL",
    jurisdiccion: "ES",
    version: "1.0.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 295-316 LSC",
    snapshot_rule_pack_required: true,
  },
  capa1_inmutable:
    "PRIMERO.- Aprobar el aumento de capital social de {{entities.name}} en la cuantía de {{importe_aumento}} euros mediante la emisión de {{numero_acciones}} acciones de un valor nominal de {{valor_nominal}} euros cada una, conforme a los artículos 295 a 316 LSC.",
  capa2_variables: [
    { variable: "entities.name", fuente: "entities.*", condicion: "SIEMPRE" },
  ],
  capa3_editables: [
    {
      campo: "importe_aumento",
      obligatoriedad: "OBLIGATORIO",
      descripcion: "Importe nominal del aumento",
    },
    {
      campo: "numero_acciones",
      obligatoriedad: "OBLIGATORIO",
      descripcion: "Número de acciones emitidas",
    },
    {
      campo: "valor_nominal",
      obligatoriedad: "OBLIGATORIO",
      descripcion: "Valor nominal por acción (euros)",
    },
  ],
  notas_legal:
    "Plantilla base de ejemplo. Reemplazar antes de importar. Tras la importación queda en BORRADOR — Comité Legal debe aprobarla antes de activación.",
};
