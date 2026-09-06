// src/lib/grc/contract-checks.ts
//
// Cómo evoluciona el checklist de cláusulas contractuales DORA de un tercero
// cuando el usuario marca una.
//
// Vive fuera de la pantalla porque el defecto que cierra NO era de render y un
// guard de texto no lo habría sujetado: `TPRM.tsx` pintaba correctamente «sin
// dato» para la cláusula ausente, pero su escritura partía de un objeto por
// defecto con las SEIS a `true`. Bastaba marcar una para persistir en Cloud
// cinco conformidades DORA que nadie había declarado — la misma afirmación sin
// respaldo que se había retirado de la pantalla, un nivel más abajo y peor,
// porque aquí queda escrita.
//
// Invariante: la ausencia de dato se propaga como ausencia. Marcar una cláusula
// no dice nada de las otras cinco.
import type { ContractualDoraChecks } from "@/hooks/useThirdParties";

export type ContractChecks = Partial<ContractualDoraChecks>;

export function nextContractChecks(
  current: ContractChecks | null | undefined,
  key: keyof ContractualDoraChecks,
): ContractChecks {
  const base = current ?? {};
  return { ...base, [key]: !base[key] };
}
