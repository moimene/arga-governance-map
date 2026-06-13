import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ITEM-126 (blindaje real + guard) — regresión.
//
// Contexto: existían tres vías de "envío" de notificaciones con modelos de
// estado divergentes. La Vía 3 (useEnviarNotificacion en useNoSessionExpediente.ts)
// insertaba no_session_notificaciones con estado='ENVIADA' y promovía el
// expediente del acuerdo sin sesión a NOTIFICADO SIN enviar nada — una puerta a
// un resultado jurídico ficticio. Ese writer se eliminó en e06cd39 (ITEM-150).
//
// Este guard impide que vuelva a aparecer: ninguna fuente de producción debe
// (a) reintroducir el archivo del writer ficticio, (b) escribir un estado de
// "enviado/notificado" como literal sobre no_session_notificaciones, ni
// (c) promover un acuerdo sin sesión a NOTIFICADO con una escritura directa.
// La única vía legítima a NOTIFICADO es una entrega real con evidencia a través
// del pipeline canónico (fn_create_communication_atomic + comms-dispatcher +
// delivery events WORM).

const SRC_ROOT = join(process.cwd(), "src");

function collectProductionSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Excluye los propios tests para no auto-detectar los patrones citados aquí.
      if (entry.name === "test" || entry.name === "__tests__") continue;
      collectProductionSources(full, acc);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.(test|spec)\.[tj]sx?$/.test(entry.name)) continue;
    acc.push(full);
  }
  return acc;
}

describe("No-session NOTIFICADO guard (ITEM-126)", () => {
  const sources = collectProductionSources(SRC_ROOT);

  it("keeps the fictional writer file (useNoSessionExpediente.ts) deleted", () => {
    expect(existsSync(join(SRC_ROOT, "hooks/useNoSessionExpediente.ts"))).toBe(false);
  });

  it("never writes a sent-state literal onto no_session_notificaciones", () => {
    // El writer ficticio ponía estado: 'ENVIADA'. Ninguna fuente de producción
    // debe asignar ese literal (la cola canónica usa EstadoEntrega sobre
    // communication_recipients, no no_session_notificaciones).
    const offenders = sources.filter((file) => {
      const content = readFileSync(file, "utf8");
      return /estado:\s*['"]ENVIADA['"]/.test(content);
    });
    expect(offenders).toEqual([]);
  });

  it("never promotes an expediente to NOTIFICADO via a direct status write", () => {
    // Prohíbe la asignación literal (estado/status: 'NOTIFICADO') en un payload
    // de insert/update. Las comparaciones de lectura (=== 'NOTIFICADO') no usan
    // dos puntos, así que no se ven afectadas.
    const offenders = sources.filter((file) => {
      const content = readFileSync(file, "utf8");
      return /\b(estado|status):\s*['"]NOTIFICADO['"]/.test(content);
    });
    expect(offenders).toEqual([]);
  });

  it("only useERDSNotification writes no_session_notificaciones, and only erds_* tracking columns", () => {
    const writers = sources.filter((file) => {
      const content = readFileSync(file, "utf8");
      return (
        /\.from\(\s*['"]no_session_notificaciones['"]\s*\)/.test(content) &&
        /\.(insert|update|upsert|delete)\(/.test(content)
      );
    });
    // El único escritor de producción permitido es el hook ERDS.
    expect(writers.map((f) => f.replace(SRC_ROOT, "src"))).toEqual([
      "src/hooks/useERDSNotification.ts",
    ]);

    const erds = readFileSync(join(SRC_ROOT, "hooks/useERDSNotification.ts"), "utf8");
    // Su update solo toca columnas de tracking ERDS, nunca estado/status.
    expect(erds).not.toMatch(/\b(estado|status):\s*['"](ENVIADA|NOTIFICADO)['"]/);
  });
});
