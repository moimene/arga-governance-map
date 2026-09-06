// src/lib/grc/penal-taxonomia.ts
//
// Las cinco categorías del mapa penal y su REFERENCIA LEGAL. Viven fuera de la
// pantalla porque son dato, no presentación: así el gate de citas se ejecuta
// sobre el contenido en vez de sobre un grep del fuente de la página, y la
// página deja de exportar constantes (react-refresh/only-export-components).
//
// Módulo hoja: no importa nada del proyecto.

export interface DelitoCategory {
  id: string;
  title: string;
  lawRef: string;
  description: string;
  keywords: string[];
}

// Las cinco categorías NO traen ya riesgos ni controles de relleno. Los tenían:
// `fallbackRisks` / `fallbackControls` con pólizas, primas y reaseguro de una
// aseguradora, que se pintaban cuando la categoría no casaba nada del tenant —y
// el chip de cumplimiento se calculaba SOBRE ELLOS, así que un despacho veía
// «4. Fraude · CONFORME» sostenido por controles que no existen en ninguna
// tabla. Sin dato, estado vacío honesto y sin veredicto.
export const DELITOS_TAXONOMY: DelitoCategory[] = [
  {
    id: "cohecho-corrupcion",
    title: "1. Cohecho y Corrupción en los Negocios",
    lawRef: "Art. 286 bis, 419 CP | ISO 37001",
    description: "Previene sobornos, dádivas o favores a funcionarios públicos o entre particulares en relaciones comerciales.",
    keywords: ["cohecho", "corrupcion", "corrupción", "soborno", "regalo", "hospitalidad", "anticorrup"],
  },
  {
    id: "blanqueo-capitales",
    title: "2. Blanqueo de Capitales y Financiación de Terrorismo",
    lawRef: "Art. 301 CP | Ley 10/2010 SEPBLAC",
    description: "Previene la introducción en el tráfico financiero de fondos procedentes de actividades delictivas.",
    keywords: ["blanqueo", "aml", "terrorismo", "capitales", "sancion", "sanción", "kyc", "sepblac"],
  },
  {
    id: "delitos-informaticos",
    title: "3. Delitos Informáticos y Revelación de Secretos",
    lawRef: "Art. 197 bis, 264 CP | DORA RTS / GDPR",
    description: "Previene accesos no autorizados, daños en sistemas informáticos y la revelación indebida de datos confidenciales.",
    keywords: ["cyber", "ciber", "informatico", "informático", "acceso", "secreto", "revelacion", "revelación", "intrusion", "intrusión"],
  },
  {
    id: "fraude-hacienda",
    title: "4. Fraude, Estafa y Delitos contra la Hacienda Pública",
    lawRef: "Art. 248, 305 CP | LSC / Prevención de Fraude",
    description: "Previene el fraude en el reporte fiscal, la manipulación de balances contables y las declaraciones incorrectas ante Hacienda.",
    keywords: ["fraude", "estafa", "fiscal", "impuesto", "hacienda", "contabil", "balance", "tributario", "seguridad social"],
  },
  {
    id: "propiedad-intelectual",
    title: "5. Delitos contra la Propiedad Intelectual e Industrial",
    lawRef: "Arts. 270 y 273 a 274 CP | TRLPI (RDLeg 1/1996) y Ley 24/2015 de Patentes",
    description: "Previene la utilización o explotación no autorizada de obras protegidas, patentes o secretos industriales.",
    keywords: ["propiedad", "intelectual", "patente", "licencia", "software", "industrial", "marca", "copyright"],
  },
];
