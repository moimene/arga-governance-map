/**
 * Mensaje de usuario a partir de un error de RPC/trigger del módulo AIMS.
 *
 * Las RPC y triggers de `20260907210000` y `20260908120000` lanzan
 * `CODIGO: texto en castellano`. Aquí se separa el código del texto para que
 * la pantalla no pinte `MISMO_EVALUADOR:` delante de una frase que ya se
 * entiende sola. Hoja: 0 imports.
 */

/** Copy propio para los códigos que el servidor lanza SIN texto, o para uso directo. */
const COPY: Record<string, string> = {
  MISMO_EVALUADOR: "La revisión la firma una persona distinta de quien congeló.",
  CLASIFICACION_INCOHERENTE: "Rol, nivel, perfil o GPAI no se corresponden con las respuestas.",
  ART63_MOTIVACION_OBLIGATORIA:
    "Un sistema del anexo III clasificado por debajo de alto riesgo exige motivación documentada (art. 6.3).",
  PRACTICA_PROHIBIDA_BLOQUEA: "Un sistema que incurre en una práctica prohibida del art. 5 no puede registrarse.",
  CUESTIONARIO_COMPLETADO_INMUTABLE: "Modificar la clasificación exige completar un cuestionario nuevo.",
  CUESTIONARIO_SUPERSEDIDO_INMUTABLE: "Un cuestionario supersedido no se modifica.",
  ALTA_SOLO_POR_CUESTIONARIO: "Un sistema de IA se registra con su clasificación guiada (fn_aims_registrar_sistema).",
  CLASIFICACION_SOLO_POR_CUESTIONARIO: "El rol y el nivel de riesgo se cambian completando un cuestionario nuevo.",
  BORRADOR_NO_CONGELABLE: "Cierra el autodiagnóstico antes de congelarlo.",
  COMPLETAR_SOLO_POR_RPC:
    "Un cuestionario nace en DRAFT y lo completa fn_aims_completar_cuestionario: la huella se calcula en servidor.",
  CAMPOS_SELLADOS_POR_RPC:
    "completed_by, completed_at, content_hash, version, questionnaire_version y created_by no se escriben desde el cliente.",
};

const CON_TEXTO = /^([A-Z][A-Z0-9_]+):\s*(.+)$/;
const SOLO_CODIGO = /^[A-Z][A-Z0-9_]+$/;

function mensajeDe(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  const m = (err as { message?: unknown }).message;
  return typeof m === "string" ? m : "";
}

export function codigoRpc(err: unknown): string | null {
  const msg = mensajeDe(err).trim();
  const con = CON_TEXTO.exec(msg);
  if (con) return con[1];
  return SOLO_CODIGO.test(msg) ? msg : null;
}

export function mensajeUsuario(err: unknown): string {
  const msg = mensajeDe(err).trim();
  const con = CON_TEXTO.exec(msg);
  if (con) return con[2];
  if (SOLO_CODIGO.test(msg)) return COPY[msg] ?? msg;
  return msg;
}
