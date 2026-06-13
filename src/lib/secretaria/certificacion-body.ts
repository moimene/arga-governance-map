/**
 * Composición del cuerpo canónico de una certificación de acuerdos (W0 #4).
 *
 * Hasta ahora `fn_generar_certificacion` insertaba `content = NULL`: la
 * certificación quedaba sin texto canónico (solo metadatos + gate_hash), y el
 * cuerpo solo existía como DOCX efímero. Esta función compone un cuerpo
 * estructurado (art. 109 RRM) que se persiste en `certifications.content` tras
 * generar la certificación, de modo que el registro sea autodescriptivo.
 *
 * Determinista: no usa la fecha del sistema; recibe `fechaISO` y la formatea en
 * UTC para que el texto sea reproducible y testeable.
 */
export interface CertificacionBodyInput {
  certificanteCargoLabel: string;
  certificanteNombre?: string | null;
  vistoBuenoCargoLabel?: string | null;
  vistoBuenoNombre?: string | null;
  entidadNombre: string;
  organoNombre?: string | null;
  numAcuerdos: number;
  fechaISO: string;
}

function fechaLarga(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function buildCertificacionBody(input: CertificacionBodyInput): string {
  const nombre = input.certificanteNombre?.trim() || "—";
  const organo = input.organoNombre?.trim();
  const fecha = fechaLarga(input.fechaISO);
  const plural =
    input.numAcuerdos === 1
      ? "el acuerdo adoptado"
      : `los ${input.numAcuerdos} acuerdos adoptados`;

  const lines: string[] = [];
  lines.push("CERTIFICACIÓN DE ACUERDOS");
  lines.push("");
  lines.push(
    `D./Dña. ${nombre}, en su condición de ${input.certificanteCargoLabel} de ` +
      `${input.entidadNombre}${organo ? ` (${organo})` : ""},`,
  );
  lines.push("");
  lines.push(
    `CERTIFICA que, conforme al art. 109 del Reglamento del Registro Mercantil, ` +
      `quedan certificados ${plural}${organo ? ` por ${organo}` : ""}, cuyo contenido ` +
      `íntegro consta en el acta correspondiente y en el expediente del acuerdo.`,
  );
  lines.push("");
  if (input.vistoBuenoNombre?.trim()) {
    lines.push(
      `Visto bueno: D./Dña. ${input.vistoBuenoNombre.trim()}` +
        (input.vistoBuenoCargoLabel ? `, ${input.vistoBuenoCargoLabel}.` : "."),
    );
    lines.push("");
  }
  lines.push(`En ${input.entidadNombre}, a ${fecha}.`);
  return lines.join("\n");
}
