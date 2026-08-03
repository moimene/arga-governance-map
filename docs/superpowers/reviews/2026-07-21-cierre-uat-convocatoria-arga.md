# Cierre UAT — convocatoria integral de ARGA Seguros, S.A.

**Fecha de cierre:** 21 de julio de 2026  
**Estado:** verificado en la aplicación y en `governance_OS`  
**Ámbito:** prototipo DEMO sin efecto jurídico, sin envío o entrega real y sin firma atribuida a EAD Trust

Este documento fija la captura canónica del recorrido completo por el stepper de convocatorias. Sustituye, para conocer el estado operativo actual, a runbooks y referencias anteriores que describían QES, ERDS o generación final en navegador como capacidades vigentes.

## 1. Captura canónica

- **Convocatoria UAT:** `ef574517-448c-4a39-83e2-fed804bf9ce8`.
- **Reunión materializada:** `ac961a00-0a5d-4439-a8d4-618a0dd804b2`.
- **Órgano y entidad:** Consejo de Administración de ARGA Seguros, S.A.
- **Fecha prevista:** 9 de agosto de 2026, 10:00, presencial.
- **Estado de la reunión:** `CONVOCADA`; la aplicación bloquea correctamente su apertura anticipada.

Estos UUID identifican una evidencia UAT concreta. No deben convertirse en constantes, fixtures ni seeds.

La captura anterior `78057c36-e150-47b8-aba1-5566c8e6c3b6` quedó rectificada y su reunión fue cancelada. Se conserva como trazabilidad histórica y no es el entregable canónico.

## 2. Orden del día verificado

El expediente cubre las cinco materias solicitadas y mantiene separados los puntos informativos de los acuerdos:

1. Informe del Director General sobre la marcha de la Sociedad, sin propuesta de acuerdo.
2. Informe sobre aspectos determinados de gobierno y cumplimiento, sin propuesta de acuerdo.
3. Formulación de las cuentas anuales individuales y consolidadas del ejercicio 2025, tratada como regularización extemporánea y vinculada al deber del artículo 253.1 LSC.
4. Nombramiento de representante persona física de ARGA Seguros, S.A. en ARGA Digital, S.L.U., condicionado a que la filial mantenga la configuración societaria demo acreditada y sin confundir la representación del socio único con un supuesto de administrador persona jurídica del artículo 212 bis LSC.
5. Otorgamiento de poderes al CFO con escala demo: hasta 1.000.000 euros individualmente; más de 1.000.000 y hasta 5.000.000 euros de forma mancomunada con el Director General; más de 5.000.000 euros, reservado al Consejo.

## 3. Recorrido y evidencias

- Stepper completado: **8/8 pasos**.
- Destinatarios vinculados: **15**.
- Requisitos PRE: **6/6**.
- Anexos con intención previa y registro WORM: **9/9**.
- Coincidencia entre intenciones y soportes finales: conjunto exacto, sin faltantes ni sobrantes.
- Documento de convocatoria: **13 páginas**, revisadas visualmente y con integridad OOXML validada.

El documento final se renderizó exclusivamente en servidor a partir del manifiesto inmutable, bajo el contrato de renderer `2026-07-21.1`. El compositor genérico del navegador no es una vía válida para el artefacto final de convocatoria.

## 4. Invariantes de integridad

1. Cada anexo requiere una intención registrada antes de su almacenamiento definitivo.
2. La emisión solo puede cerrarse cuando el conjunto exacto de soportes coincide con el conjunto de intenciones WORM.
3. Las trazas incorporadas al manifiesto quedan congeladas al emitir.
4. Un artefacto final emitido o un expediente rectificado no se sobrescriben.
5. Una corrección exige rectificación gobernada y una nueva captura completa.
6. El renderer server-side consume el manifiesto inmutable; no reconstruye el expediente desde estado mutable de UI.

## 5. Frontera EAD Trust

En el alcance vigente, EAD Trust se usa como capa de interposición, mensajería básica y custodia/e-archiving. Los nombres de hooks, RPC o códigos QES/ERDS heredados son compatibilidad legacy y no prueban ni autorizan:

- firma simple, avanzada o cualificada;
- ERDS;
- envío o entrega;
- interacción real con el proveedor.

Cualquier ampliación de esa frontera requiere evidencia contractual y técnica separada.

## 6. Superficies técnicas fijadas

- `src/lib/secretaria/convocation-agenda-gates.ts`
- `src/lib/secretaria/convocatoria-capa3-resolver.ts`
- `src/lib/secretaria/convocation-artifact-registration.ts`
- `src/lib/secretaria/convocation-supporting-artifact-registration.ts`
- `supabase/functions/convocation-artifact-register/index.ts`
- `supabase/functions/convocation-artifact-register/renderer.ts`
- `supabase/functions/convocation-supporting-artifact-register/index.ts`
- `supabase/migrations/20260720149000_secretaria_supporting_attachment_intent_binding.sql`

La migración focal se verificó en repo y Cloud. Las Edge Functions verificadas fueron `convocation-artifact-register` v5 y `convocation-supporting-artifact-register` v1. Esto no equivale a afirmar paridad global de todo el historial de migraciones, que conserva drift histórico previo.

## 7. Gates de cierre

- `bun run db:check-target`: correcto contra `governance_OS`.
- `bun test`: **3110 pass / 152 skipped / 0 fail**.
- `bun run lint`: correcto.
- `bun run typecheck`: correcto.
- `bun run build`: correcto.
- Navegación UAT: recorrido completo observado en navegador.
- Documento: revisión visual de las 13 páginas e inspección OOXML correctas.

La captura queda cerrada como evidencia de validación funcional DEMO. No debe presentarse como operación productiva, acto societario eficaz, notificación entregada ni artefacto firmado por un prestador cualificado.
