#!/usr/bin/env bun
/**
 * Seed inicial bloques_sectoriales v2.0.
 * Pobla 10 bloques piloto (uno por caso de Cat. 5 del spec).
 * El texto_aprobado en este seed es STUB ("Pendiente de redacción legal — caso 5.X")
 * — la redacción real se hace en plan separado con revisión jurídica.
 *
 * Spec: docs/superpowers/specs/2026-05-11-procedimiento-plantillas-v2-design.md §4.3
 *
 * Uso:
 *   bun run scripts/seed-v2-bloques-sectoriales.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const STUB_PREFIX = "[STUB v2.0 — Pendiente de redacción legal por Comité Legal ARGA] ";

interface BloqueSeed {
  clave_bloque: string;
  version: string;
  sector: string;
  materia_aplicable: string[];
  descripcion: string;
  referencia_legal: string;
  texto_stub: string;
}

const BLOQUES: BloqueSeed[] = [
  {
    clave_bloque: "BANCA_IDONEIDAD_CRR",
    version: "1.0.0",
    sector: "BANCA",
    materia_aplicable: ["NOMBRAMIENTO_CONSEJERO", "COMITES_INTERNOS"],
    descripcion: "Caso 5.1 — Declaración de idoneidad y honorabilidad para entidades supervisadas BdE/BCE.",
    referencia_legal: "Reglamento UE 575/2013 (CRR), Circular 2/2016 BdE",
    texto_stub: "Declaración de idoneidad de los miembros del órgano de administración conforme al Reglamento UE 575/2013 (CRR) y Circular 2/2016 del Banco de España: honorabilidad comercial y profesional, conocimientos y experiencia adecuados, capacidad para ejercer un buen gobierno, dedicación de tiempo suficiente.",
  },
  {
    clave_bloque: "SEGUROS_SOLVENCIA_II_COMITES",
    version: "1.0.0",
    sector: "SEGUROS",
    materia_aplicable: ["COMITES_INTERNOS", "DISTRIBUCION_CARGOS"],
    descripcion: "Caso 5.2 — Funciones clave actuariales y de gestión de riesgos en aseguradoras Solvencia II.",
    referencia_legal: "Arts. 21-22 RD 84/2015, Reglamento UE 2015/35",
    texto_stub: "Las funciones clave de gestión de riesgos, cumplimiento, auditoría interna y actuarial se ejercen conforme a los arts. 21-22 del Real Decreto 84/2015 y el Reglamento (UE) 2015/35, garantizando independencia, autoridad y recursos suficientes para su correcto desempeño.",
  },
  {
    clave_bloque: "SEGUROS_DyO_INTRAGRUPO",
    version: "1.0.0",
    sector: "SEGUROS",
    materia_aplicable: ["SEGUROS_RESPONSABILIDAD"],
    descripcion: "Caso 5.3 — Tratamiento de operación vinculada en D&O contratada con aseguradora del grupo.",
    referencia_legal: "Art. 529 ter.h LSC, art. 14 LOSSEAR",
    texto_stub: "La contratación de la póliza D&O con aseguradora intra-grupo constituye operación vinculada conforme al art. 529 ter.h LSC. Se acreditan condiciones de mercado, soporte de la Comisión de Auditoría, abstención de los consejeros conflictuados y, en su caso, mayoría reforzada.",
  },
  {
    clave_bloque: "COTIZADAS_MAR_DISCLAIMER",
    version: "1.0.0",
    sector: "COTIZADAS",
    materia_aplicable: ["CONVOCATORIA_JUNTA"],
    descripcion: "Caso 5.4 — Disclaimer MAR para cotizadas.",
    referencia_legal: "Reglamento UE 596/2014 (MAR)",
    texto_stub: "La presente convocatoria se publica conforme al Reglamento (UE) 596/2014 sobre abuso de mercado (MAR). La sociedad recuerda a los accionistas las obligaciones de no comunicación de información privilegiada y de no realización de operaciones con base en la misma.",
  },
  {
    clave_bloque: "ENERGIA_CNMC_AUTORIZACION",
    version: "1.0.0",
    sector: "ENERGIA",
    materia_aplicable: ["FUSION_ESCISION"],
    descripcion: "Caso 5.5 — Referencia a CNMC en operaciones estructurales de sociedades del sector energético.",
    referencia_legal: "Ley 3/2013 CNMC, Ley 24/2013 del Sector Eléctrico",
    texto_stub: "La operación estructural se notificará a la Comisión Nacional de los Mercados y la Competencia (CNMC) conforme a la Ley 3/2013 y, en su caso, al Ministerio competente en materia de energía. Se hace constar el compromiso de no consumar la operación hasta obtener autorización o transcurrir los plazos legales.",
  },
  {
    clave_bloque: "MERCADO_VALORES_TENEDORES_BONOS",
    version: "1.0.0",
    sector: "MERCADO_VALORES",
    materia_aplicable: ["REDUCCION_CAPITAL"],
    descripcion: "Caso 5.6 — Aviso a tenedores de bonos cotizados en reducción de capital.",
    referencia_legal: "Arts. 411-417 LSC, LMV",
    texto_stub: "La sociedad notificará la presente reducción de capital a los titulares de los valores de renta fija emitidos y cotizados, conforme a los arts. 411-417 LSC y a las disposiciones de la LMV. Los tenedores podrán ejercer los derechos que les reconoce la legislación aplicable durante el plazo legalmente establecido.",
  },
  {
    clave_bloque: "INMOBILIARIO_SOCIMI_DIVIDENDOS",
    version: "1.0.0",
    sector: "INMOBILIARIO",
    materia_aplicable: ["DISTRIBUCION_DIVIDENDOS"],
    descripcion: "Caso 5.7 — Régimen SOCIMI: distribución obligatoria del 80% del beneficio.",
    referencia_legal: "Art. 6 Ley 11/2009 SOCIMI",
    texto_stub: "Conforme al art. 6 de la Ley 11/2009 reguladora de las SOCIMI, la sociedad acuerda la distribución del 80% del beneficio procedente de rentas de arrendamiento y del 50% de las plusvalías por transmisión de inmuebles, en cumplimiento del régimen fiscal especial.",
  },
  {
    clave_bloque: "EIP_ROTACION_AUDITOR",
    version: "1.0.0",
    sector: "EIP",
    materia_aplicable: ["NOMBRAMIENTO_AUDITOR"],
    descripcion: "Caso 5.8 — Rotación obligatoria de auditor en Entidades de Interés Público.",
    referencia_legal: "Reglamento UE 537/2014, Ley 22/2015",
    texto_stub: "Conforme al Reglamento (UE) 537/2014 y a la Ley 22/2015 de Auditoría de Cuentas, en su condición de Entidad de Interés Público, la sociedad se acoge al régimen de rotación obligatoria del auditor (período máximo y procedimiento de licitación pública). En su caso, se valora la co-auditoría como mecanismo de extensión.",
  },
  {
    clave_bloque: "FARMA_AEMPS_BPF",
    version: "1.0.0",
    sector: "FARMA",
    materia_aplicable: ["POLITICAS_CORPORATIVAS"],
    descripcion: "Caso 5.9 — Cumplimiento normativo AEMPS y Buenas Prácticas de Fabricación.",
    referencia_legal: "Ley 29/2006 de Garantías y Uso Racional de Medicamentos, RD 824/2010",
    texto_stub: "La sociedad mantiene autorización vigente de la Agencia Española de Medicamentos y Productos Sanitarios (AEMPS) y se compromete al cumplimiento estricto de las Normas de Correcta Fabricación de Medicamentos (NCF/GMP) conforme a la Ley 29/2006 y al RD 824/2010.",
  },
  {
    clave_bloque: "PUBLICO_PRIVADO_LPAP",
    version: "1.0.0",
    sector: "PUBLICO_PRIVADO",
    materia_aplicable: ["FUSION_ESCISION", "DISTRIBUCION_DIVIDENDOS"],
    descripcion: "Caso 5.10 — Sujeción a Ley de Patrimonio de las Administraciones Públicas en sociedades con participación estatal significativa.",
    referencia_legal: "Ley 33/2003 LPAP",
    texto_stub: "Por la participación significativa de Administraciones Públicas en el capital social, la operación está sujeta a la Ley 33/2003 del Patrimonio de las Administraciones Públicas (LPAP). En su caso, se requerirá autorización del Consejo de Ministros u órgano competente conforme al art. 169 LPAP.",
  },
];

async function main() {
  console.log(`Seeding bloques_sectoriales with ${BLOQUES.length} stubs...`);
  for (const b of BLOQUES) {
    const { error } = await supabase
      .from("bloques_sectoriales")
      .upsert({
        clave_bloque: b.clave_bloque,
        version: b.version,
        sector: b.sector,
        materia_aplicable: b.materia_aplicable,
        descripcion: b.descripcion,
        referencia_legal: b.referencia_legal,
        texto_aprobado: STUB_PREFIX + b.texto_stub,
        aprobada_por: "Comité Legal ARGA — Secretaría Societaria (demo-operativo)",
        estado: "ACTIVA",
      }, { onConflict: "clave_bloque,version" });
    if (error) {
      console.error(`FAIL on clave=${b.clave_bloque}: ${error.message}`);
      process.exit(1);
    }
  }

  const { count } = await supabase
    .from("bloques_sectoriales")
    .select("*", { count: "exact", head: true })
    .eq("estado", "ACTIVA");
  console.log(`OK: ${BLOQUES.length} bloques upserted. Total ACTIVA: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
