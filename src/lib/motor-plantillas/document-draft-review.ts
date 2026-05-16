export interface EditableDraftDiffSummary {
  changed: boolean;
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
  originalLines: number;
  editedLines: number;
  preview: string[];
}

function normalizeLines(value: string) {
  return value.replace(/\r\n/g, "\n").split("\n");
}

export function summarizeEditableDraftDiff(
  originalText: string,
  editedText: string,
  previewLimit = 6,
): EditableDraftDiffSummary {
  const original = normalizeLines(originalText.trim());
  const edited = normalizeLines(editedText.trim());
  const max = Math.max(original.length, edited.length);
  let addedLines = 0;
  let removedLines = 0;
  let unchangedLines = 0;
  const preview: string[] = [];

  for (let index = 0; index < max; index += 1) {
    const before = original[index];
    const after = edited[index];
    if (before === after) {
      if (before !== undefined) unchangedLines += 1;
      continue;
    }

    if (before === undefined && after !== undefined) {
      addedLines += 1;
      if (preview.length < previewLimit) preview.push(`+ ${after}`);
      continue;
    }

    if (after === undefined && before !== undefined) {
      removedLines += 1;
      if (preview.length < previewLimit) preview.push(`- ${before}`);
      continue;
    }

    addedLines += 1;
    removedLines += 1;
    if (preview.length < previewLimit) preview.push(`- ${before}`);
    if (preview.length < previewLimit) preview.push(`+ ${after}`);
  }

  return {
    changed: addedLines > 0 || removedLines > 0,
    addedLines,
    removedLines,
    unchangedLines,
    originalLines: originalText.trim() ? original.length : 0,
    editedLines: editedText.trim() ? edited.length : 0,
    preview,
  };
}

export function formatEditableDraftDiffSummary(summary: EditableDraftDiffSummary) {
  if (!summary.changed) return "Sin cambios respecto del borrador compuesto.";
  return `${summary.addedLines} línea(s) añadida(s), ${summary.removedLines} línea(s) retirada(s), ${summary.unchangedLines} sin cambios.`;
}
