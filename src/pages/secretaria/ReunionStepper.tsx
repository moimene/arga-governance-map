import { StepperShell } from "./_shared/StepperShell";

const STEPS = [
  { n: 1, label: "Constitución",       hint: "Verificación de convocatoria previa y validación de presidencia/secretaría" },
  { n: 2, label: "Asistentes",          hint: "Registro de presentes, representados y ausentes — cálculo de capital representado" },
  { n: 3, label: "Quórum",              hint: "Evaluación automática contra regla jurisdiccional aplicable" },
  { n: 4, label: "Debates",             hint: "Puntos del orden del día discutidos y anotaciones del secretario" },
  { n: 5, label: "Votaciones",          hint: "Por cada propuesta aprobada se genera un agreement en estado ADOPTED" },
  { n: 6, label: "Cierre",              hint: "Generación del acta en borrador y firmas pendientes" },
];

export default function ReunionStepper() {
  return (
    <StepperShell
      eyebrow="Secretaría · Reunión"
      title="Asistente de sesión societaria"
      backTo="/secretaria/reuniones"
      steps={STEPS}
      placeholderNote="Formulario del paso pendiente. En el demo se usa la reunión cda-22-04-2026 ya sembrada."
    />
  );
}
