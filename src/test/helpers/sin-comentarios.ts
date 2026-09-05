/**
 * Quita comentarios de un fuente antes de asertar sobre él.
 *
 * POR QUÉ EXISTE. Un guard que prohíbe una frase la encuentra en el comentario
 * que EXPLICA por qué se retiró. Ocurrió tres veces el mismo día, en tres
 * ficheros distintos, al cerrar los gaps de 2026-09-05: al retirar «PLAN DE
 * SALIDA CUSTODIADO EN LEDGER WORM» de TPRM y «Apoderado de Cumplimiento» de
 * Penal se dejó escrito el motivo citando la frase, y los gates volvieron a
 * dispararse contra su propia justificación.
 *
 * La regla: se juzga lo que se renderiza, no la prosa que lo justifica. Y el
 * efecto contrario también importa — sin esto, la salida más fácil es borrar
 * el comentario que explica la corrección, que es justo lo que no se quiere.
 */
export function sinComentarios(src: string): string {
  return src
    // Comentarios JSX: {/* … */}
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
    // Comentarios de bloque: /* … */
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    // Comentarios de línea completa: // …
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}
