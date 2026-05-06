#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_REF = "hzqwefkwsxopwrmtksbg";
const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
const ENV_FILE = "docs/superpowers/plans/.env";
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

function cleanEnvValue(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readLocalEnv() {
  try {
    const text = readFileSync(ENV_FILE, "utf8");
    const parsed: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      parsed[match[1]] = cleanEnvValue(match[2]) ?? "";
    }
    return parsed;
  } catch {
    return {};
  }
}

const localEnv = readLocalEnv();

function secretEnv(name: string) {
  return cleanEnvValue(process.env[name]) ?? cleanEnvValue(localEnv[name]);
}

function projectRefFromUrl(rawUrl: string) {
  try {
    const [ref] = new URL(rawUrl).host.split(".");
    return ref;
  } catch {
    return null;
  }
}

function client() {
  const url =
    secretEnv("VITE_SUPABASE_URL") ??
    secretEnv("SUPABASE_URL") ??
    `https://${EXPECTED_PROJECT_REF}.supabase.co`;
  const key =
    secretEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    secretEnv("SERVICE_ROLE_SECRET") ??
    secretEnv("SECRET_DEFFAULT_KEY");

  if (!key) throw new Error("Missing Supabase service key in environment.");
  const ref = projectRefFromUrl(url);
  if (ref !== EXPECTED_PROJECT_REF && process.env.SECRETARIA_SEED_ALLOW_NON_CANONICAL_PROJECT !== "1") {
    throw new Error(`Refusing to run against ${ref ?? "unknown"}; expected ${EXPECTED_PROJECT_REF}.`);
  }

  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const consejoCooptacionPayload = {
  id: "NOMBRAMIENTO_CONSEJERO_COOPTACION_CONSEJO",
  materia: "NOMBRAMIENTO_CONSEJERO",
  clase: "ORDINARIA",
  organoTipo: "CONSEJO",
  modosAdopcionPermitidos: ["MEETING"],
  convocatoria: {
    antelacionDias: {
      SA: { valor: 0, fuente: "LEY", referencia: "art. 246.1 LSC; estatutos/reglamento del Consejo" },
      SAU: { valor: 0, fuente: "LEY", referencia: "art. 246.1 LSC; estatutos/reglamento del Consejo" },
      SL: { valor: 0, fuente: "LEY", referencia: "No aplica cooptacion en SL" },
      SLU: { valor: 0, fuente: "LEY", referencia: "No aplica cooptacion en SLU" },
    },
    canales: {
      SA: ["CONVOCATORIA_CONSEJO"],
      SAU: ["CONVOCATORIA_CONSEJO"],
      SL: [],
      SLU: [],
    },
    contenidoMinimo: [
      "Vacante anticipada entre juntas",
      "Identificacion del candidato",
      "Informe o propuesta de idoneidad",
    ],
    documentosObligatorios: [
      { id: "vacante_anticipada", nombre: "Evidencia de vacante anticipada", condicion: "SIEMPRE" },
      { id: "cv_candidato", nombre: "Curriculum vitae del candidato", condicion: "SIEMPRE" },
      { id: "declaracion_idoneidad", nombre: "Declaracion de idoneidad y aceptacion", condicion: "SIEMPRE" },
      {
        id: "informe_comision_nombramientos",
        nombre: "Informe de la Comision de Nombramientos",
        condicion: "SI_COTIZADA",
      },
    ],
  },
  constitucion: {
    quorum: {
      SA_1a: { valor: 0, fuente: "LEY", referencia: "No aplica: acuerdo de Consejo" },
      SA_2a: { valor: 0, fuente: "LEY", referencia: "No aplica: acuerdo de Consejo" },
      SL: { valor: 0, fuente: "LEY", referencia: "No aplica cooptacion en SL" },
      CONSEJO: { valor: "mayoria_miembros", fuente: "LEY", referencia: "art. 247.1 LSC" },
    },
  },
  votacion: {
    mayoria: {
      SA: { formula: "favor > presentes_mitad", fuente: "LEY", referencia: "art. 248.1 LSC" },
      SL: { formula: "no_aplica", fuente: "LEY", referencia: "art. 244 LSC limita cooptacion a SA" },
      CONSEJO: { formula: "favor > presentes_mitad", fuente: "LEY", referencia: "arts. 244 y 248.1 LSC" },
    },
    abstenciones: "no_cuentan",
    votoCalidadPermitido: true,
  },
  documentacion: {
    obligatoria: [
      { id: "vacante_anticipada", nombre: "Evidencia de vacante anticipada" },
      { id: "cv_candidato", nombre: "CV del candidato" },
      { id: "declaracion_idoneidad", nombre: "Declaracion de idoneidad y aceptacion" },
    ],
    ventanaDisponibilidad: { dias: 0, fuente: "LEY" },
  },
  acta: {
    tipoActaPorModo: { MEETING: "ACTA_CONSEJO" },
    contenidoMinimo: {
      sesion: ["Consejeros asistentes", "Vacante", "Candidato", "Votacion", "Proclamacion"],
      consignacion: [],
      acuerdoEscrito: [],
    },
    requiereTranscripcionLibroActas: true,
    requiereConformidadConjunta: false,
  },
  plazosMateriales: {
    inscripcion: { plazo_dias: 30, fuente: "LEY", referencia: "art. 17 RRM" },
  },
  postAcuerdo: {
    inscribible: true,
    instrumentoRequerido: "ESCRITURA",
    publicacionRequerida: false,
    plazoInscripcion: { dias: 30, fuente: "LEY", referencia: "art. 17 RRM" },
  },
  reglaEspecifica: {
    condicion_especial: "VACANTE_ANTICIPADA",
    limitacion_tipo_social: "SA_SAU",
    fundamento_cooptacion: "art. 244 LSC",
    demo_scope: "ARGA Secretaria Societaria",
  },
};

async function main() {
  const pack = {
    id: "NOMBRAMIENTO_CONSEJERO_COOPTACION_CONSEJO",
    tenant_id: DEMO_TENANT,
    descripcion: "Nombramiento de consejero por cooptacion en Consejo",
    materia: "NOMBRAMIENTO_CONSEJERO",
    organo_tipo: "CONSEJO",
  };
  const version = {
    pack_id: pack.id,
    version: "1.0.0",
    payload: consejoCooptacionPayload,
    is_active: true,
  };

  if (!apply) {
    console.log("Dry run. Re-run with --apply after bun run db:check-target is clean.");
    console.log(JSON.stringify({ pack, version }, null, 2));
    return;
  }

  const supabase = client();
  const { error: packError } = await supabase
    .from("rule_packs")
    .upsert(pack, { onConflict: "id" });
  if (packError) throw packError;

  const { error: versionError } = await supabase
    .from("rule_pack_versions")
    .upsert(version, { onConflict: "pack_id,version" });
  if (versionError) throw versionError;

  console.log("Rule pack NOMBRAMIENTO_CONSEJERO cooptacion Consejo seeded.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
