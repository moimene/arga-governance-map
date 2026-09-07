// src/test/secretaria/asistentes-no-se-pierden.test.ts
//
// ORDEN VIGENTE 2026-09-07: el dato sembrado del tenant Garrigues PERSISTE.
// Cualquier camino que lo borre es un defecto.
//
// `useReplaceAttendees` es delete-all + re-insert sobre `meeting_attendees`:
// borra TODA la asistencia de la reunión y reinserta lo que la pantalla tenga
// en memoria. Medido en Cloud el 2026-09-07, la Junta de socios de Garrigues
// (e0beed92-60f0-49e7-81c3-0ae5a54c9d56, DRAFT) tiene 346 asistentes sembrados
// con sus derechos de voto del art. 7 de los Estatutos. El propio seed se
// protege de rehacer la asistencia cuando ya hay votos; la aplicación no tenía
// nada.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "../helpers/sin-comentarios";
import { contarAsistentesQueSePerderian } from "@/hooks/useReunionSecretaria";

const HOOK = "src/hooks/useReunionSecretaria.ts";

function cuerpoDeReplaceAttendees(): string {
  const src = sinComentarios(readFileSync(join(process.cwd(), HOOK), "utf8"));
  const desde = src.indexOf("export function useReplaceAttendees");
  expect(desde, "useReplaceAttendees existe").toBeGreaterThan(-1);
  const hasta = src.indexOf("export function useUpdateQuorumData", desde);
  expect(hasta, "el siguiente hook delimita el cuerpo").toBeGreaterThan(desde);
  return src.slice(desde, hasta);
}

describe("guardar la asistencia no puede borrar a quien la pantalla no cargó", () => {
  it("cuenta como pérdida a todo asistente registrado que no venga en el guardado", () => {
    const existentes = Array.from({ length: 346 }, (_, i) => ({ person_id: `p${i}` }));

    // Camino normal: la pantalla trae el censo entero. No se pierde nadie,
    // aunque cambien todos los valores de asistencia.
    expect(contarAsistentesQueSePerderian(existentes, existentes.map((e) => ({ ...e })))).toBe(0);

    // Camino del defecto: la pantalla cargó 3 de 346 (el censo se truncó, el
    // origen cambió, el paso se abrió antes de tiempo).
    expect(contarAsistentesQueSePerderian(existentes, existentes.slice(0, 3))).toBe(343);

    // Guardar con la lista vacía es el caso extremo del mismo defecto.
    expect(contarAsistentesQueSePerderian(existentes, [])).toBe(346);

    // Añadir a alguien nuevo NO es perder a nadie: la siembra progresiva tiene
    // que poder crecer sin que el guard se dispare.
    expect(
      contarAsistentesQueSePerderian(existentes, [...existentes, { person_id: "nuevo" }]),
    ).toBe(0);

    // Una fila sin `person_id` no puede quedar cubierta por nada: se cuenta.
    expect(contarAsistentesQueSePerderian([{ person_id: null }], [{ person_id: "p0" }])).toBe(1);
  });

  it("y el hook lo comprueba ANTES de borrar, no después", () => {
    const cuerpo = cuerpoDeReplaceAttendees();

    // Control positivo: si el cuerpo dejara de contener los borrados, todo lo
    // de abajo pasaría sin mirar nada.
    const borradoVotos = cuerpo.indexOf('from("meeting_votes")');
    const borradoAsistentes = cuerpo.indexOf('from("meeting_attendees")\n        .delete()');
    expect(borradoVotos, "el hook sigue borrando meeting_votes").toBeGreaterThan(-1);
    expect(borradoAsistentes, "el hook sigue borrando meeting_attendees").toBeGreaterThan(-1);

    const guard = cuerpo.indexOf("contarAsistentesQueSePerderian");
    expect(guard, "el guard está cableado en el hook").toBeGreaterThan(-1);
    expect(guard, "el guard corre antes de borrar los votos").toBeLessThan(borradoVotos);
    expect(guard, "el guard corre antes de borrar la asistencia").toBeLessThan(borradoAsistentes);

    // Y corta: contar sin lanzar sería un rótulo, no una arista.
    expect(cuerpo).toMatch(/if \(perdidas > 0\) \{\s*throw new Error\(/);

    // El hook necesita `person_id` para poder comparar; con `select("id")` el
    // guard contaría 0 siempre y sería vacuo.
    expect(cuerpo).toContain('.select("id, person_id")');
  });
});
