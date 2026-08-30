/**
 * Generacion del `.ics` de una convocatoria.
 *
 * Vive aparte del componente porque es una funcion pura con prueba propia, y
 * porque es la unica salida del expediente que NO VUELVE: no se queda en la
 * plataforma ni en un fichero que alguien abra y cierre — entra en el
 * calendario de un tercero, y alli el dato vive fuera del sistema, sin
 * procedencia y sin forma de rectificarlo.
 */
export function generateIcs(convocatoria: {
  title: string;
  meeting_date: string;
  start_time?: string | null;
  location?: string | null;
  body_name?: string | null;
  /**
   * El expediente declara que la HORA no consta. Es la salida de mayor
   * consecuencia de todo el modulo porque SALE de la aplicacion: un
   * `DTSTART` con hora se planta en el calendario del despacho como una Junta
   * a las 2:00 de la madrugada, y alli ya no hay ninguna nota que lo explique.
   * iCalendar tiene la forma exacta para esto (RFC 5545 §3.8.2.4): un DTSTART
   * de tipo DATE, que los clientes muestran como evento de dia completo.
   */
  hora_no_acreditada?: boolean;
}): string {
  const dt = new Date(convocatoria.meeting_date);
  const dateStr = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const soloDia = dt.toISOString().slice(0, 10).replace(/-/g, "");
  const domain = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "governance.local";
  const uid = `convocatoria-${Date.now()}@${domain}`;
  const summary = convocatoria.title ?? "Reunión " + (convocatoria.body_name ?? "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Secretaría Societaria//ES",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dateStr}`,
    convocatoria.hora_no_acreditada ? `DTSTART;VALUE=DATE:${soloDia}` : `DTSTART:${dateStr}`,
    `SUMMARY:${summary}`,
    convocatoria.hora_no_acreditada
      ? "DESCRIPTION:La hora de la sesion no consta en el expediente. Este evento se emite como dia completo para no afirmar una hora que no esta acreditada."
      : "",
    convocatoria.location ? `LOCATION:${convocatoria.location}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}
