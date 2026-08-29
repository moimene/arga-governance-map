// scripts/garrigues/penal/mapa-penal.ts
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

export const MAPA_PENAL: readonly DelitoPenal[] = [
  {
    "codigo": "RSK-GARR-PEN-001",
    "articulo": "156 bis",
    "delito": "Tráfico ilegal de Órganos Humanos",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-002",
    "articulo": "173.1",
    "delito": "Delitos contra la integridad moral: trato degradante, acoso laboral y acoso inmobiliario.",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_INTENSO",
      "Litigación y arbitraje": "VERDE_INTENSO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_INTENSO",
      "GLS": "VERDE_INTENSO"
    },
    "departamentos_internos": {
      "Intangibles": "VERDE_CLARO",
      "Servicio Médico": "VERDE_INTENSO",
      "Fundación Garrigues": "VERDE_INTENSO",
      "RRHH": "VERDE_INTENSO",
      "Asesoría jurídica": "VERDE_INTENSO",
      "Servicios Generales": "VERDE_INTENSO",
      "Tecnología": "VERDE_INTENSO",
      "Knowledge": "VERDE_INTENSO",
      "Financiero": "VERDE_INTENSO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-003",
    "articulo": "177 bis",
    "delito": "Trata de seres Humanos",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-004",
    "articulo": "184",
    "delito": "Delito de acoso sexual",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_INTENSO",
      "Litigación y arbitraje": "VERDE_INTENSO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_INTENSO",
      "GLS": "VERDE_INTENSO"
    },
    "departamentos_internos": {
      "Intangibles": "VERDE_INTENSO",
      "Servicio Médico": "VERDE_INTENSO",
      "Fundación Garrigues": "VERDE_INTENSO",
      "RRHH": "VERDE_INTENSO",
      "Asesoría jurídica": "VERDE_INTENSO",
      "Servicios Generales": "VERDE_INTENSO",
      "Tecnología": "VERDE_INTENSO",
      "Knowledge": "VERDE_INTENSO",
      "Financiero": "VERDE_INTENSO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-005",
    "articulo": "",
    "delito": "187. Prostitución de mayores de edad",
    "banda": "NO_EVALUADA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-006",
    "articulo": "187 y siguientes",
    "delito": "Delitos de prostitución 188. Prostitución de menores de edad o incapaces",
    "banda": "NO_EVALUADA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-007",
    "articulo": "",
    "delito": "189. Exhibicionismo de menores o incapaces. Incumplimiento del deber de impedir que continúe la prostitución",
    "banda": "NO_EVALUADA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-008",
    "articulo": "197, 197 bis y 197 ter",
    "delito": "Descubrimiento y revelación de secretos",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "AMARILLO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "AMARILLO",
      "Administrativo": "AMARILLO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "VERDE_INTENSO",
      "Servicio Médico": "VERDE_INTENSO",
      "Fundación Garrigues": "VERDE_INTENSO",
      "RRHH": "VERDE_INTENSO",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "VERDE_INTENSO",
      "Tecnología": "VERDE_INTENSO",
      "Knowledge": "VERDE_INTENSO",
      "Financiero": "VERDE_INTENSO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-009",
    "articulo": "",
    "delito": "248, 249 y 250. Estafa y circunstancias agravantes",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "AMARILLO",
      "Fiscal": "AMARILLO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "AMARILLO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "AMARILLO",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "VERDE_CLARO",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-010",
    "articulo": "",
    "delito": "251. Estafa sobre cosa mueble o inmueble y contratos simulados",
    "banda": "NARANJA",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "AMARILLO",
      "IP": "NARANJA",
      "Administrativo": "AMARILLO",
      "Mercantil": "AMARILLO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "VERDE_CLARO",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-011",
    "articulo": "",
    "delito": "257. Alzamiento de bienes",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "VERDE_CLARO",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "GRIS",
      "Tecnología": "VERDE_CLARO",
      "Knowledge": "VERDE_CLARO",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-012",
    "articulo": "257 y siguientes",
    "delito": "258. Presentación de relación de bienes incompleta o mendaz",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "VERDE_INTENSO",
      "Servicios Generales": "GRIS",
      "Tecnología": "VERDE_INTENSO",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_INTENSO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-013",
    "articulo": "",
    "delito": "258 bis. Uso de bienes embargados sin autorización",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-014",
    "articulo": "",
    "delito": "259 y 259 bis. Disposición de bienes en situación de insolvencia y circunstancias agravantes",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "AMARILLO",
      "Fiscal": "AMARILLO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "AMARILLO",
      "IP": "AMARILLO",
      "Administrativo": "GRIS",
      "Mercantil": "AMARILLO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "GRIS",
      "Tecnología": "VERDE_CLARO",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-015",
    "articulo": "259 y siguientes",
    "delito": "Insolvencias punibles 260. Pago fraudulento a acreedores",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-016",
    "articulo": "",
    "delito": "261. Presentación de datos contables falsos en procedimiento concursal",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "VERDE_INTENSO",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_INTENSO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-017",
    "articulo": "264, 264 bis y 264 ter",
    "delito": "Daños Informáticos",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "VERDE_CLARO",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-018",
    "articulo": "270 y siguientes",
    "delito": "Delitos relativos a la 270 y 271. Propiedad intelectual y circunstancias agravantes Propiedad Intelectual",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "AMARILLO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "VERDE_CLARO",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "VERDE_CLARO",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "VERDE_CLARO",
      "Knowledge": "VERDE_CLARO",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-019",
    "articulo": "",
    "delito": "273. Patentes, modelos de utilidad y otros derechos",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_INTENSO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-020",
    "articulo": "",
    "delito": "Delitos relativos a la 274. Marcas, nombres comerciales y rótulos de establecimientos",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "VERDE_CLARO",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-021",
    "articulo": "",
    "delito": "Propiedad Industrial 275 y 276. Denominaciones de origen y circunstancias agravantes",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-022",
    "articulo": "",
    "delito": "277. Divulgación de invención objeto de solicitud de patente secreta",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-023",
    "articulo": "278 y siguientes",
    "delito": "Apoderamiento, difusión, revelación, cesión, divulgación o utilización de secretos de empresa",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "AMARILLO",
      "Mercantil": "AMARILLO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "VERDE_CLARO",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "VERDE_CLARO",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "VERDE_CLARO",
      "Knowledge": "VERDE_CLARO",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-024",
    "articulo": "281",
    "delito": "Detracción de materias primas o productos de primera necesidad",
    "banda": "NO_EVALUADA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-025",
    "articulo": "282",
    "delito": "Publicidad engañosa",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_INTENSO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "AMARILLO",
      "Mercantil": "VERDE_INTENSO",
      "G-advisory": "AMARILLO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "VERDE_INTENSO",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "VERDE_INTENSO",
      "RRHH": "VERDE_INTENSO",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-026",
    "articulo": "282 bis",
    "delito": "Sociedad emisora de valores negociados: Falsear información económico-financiera",
    "banda": "NARANJA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "NARANJA",
      "G-advisory": "AMARILLO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-027",
    "articulo": "283",
    "delito": "Facturación de cantidades superiores cuyo coste o precio se mide por aparatos automáticos",
    "banda": "NARANJA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "NARANJA",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-028",
    "articulo": "284",
    "delito": "Alteración de precios",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "AMARILLO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "AMARILLO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-029",
    "articulo": "285, 285 bis, 285 ter y 285 quáter",
    "delito": "Abuso de información relevante relativa al mercado bursátil y comunicación ilícita de información privilegiada",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "AMARILLO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "VERDE_CLARO",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "VERDE_CLARO",
      "Knowledge": "VERDE_CLARO",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-030",
    "articulo": "286",
    "delito": "Usurpación de derechos de emisión y prestación de servicios multiples",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-031",
    "articulo": "286 bis, 286 ter y",
    "delito": "Corrupción en los 286 bis. Corrupción entre particulares",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "AMARILLO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "VERDE_CLARO",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "VERDE_CLARO",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "VERDE_CLARO",
      "Knowledge": "VERDE_CLARO",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-032",
    "articulo": "286 quater",
    "delito": "negocios 286 ter. Corrupción a funcionario público en actividades económicas internacionales",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "GRIS",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-033",
    "articulo": "301 y siguientes",
    "delito": "Blanqueo de capitales y supuestos agravados",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "AMARILLO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-034",
    "articulo": "304 bis",
    "delito": "Financiación ilegal de los partidos políticos (donaciones)",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-035",
    "articulo": "",
    "delito": "305 y 305 bis. Fraude a la Hacienda Pública y supuestos agravados",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "AMARILLO",
      "Fiscal": "AMARILLO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-036",
    "articulo": "",
    "delito": "306. Fraude a los presupuestos generales de la Unión Europea Delitos contra la",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "AMARILLO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-037",
    "articulo": "305 y siguientes",
    "delito": "307, 307 bis y 307 ter. Fraude a la Seguridad Social, supuestos agravados y disfrute indebido de prestaciones Hacienda Pública y la del sistema de Seguridad Social (simulación, tergiversación, ocultación)",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "AMARILLO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-038",
    "articulo": "",
    "delito": "Seguridad Social 308. Fraude de ayudas y subvenciones públicas",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "AMARILLO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "VERDE_CLARO",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "VERDE_CLARO",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-039",
    "articulo": "",
    "delito": "310. Incumplimiento de obligaciones contables establecidas por ley tributaria",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "AMARILLO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "AMARILLO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "GRIS",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-040",
    "articulo": "318 bis",
    "delito": "Delitos contra los derechos de los ciudadanos extranjeros",
    "banda": "NO_EVALUADA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-041",
    "articulo": "319",
    "delito": "Delitos sobre la ordenación del territorio y el urbanismo",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "AMARILLO",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-042",
    "articulo": "",
    "delito": "325. Emisiones y vertidos",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-043",
    "articulo": "",
    "delito": "Delitos contra los 326. Traslado de residuos",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-044",
    "articulo": "",
    "delito": "326 bis. Explotación de instalaciones con actividades o sustancias peligrosas",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-045",
    "articulo": "",
    "delito": "330. Daño de espacios naturales protegidos",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-046",
    "articulo": "340 bis y 340 ter",
    "delito": "340 bis. Lesionar o causar la muerte a animal doméstico, amansado, domesticado, que viva bajo el control Delitos contra los humano o a animal vertebrado.",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "VERDE_INTENSO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-047",
    "articulo": "",
    "delito": "animales 340 ter. Abandono de animal vertebrado en condiciones en que pueda peligrar su vida o integridad.",
    "banda": "NO_EVALUADA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-048",
    "articulo": "",
    "delito": "Delitos de riesgo 343. Exposición de personas a radiaciones ionizantes",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-049",
    "articulo": "343 y 348",
    "delito": "catastrófico (radiaciones 348. Contravención de normas de seguridad en la manipulación de explosivos y otros agentes que puedan y explosivos) causar estragos",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-050",
    "articulo": "",
    "delito": "359. Elaboración, suministro, comercialización o despacho, sin autorización, de sustancias nocivas para la salud o productos químicos que puedan causar estragos",
    "banda": "NARANJA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "NARANJA",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-051",
    "articulo": "",
    "delito": "360. Despacho o suministro, con autorización pero incumpliendo formalidades legales, de sustancias nocivas para la salud o productos químicos que puedan causar estragos",
    "banda": "NARANJA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "NARANJA",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "AMARILLO",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-052",
    "articulo": "",
    "delito": "361. Despacho o expedición de medicamentos deteriorados",
    "banda": "NARANJA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "AMARILLO",
      "Administrativo": "NARANJA",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "AMARILLO",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-053",
    "articulo": "359 y siguientes",
    "delito": "Delitos contra la salud 362, 362 bis, ter, quáter y quinquies. Alteración de medicamentos o sustancias beneficiosas para la salud pública",
    "banda": "NARANJA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "AMARILLO",
      "Administrativo": "NARANJA",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "AMARILLO",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-054",
    "articulo": "",
    "delito": "363. Manipulación de alimentos",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "VERDE_CLARO",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-055",
    "articulo": "",
    "delito": "364. Adulteración de alimentos con aditivos u otros agentes",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "VERDE_CLARO",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-056",
    "articulo": "",
    "delito": "365. Adulteración de agua o alimentos con sustancias infecciosas u otras nocivas",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-057",
    "articulo": "",
    "delito": "368, 369, 369 bis y 370. Cultivo, elaboración y tráfico de drogas, estupefacientes y sustancias psicotrópicas",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-058",
    "articulo": "386 y 387",
    "delito": "Falsificación de moneda",
    "banda": "NO_EVALUADA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-059",
    "articulo": "399 bis",
    "delito": "Falsificación de tarjetas de crédito, débito o cheques de viaje",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-060",
    "articulo": "419 y siguientes",
    "delito": "Cohecho Pasivo. Cometido por autoridad o funcionario público",
    "banda": "NO_EVALUADA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-061",
    "articulo": "",
    "delito": "424. Cometido por particular a autoridades o funcionarios públicos",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "VERDE_CLARO",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "VERDE_CLARO",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_CLARO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-062",
    "articulo": "424 y siguientes",
    "delito": "Cohecho activo 427. Cometido por particular a autoridades, funcionarios públicos o agentes que trabajen en o para la Unión Europea, u otro país extranjero u organización internacional",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "VERDE_CLARO",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-063",
    "articulo": "428",
    "delito": "Tráfico de Influencias cometido por autoridad o funcionario público",
    "banda": "NO_EVALUADA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-064",
    "articulo": "",
    "delito": "429. Cometido por particular a autoridad o funcionario público",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_INTENSO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "VERDE_INTENSO",
      "Fundación Garrigues": "VERDE_INTENSO",
      "RRHH": "VERDE_INTENSO",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_INTENSO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_INTENSO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-065",
    "articulo": "",
    "delito": "430. Cometido por particular o funcionario público o autoridad: oferta de realizar tráfico de influencias",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_INTENSO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "VERDE_INTENSO",
      "Fundación Garrigues": "GRIS",
      "RRHH": "VERDE_INTENSO",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_INTENSO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "VERDE_INTENSO"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-066",
    "articulo": "435",
    "delito": "Malversación",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-067",
    "articulo": "510",
    "delito": "Fomento, promoción o incitación al odio, hostilidad, discriminación o violencia contra grupos",
    "banda": "NO_EVALUADA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-068",
    "articulo": "571 a 580 bis",
    "delito": "Organizaciones y grupos terroristas. Delitos de terrorismo.",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-069",
    "articulo": "Ley de represión del contrabando",
    "delito": "Delito de contrabando",
    "banda": "ROJO",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "ROJO",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "AMARILLO",
      "Mercantil": "AMARILLO",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-070",
    "articulo": "",
    "delito": "159. Alteración del genotipo",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "AMARILLO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-071",
    "articulo": "159 a 161",
    "delito": "Manipulación genética 160. utilización de ingeniería genética para producir armas",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "VERDE_CLARO",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-072",
    "articulo": "",
    "delito": "161. Reproducción asistida sin consentimiento",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-073",
    "articulo": "262",
    "delito": "Alteración de precios en concursos y subastas públicas",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "VERDE_CLARO",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-074",
    "articulo": "294",
    "delito": "Delito societario: impedimento a la supervisión administrativa",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-075",
    "articulo": "",
    "delito": "311. Condiciones laborales o de Seguridad Social lesivas",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "AMARILLO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "VERDE_CLARO",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-076",
    "articulo": "",
    "delito": "311 bis. Inmigrantes o menores",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-077",
    "articulo": "",
    "delito": "312. Tráfico ilegal de mano de obra Delitos contra los",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-078",
    "articulo": "311 a 318",
    "delito": "313. Emigración fraudulenta derechos de los",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-079",
    "articulo": "",
    "delito": "trajadores 314. Discriminación en el empleo",
    "banda": "AMARILLO",
    "areas_negocio": {
      "Laboral": "AMARILLO",
      "Fiscal": "VERDE_CLARO",
      "Reestructuraciones e insolvencias": "VERDE_CLARO",
      "Litigación y arbitraje": "VERDE_CLARO",
      "IP": "VERDE_CLARO",
      "Administrativo": "VERDE_CLARO",
      "Mercantil": "VERDE_CLARO",
      "G-advisory": "VERDE_CLARO",
      "GLS": "VERDE_CLARO"
    },
    "departamentos_internos": {
      "Intangibles": "VERDE_CLARO",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "VERDE_CLARO",
      "RRHH": "VERDE_CLARO",
      "Asesoría jurídica": "VERDE_CLARO",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "VERDE_CLARO",
      "Knowledge": "VERDE_CLARO",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-080",
    "articulo": "",
    "delito": "315. Limitación de la libertad sindical y derecho de huelga",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "VERDE_CLARO",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-081",
    "articulo": "",
    "delito": "316 y 317. Omisión de medidas de seguridad y salud en el trabajo con infracción de normas de prevención de riesgos laborales",
    "banda": "VERDE",
    "areas_negocio": {
      "Laboral": "VERDE_CLARO",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "VERDE_CLARO",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "VERDE_CLARO",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "VERDE_CLARO",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  },
  {
    "codigo": "RSK-GARR-PEN-082",
    "articulo": "515",
    "delito": "Asociación ilícita",
    "banda": "NO_EVALUADA",
    "areas_negocio": {
      "Laboral": "GRIS",
      "Fiscal": "GRIS",
      "Reestructuraciones e insolvencias": "GRIS",
      "Litigación y arbitraje": "GRIS",
      "IP": "GRIS",
      "Administrativo": "GRIS",
      "Mercantil": "GRIS",
      "G-advisory": "GRIS",
      "GLS": "GRIS"
    },
    "departamentos_internos": {
      "Intangibles": "GRIS",
      "Servicio Médico": "GRIS",
      "Fundación Garrigues": "GRIS",
      "RRHH": "GRIS",
      "Asesoría jurídica": "GRIS",
      "Servicios Generales": "GRIS",
      "Tecnología": "GRIS",
      "Knowledge": "GRIS",
      "Financiero": "GRIS"
    }
  }
] as const;

export const CELDAS_BANDA_ALTA = [
  {
    "codigo": "RSK-GARR-PEN-010",
    "delito": "251. Estafa sobre cosa mueble o inmueble y contratos simulados",
    "columna": "IP",
    "celda": "NARANJA"
  },
  {
    "codigo": "RSK-GARR-PEN-026",
    "delito": "Sociedad emisora de valores negociados: Falsear información económico-financiera",
    "columna": "Mercantil",
    "celda": "NARANJA"
  },
  {
    "codigo": "RSK-GARR-PEN-027",
    "delito": "Facturación de cantidades superiores cuyo coste o precio se mide por aparatos automáticos",
    "columna": "Administrativo",
    "celda": "NARANJA"
  },
  {
    "codigo": "RSK-GARR-PEN-050",
    "delito": "359. Elaboración, suministro, comercialización o despacho, sin autorización, de sustancias nocivas para la salud o productos químicos que puedan causar estragos",
    "columna": "Administrativo",
    "celda": "NARANJA"
  },
  {
    "codigo": "RSK-GARR-PEN-051",
    "delito": "360. Despacho o suministro, con autorización pero incumpliendo formalidades legales, de sustancias nocivas para la salud o productos químicos que puedan causar estragos",
    "columna": "Administrativo",
    "celda": "NARANJA"
  },
  {
    "codigo": "RSK-GARR-PEN-052",
    "delito": "361. Despacho o expedición de medicamentos deteriorados",
    "columna": "Administrativo",
    "celda": "NARANJA"
  },
  {
    "codigo": "RSK-GARR-PEN-053",
    "delito": "Delitos contra la salud 362, 362 bis, ter, quáter y quinquies. Alteración de medicamentos o sustancias beneficiosas para la salud pública",
    "columna": "Administrativo",
    "celda": "NARANJA"
  },
  {
    "codigo": "RSK-GARR-PEN-069",
    "delito": "Delito de contrabando",
    "columna": "Fiscal",
    "celda": "ROJO"
  }
] as const;
