/**
 * Paso de aterrizaje del stepper.
 *
 * Exportada porque el aviso de acreditación del acta vive en los pasos 1 y 6, y
 * la doctrina de la Task 8 es que el hueco se explique DONDE alguien va a
 * buscarlo. Que un expediente aterrice siempre en uno de esos dos es una
 * afirmación que hay que poder comprobar, no razonar.
 */
export function deriveReunionInitialStep(opts: {
  meetingOpen: boolean;
  hasAttendees: boolean;
  hasQuorum: boolean;
  hasResolutions: boolean;
}): number {
  if (!opts.meetingOpen) return 1;
  if (opts.hasResolutions) return 6;
  if (opts.hasQuorum) return 4;
  if (opts.hasAttendees) return 3;
  return 2;
}
