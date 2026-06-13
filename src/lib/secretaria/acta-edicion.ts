/**
 * Lógica pura de edición de actas (W0 — saneamiento de generación documental).
 *
 * Un acta solo es editable mientras está en BORRADOR: ni firmada (`signed_at`)
 * ni bloqueada (`is_locked`). Tras `fn_aprobar_acta` queda firmada y bloqueada,
 * y el trigger `trg_minutes_lock_guard` la hace inmutable (art. 202 LSC / RRM
 * 108-109). Esta función decide si la interfaz muestra el editor y si la RPC
 * `fn_actualizar_borrador_acta` debe permitir el guardado.
 */
export interface ActaEdicionEstado {
  is_locked?: boolean | null;
  signed_at?: string | null;
}

export function isActaBorradorEditable(acta: ActaEdicionEstado): boolean {
  return !acta.is_locked && !acta.signed_at;
}
