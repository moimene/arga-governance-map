import { readFileSync } from "node:fs";
import { supabase } from "../src/integrations/supabase/client";

const SQL_PATH = "docs/legal-team/sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql";
const EXPECTED_ROWS = 16;
const APPROVED_BY = "Comité Legal ARGA — Secretaría Societaria (demo-operativo)";
const APPROVAL_DATE = "2026-05-02";

const COLUMNS = [
  "tenant_id",
  "tipo",
  "materia",
  "jurisdiccion",
  "organo_tipo",
  "adoption_mode",
  "version",
  "estado",
  "capa1_inmutable",
  "capa2_variables",
  "capa3_editables",
  "aprobada_por",
  "fecha_aprobacion",
  "referencia_legal",
  "created_at",
  "updated_at",
] as const;

type ParsedRow = Record<(typeof COLUMNS)[number], unknown>;
type DbRow = Omit<ParsedRow, "updated_at">;

function findInsertBodies(sql: string) {
  const bodies: string[] = [];
  let index = 0;
  while (index < sql.length) {
    const start = sql.indexOf("INSERT INTO plantillas_protegidas", index);
    if (start === -1) break;
    const valuesStart = sql.indexOf("VALUES", start);
    if (valuesStart === -1) throw new Error("VALUES clause not found.");
    const open = sql.indexOf("(", valuesStart);
    if (open === -1) throw new Error("VALUES open parenthesis not found.");

    let cursor = open + 1;
    let quote = false;
    let dollarTag: string | null = null;
    let lineComment = false;
    let depth = 1;

    for (; cursor < sql.length; cursor += 1) {
      const current = sql[cursor];
      const next = sql[cursor + 1];

      if (lineComment) {
        if (current === "\n") lineComment = false;
        continue;
      }

      if (dollarTag) {
        if (sql.startsWith(dollarTag, cursor)) {
          cursor += dollarTag.length - 1;
          dollarTag = null;
        }
        continue;
      }

      if (quote) {
        if (current === "'" && next === "'") {
          cursor += 1;
        } else if (current === "'") {
          quote = false;
        }
        continue;
      }

      if (current === "-" && next === "-") {
        lineComment = true;
        cursor += 1;
        continue;
      }

      if (current === "'") {
        quote = true;
        continue;
      }

      if (current === "$") {
        const rest = sql.slice(cursor);
        const match = rest.match(/^\$[A-Za-z0-9_]+\$/);
        if (match) {
          dollarTag = match[0];
          cursor += dollarTag.length - 1;
          continue;
        }
      }

      if (current === "(") depth += 1;
      if (current === ")") {
        depth -= 1;
        if (depth === 0) {
          bodies.push(sql.slice(open + 1, cursor));
          index = cursor + 1;
          break;
        }
      }
    }

    if (depth !== 0) throw new Error("Unclosed INSERT VALUES body.");
  }
  return bodies;
}

