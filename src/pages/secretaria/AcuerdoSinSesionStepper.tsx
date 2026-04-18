import { StepperShell } from "./_shared/StepperShell";

const STEPS = [
  { n: 1, label: "Tipo de acuerdo",    hint: "Matter class (ORDINARIA / ESTATUTARIA / ESTRUCTURAL) y kind" },
  { n: 2, label: "Propuesta",           hint: "Redacción del texto del acuerdo y fundamento jurídico" },
  { n: 3, label: "Destinatarios",       hint: "Miembros del órgano con derecho a voto" },
  { n: 4, label: "Envío y votación",    hint: "Canal de envío y recepción de votos por escrito" },
  { n: 5, label: "Cierre",              hint: "Evaluación de mayoría — si alcanzada, crea agreement con adoption_mode=NO_SESSION" },
  { n: 6, label: "Certificación",       hint: "Emisión opcional de certificación del acuerdo escrito" },
];

export default function AcuerdoSinSesionStepper() {
  return (
    <StepperShell
      eyebrow="Secretaría · Acuerdo sin sesión"
      title="Asistente de acuerdo escrito sin sesión"
      backTo="/secretaria/acuerdos-sin-sesion"
      steps={STEPS}
    />
  );
}
