import { StepperShell } from "./_shared/StepperShell";

const STEPS = [
  { n: 1, label: "Seleccionar acuerdo",    hint: "El acuerdo debe estar en estado CERTIFIED" },
  { n: 2, label: "Vía de presentación",    hint: "Notarial (escritura) / Electrónica (instancia) según jurisdicción" },
  { n: 3, label: "Datos del instrumento",  hint: "Notaría, fecha de escritura y datos registrales" },
  { n: 4, label: "Presentación",           hint: "Envío a BORME / PSM / SIGER / JUCERJA / CONSERVATORIA" },
  { n: 5, label: "Seguimiento",            hint: "Monitorización de estado, subsanaciones y publicación" },
];

export default function TramitadorStepper() {
  return (
    <StepperShell
      eyebrow="Secretaría · Tramitación registral"
      title="Asistente de tramitación"
      backTo="/secretaria/tramitador"
      steps={STEPS}
    />
  );
}