function splitValues(body: string) {
  const values: string[] = [];
  let start = 0;
  let quote = false;
  let dollarTag: string | null = null;
  let lineComment = false;
  let parenDepth = 0;

  for (let cursor = 0; cursor < body.length; cursor += 1) {
    const current = body[cursor];
    const next = body[cursor + 1];

    if (lineComment) {
      if (current === "\n") lineComment = false;
      continue;
    }

    if (dollarTag) {
      if (body.startsWith(dollarTag, cursor)) {
        cursor += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }

    if (quote) {
      if (current === "'" && next === "'") {
        cursor += 1;
      } else if (current === "'") {
        quote = false;
      }
      continue;
    }

    if (current === "-" && next === "-") {
      lineComment = true;
      cursor += 1;
      continue;
    }

    if (current === "'") {
      quote = true;
      continue;
    }

    if (current === "$") {
      const rest = body.slice(cursor);
      const match = rest.match(/^\$[A-Za-z0-9_]+\$/);
      if (match) {
        dollarTag = match[0];
        cursor += dollarTag.length - 1;
        continue;
      }
    }

    if (current === "(") parenDepth += 1;
    if (current === ")") parenDepth -= 1;

    if (current === "," && parenDepth === 0) {
      values.push(body.slice(start, cursor).trim());
      start = cursor + 1;
    }
  }

  values.push(body.slice(start).trim());
  return values.map((value) => value.replace(/--.*$/gm, "").trim());
}

function unquote(value: string) {
  return value.slice(1, -1).replace(/''/g, "'");
}

function parseValue(value: string) {
  if (/^NULL$/i.test(value)) return null;
  if (/^now\(\)$/i.test(value)) return new Date().toISOString();
  if (value.startsWith("'") && value.endsWith("'")) return unquote(value);

  const dollar = value.match(/^\$([A-Za-z0-9_]+)\$([\s\S]*)\$\1\$(?:::jsonb)?$/);
  if (dollar) {
    const raw = dollar[2];
    if (value.endsWith("::jsonb")) return JSON.parse(raw);
    return raw.trim();
  }

  throw new Error(`Unsupported SQL value: ${value.slice(0, 80)}`);
}

function parseRows(sql: string) {
  const bodies = findInsertBodies(sql);
  if (bodies.length !== EXPECTED_ROWS) {
    throw new Error(`Expected ${EXPECTED_ROWS} INSERT rows, found ${bodies.length}.`);
  }

  return bodies.map((body, index) => {
    const values = splitValues(body);
    if (values.length !== COLUMNS.length) {
      throw new Error(`Row ${index + 1}: expected ${COLUMNS.length} values, found ${values.length}.`);
    }

    return Object.fromEntries(COLUMNS.map((column, valueIndex) => [column, parseValue(values[valueIndex])])) as ParsedRow;
  });
}

function keyFor(row: ParsedRow) {
  return `${row.tenant_id}|${row.tipo}|${row.materia}|${row.version}|${row.estado}|${row.aprobada_por}|${row.fecha_aprobacion}`;
}

function toInsertRow(row: ParsedRow): DbRow {
  const { updated_at: _updatedAt, ...insertable } = row;
  return insertable;
}

function toUpdateRow(row: ParsedRow): Omit<DbRow, "created_at"> {
  const { created_at: _createdAt, updated_at: _updatedAt, ...updateable } = row;
  return updateable;
}

async function findExisting(row: ParsedRow) {
  const { data, error } = await supabase
    .from("plantillas_protegidas")
    .select("id,tipo,materia,version,estado,aprobada_por,fecha_aprobacion")
    .eq("tenant_id", row.tenant_id as string)
    .eq("tipo", row.tipo as string)
    .eq("materia", row.materia as string)
    .eq("version", row.version as string)
    .eq("estado", row.estado as string)
    .eq("aprobada_por", row.aprobada_por as string)
    .eq("fecha_aprobacion", row.fecha_aprobacion as string);

  if (error) throw error;
  return data ?? [];
}

async function findPromoted(row: ParsedRow) {
  const { data, error } = await supabase
    .from("plantillas_protegidas")
    .select("id,tipo,materia,version,estado,aprobada_por,fecha_aprobacion")
    .eq("tenant_id", row.tenant_id as string)
    .eq("tipo", row.tipo as string)
    .eq("materia", row.materia as string)
    .eq("version", row.version as string)
    .eq("estado", "ACTIVA")
    .eq("aprobada_por", row.aprobada_por as string)
    .eq("fecha_aprobacion", row.fecha_aprobacion as string);

  if (error) throw error;
  return data ?? [];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(SQL_PATH, "utf8");
  const rows = parseRows(sql);
  const keys = new Set(rows.map(keyFor));

  if (keys.size !== EXPECTED_ROWS) {
    throw new Error("Duplicate rows detected in Path B SQL packet.");
  }

  if (!rows.every((row) => row.estado === "BORRADOR" && row.aprobada_por === APPROVED_BY && row.fecha_aprobacion === APPROVAL_DATE)) {
    throw new Error("Path B packet does not match expected BORRADOR approval contract.");
  }

  if (!apply) {
    console.log(JSON.stringify({
      dryRun: true,
      rows: rows.map((row) => ({
        tipo: row.tipo,
        materia: row.materia,
        version: row.version,
        estado: row.estado,
      })),
    }, null, 2));
    return;
  }

  let inserted = 0;
  let updated = 0;
  const draftExistingByRow = await Promise.all(rows.map(findExisting));
  const promotedByRow = await Promise.all(rows.map(findPromoted));
  const draftExistingCount = draftExistingByRow.reduce((sum, items) => sum + items.length, 0);
  const promotedCount = promotedByRow.reduce((sum, items) => sum + items.length, 0);

  if (promotedCount > 0) {
    if (promotedCount === EXPECTED_ROWS && draftExistingCount === 0) {
      console.log(JSON.stringify({
        applied: false,
        alreadyPromoted: true,
        pathBRows: promotedCount,
        rows: promotedByRow.flat().map((row) => ({
          tipo: row.tipo,
          materia: row.materia,
          version: row.version,
          estado: row.estado,
        })),
      }, null, 2));
      return;
    }

    throw new Error(
      `Path B packet is partially promoted (${promotedCount} active, ${draftExistingCount} draft). ` +
        "Resolve the Cloud inventory before reapplying.",
    );
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const existing = draftExistingByRow[index];
    if (existing.length > 1) {
      throw new Error(`Duplicate existing BORRADOR rows for ${row.tipo}/${row.materia} ${row.version}.`);
    }

    if (existing.length === 1) {
      const { error } = await supabase
        .from("plantillas_protegidas")
        .update(toUpdateRow(row))
        .eq("id", existing[0].id);
      if (error) throw error;
      updated += 1;
    } else {
      const { error } = await supabase
        .from("plantillas_protegidas")
        .insert(toInsertRow(row));
      if (error) throw error;
      inserted += 1;
    }
  }

  const { data: after, error: afterError } = await supabase
    .from("plantillas_protegidas")
    .select("id,tipo,materia,version,estado,aprobada_por,fecha_aprobacion")
    .eq("estado", "BORRADOR")
    .eq("fecha_aprobacion", APPROVAL_DATE)
    .eq("aprobada_por", APPROVED_BY);

  if (afterError) throw afterError;

  console.log(JSON.stringify({
    applied: true,
    inserted,
    updated,
    pathBRows: after?.length ?? 0,
    rows: (after ?? []).map((row) => ({
      tipo: row.tipo,
      materia: row.materia,
      version: row.version,
      estado: row.estado,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
