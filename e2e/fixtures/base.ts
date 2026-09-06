import { test as base, expect } from '@playwright/test';

export const test = base.extend<{
  waitForModule: (heading: string) => Promise<void>;
}>({
  waitForModule: async ({ page }, use) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(async (heading: string) => {
      await expect(
        page.getByRole('heading', { name: heading }).or(page.getByText(heading).first())
      ).toBeVisible({ timeout: 10_000 });
    });
  },
});

export { expect };

/**
 * Rótulo del botón documental de la convocatoria. El literal «Convocatoria
 * DOCX» se retiró porque lo que genera es un borrador de demo, no la
 * convocatoria emitida. Vive aquí, y no copiado en cada spec, porque estaba
 * duplicado en cinco sitios y tres se quedaron atrás en el renombrado: 14 y 16
 * se actualizaron y 18 y 25 siguieron buscando un rótulo inexistente, con lo
 * que su barrido de filas descartaba en silencio todas las convocatorias.
 */
export const CONVOCATORIA_DRAFT_DOCX_BUTTON = /Borrador DEMO(?: revisado)?(?: DOCX| con plantilla)/;

/**
 * Etiquetas del botón de certificación en el detalle de acta. Es una máquina de
 * estados (EmitirCertificacionButton.tsx:378-388), no un rótulo fijo: fijar
 * solo «Emitir certificación» exige que el acta esté en un estado concreto del
 * pipeline, que es dato de demo y no invariante de producto.
 */
export const CERTIFICACION_PIPELINE_BUTTON =
  /Preparar certificación|Pendiente de artefacto final|Validar evidencia y emitir|Emitir certificación|Certificación emitida/;
