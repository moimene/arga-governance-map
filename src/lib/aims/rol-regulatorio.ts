/**
 * Rol regulatorio y clasificación motivada de un sistema de IA.
 *
 * Módulo hoja (no importa nada) porque lo usan el alta, la ficha del sistema y
 * el perfil de aplicabilidad del autodiagnóstico.
 *
 * POR QUÉ EXISTE
 * --------------
 * El alta pedía «nivel de riesgo» en un desplegable libre con «Alto»
 * preseleccionado, y no preguntaba en absoluto qué papel juega la entidad
 * respecto al sistema. Las obligaciones del Reglamento (UE) 2024/1689 se
 * determinan por POSICIÓN REGULATORIA —quién controla modelo, datos, registros
 * y finalidad—, no por taxonomía técnica. Sin el rol no se puede saber qué
 * catálogo de medidas aplica, y medir a un responsable del despliegue contra el
 * catálogo de un proveedor de alto riesgo produce un porcentaje que no
 * significa nada.
 *
 * QUÉ QUEDA AQUÍ Y QUÉ NO
 * -----------------------
 * Sólo el catálogo de roles y sus etiquetas. Las preguntas, la derivación del
 * rol y del nivel, y lo que impide confirmar viven en la hoja
 * `cuestionario-calificacion.ts`, que es de donde los leen el alta, la ficha y
 * el informe. Tener dos derivaciones era tener dos calificaciones jurídicas
 * distintas del mismo sistema según la pantalla que se mirase.
 */

export type RolRegulatorio =
  | "PROVEEDOR"
  | "RESPONSABLE_DESPLIEGUE"
  | "IMPORTADOR"
  | "DISTRIBUIDOR"
  | "PROVEEDOR_GPAI"
  | "PROVEEDOR_POSTERIOR";

export type NivelRiesgo = "Inaceptable" | "Alto" | "Limitado" | "Mínimo";

export const ROLES_REGULATORIOS: {
  code: RolRegulatorio;
  label: string;
  articulo: string;
  ayuda: string;
}[] = [
  {
    code: "RESPONSABLE_DESPLIEGUE",
    label: "Responsable del despliegue",
    articulo: "Art. 3.4",
    ayuda:
      "Usa el sistema bajo su propia autoridad en el ejercicio de su actividad profesional. Es el papel habitual de quien contrata una herramienta de un tercero.",
  },
  {
    code: "PROVEEDOR",
    label: "Proveedor",
    articulo: "Art. 3.3",
    ayuda:
      "Desarrolla el sistema —o lo hace desarrollar— y lo introduce en el mercado o lo pone en servicio con su nombre o marca.",
  },
  {
    code: "PROVEEDOR_GPAI",
    label: "Proveedor de modelo de uso general",
    articulo: "Cap. V",
    ayuda: "Introduce en el mercado un modelo de IA de uso general (GPAI).",
  },
  {
    code: "PROVEEDOR_POSTERIOR",
    label: "Proveedor posterior",
    articulo: "Art. 3.68",
    ayuda:
      "Integra un modelo de uso general en un sistema propio que introduce en el mercado.",
  },
  {
    code: "IMPORTADOR",
    label: "Importador",
    articulo: "Art. 3.6",
    ayuda:
      "Está establecido en la Unión e introduce en el mercado un sistema que lleva el nombre o la marca de una entidad de un tercer país.",
  },
  {
    code: "DISTRIBUIDOR",
    label: "Distribuidor",
    articulo: "Art. 3.7",
    ayuda:
      "Comercializa el sistema en la Unión sin ser ni el proveedor ni el importador.",
  },
];

export const ETIQUETA_ROL: Record<RolRegulatorio, string> = Object.fromEntries(
  ROLES_REGULATORIOS.map((r) => [r.code, r.label]),
) as Record<RolRegulatorio, string>;
