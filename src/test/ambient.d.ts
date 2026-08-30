// src/test/ambient.d.ts
//
// Declaraciones de ambiente que el gate de tipos necesita y que no vienen de
// ningún paquete instalado. Existe porque `tsconfig.app.json` pasó a cubrir
// los tests y `scripts/`, y ahí se usan dos APIs que el `lib` por defecto no
// conoce.

// 1) Matchers de @testing-library/jest-dom. `src/test/setup.ts` los engancha
//    en tiempo de ejecución con `expect.extend(matchers)`, pero TypeScript no
//    lo deduce de ahí: hay que referenciar la declaración del propio paquete.
/// <reference types="@testing-library/jest-dom/vitest" />

// 2) `import.meta.main` es API de Bun, no del estándar. Los seeds la usan como
//    guarda de entrypoint (`if (import.meta.main) main();`) para poder
//    importarse sin ejecutarse. Se declara aquí en vez de instalar los tipos
//    completos de Bun: es la única superficie de Bun que este proyecto usa
//    fuera de `bun:test`, que ya se resuelve por `paths` al shim de vitest.
interface ImportMeta {
  /** true cuando el módulo es el punto de entrada del proceso (Bun). */
  readonly main: boolean;
}
