import type { NormalizedCapa3Field } from "./capa3-fields";

export type Capa3PrefillMode = "editable" | "readonly";
export type Capa3PrefillSource =
  | "stepper"
  | "agenda"
  | "canales"
  | "entidad"
  | "organo"
  | "autoridad";

export interface ConvocatoriaCapa3Field extends NormalizedCapa3Field {
  readonly?: boolean;
  source?: Capa3PrefillSource;
  sourceLabel?: string;
  prefillMode?: Capa3PrefillMode;
}

export interface ConvocatoriaCapa3AgendaItem {
  titulo?: string | null;
  kind?: string | null;
  materia?: string | null;
}

export interface ConvocatoriaCapa3Context {
  fechaReunion?: string | null;
  horaReunion?: string | null;
  lugar?: string | null;
  formatoReunion?: string | null;
  domicilioSocial?: string | null;
  denominacionSocial?: string | null;
  entidadCotizada?: boolean | null;
  organoNombre?: string | null;
  convocanteNombre?: string | null;
  convocanteCargo?: string | null;
  agendaItems?: ConvocatoriaCapa3AgendaItem[];
  channelLabels?: string[];
}

export interface ConvocatoriaCapa3Resolution {
  fields: ConvocatoriaCapa3Field[];
  values: Record<string, string>;
}

type Binding = {
  mode: Capa3PrefillMode;
  source: Capa3PrefillSource;
  sourceLabel: string;
  read: (context: ConvocatoriaCapa3Context) => string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function agendaSummary(items: ConvocatoriaCapa3AgendaItem[] | undefined) {
  return (items ?? [])
    .map((item, index) => {
      const title = text(item.titulo);
      if (!title) return "";
      const suffix = item.kind === "DECISORIO" && item.materia ? ` (${item.materia})` : "";
      return `${index + 1}. ${title}${suffix}`;
    })
    .filter(Boolean)
    .join("\n");
}

const BINDINGS: Record<string, Binding> = {
  fecha_sesion: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.fechaReunion),
  },
  fecha_reunion: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.fechaReunion),
  },
  fecha_junta: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.fechaReunion),
  },
  fecha_primera_convocatoria: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.fechaReunion),
  },
  hora_sesion: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.horaReunion),
  },
  hora_reunion: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.horaReunion),
  },
  hora_junta: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.horaReunion),
  },
  hora_primera_convocatoria: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.horaReunion),
  },
  lugar_sesion: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.lugar),
  },
  lugar_reunion: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.lugar),
  },
  lugar_junta: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.lugar),
  },
  lugar: {
    mode: "editable",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.lugar),
  },
  domicilio_social: {
    mode: "editable",
    source: "entidad",
    sourceLabel: "Sociedad",
    read: (context) => text(context.domicilioSocial),
  },
  modalidad_sesion: {
    mode: "readonly",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.formatoReunion),
  },
  modalidad_reunion: {
    mode: "readonly",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.formatoReunion),
  },
  formato_reunion: {
    mode: "readonly",
    source: "stepper",
    sourceLabel: "Paso 2",
    read: (context) => text(context.formatoReunion),
  },
  orden_del_dia_resumen: {
    mode: "readonly",
    source: "agenda",
    sourceLabel: "Paso 3",
    read: (context) => agendaSummary(context.agendaItems),
  },
  orden_dia_texto: {
    mode: "readonly",
    source: "agenda",
    sourceLabel: "Paso 3",
    read: (context) => agendaSummary(context.agendaItems),
  },
  canal_convocatoria: {
    mode: "readonly",
    source: "canales",
    sourceLabel: "Paso 5",
    read: (context) => (context.channelLabels ?? []).join(", "),
  },
  canales_convocatoria: {
    mode: "readonly",
    source: "canales",
    sourceLabel: "Paso 5",
    read: (context) => (context.channelLabels ?? []).join(", "),
  },
  canales: {
    mode: "readonly",
    source: "canales",
    sourceLabel: "Paso 5",
    read: (context) => (context.channelLabels ?? []).join(", "),
  },
  denominacion_social: {
    mode: "readonly",
    source: "entidad",
    sourceLabel: "Sociedad",
    read: (context) => text(context.denominacionSocial),
  },
  entidad_cotizada: {
    mode: "readonly",
    source: "entidad",
    sourceLabel: "Sociedad",
    read: (context) => (context.entidadCotizada === true ? "Sí" : "No"),
  },
  es_cotizada: {
    mode: "readonly",
    source: "entidad",
    sourceLabel: "Sociedad",
    read: (context) => (context.entidadCotizada === true ? "Sí" : "No"),
  },
  organo_nombre: {
    mode: "readonly",
    source: "organo",
    sourceLabel: "Paso 1",
    read: (context) => text(context.organoNombre),
  },
  nombre_convocante: {
    mode: "editable",
    source: "autoridad",
    sourceLabel: "Autoridad vigente",
    read: (context) => text(context.convocanteNombre),
  },
  cargo_convocante: {
    mode: "editable",
    source: "autoridad",
    sourceLabel: "Autoridad vigente",
    read: (context) => text(context.convocanteCargo),
  },
};

export function buildConvocatoriaCapa3Resolution(
  fields: NormalizedCapa3Field[],
  context: ConvocatoriaCapa3Context,
): ConvocatoriaCapa3Resolution {
  const values: Record<string, string> = {};

  const resolvedFields = fields.map<ConvocatoriaCapa3Field>((field) => {
    const binding = BINDINGS[field.campo];
    if (!binding) return field;

    const value = binding.read(context);
    if (value) values[field.campo] = value;

    return {
      ...field,
      readonly: binding.mode === "readonly",
      source: binding.source,
      sourceLabel: binding.sourceLabel,
      prefillMode: binding.mode,
    };
  });

  return { fields: resolvedFields, values };
}
