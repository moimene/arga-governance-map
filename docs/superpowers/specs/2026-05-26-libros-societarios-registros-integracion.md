# Libros societarios y registros auxiliares — integración Secretaría 360

Fecha: 2026-05-26
Ámbito: `arga-governance-map`, módulo `/secretaria/*`

## Objetivo

Refactorizar la sección de libros para que deje de ser un listado plano y pase a representar la realidad societaria de ARGA:

- Libros mercantiles obligatorios por sociedad, tipo social y órgano.
- Registros auxiliares de gobernanza que no sustituyen al libro legal, pero sostienen la trazabilidad del acuerdo.
- Integración visible con los steppers que generan actas, decisiones sin sesión, decisiones unipersonales, certificaciones y trámites posteriores.

## Principios

1. ARGA es una sociedad demo aseguradora cotizada; nunca usar datos reales del cliente.
2. Los libros obligatorios son la base formal: actas, socios/acciones, contratos del socio único y libros contables.
3. Los registros auxiliares son computables y no legalizables: cargos, conflictos, delegaciones, poderes, pactos parasociales, comunicaciones regulatorias, idoneidad y Solvencia II.
4. Para comisiones delegadas se adopta criterio prudente: libro/sección separada por comisión en la dominante cotizada, con nota de incertidumbre sobre legalización registral.
5. El UI debe funcionar con el schema actual de `mandatory_books`; la migración añadirá metadatos y siembra futura, pero no será requisito para renderizar.

## Taxonomía canónica

### Libros obligatorios

| Código | Aplica | Base | Legalización | Custodia |
|---|---|---|---|---|
| `LIBRO_ACTAS_JUNTA_GENERAL` | sociedades con Junta | arts. 202-203 LSC; arts. 97-107 RRM | obligatoria | Secretario del CdA |
| `LIBRO_ACTAS_CONSEJO_ADMINISTRACION` | consejo de administración | art. 250 LSC; art. 109 RRM | obligatoria | Secretario del CdA |
| `LIBRO_ACTAS_COMISION_AUDITORIA` | cotizada | art. 529 quaterdecies LSC | recomendada/separada | Secretario comisión |
| `LIBRO_ACTAS_COMISION_NOMBRAMIENTOS_RETRIBUCIONES` | cotizada | art. 529 quindecies LSC | recomendada/separada | Secretario comisión |
| `LIBRO_ACTAS_COMISION_RIESGOS` | aseguradora | arts. 65-66 Ley 20/2015; arts. 44-46 RD 1060/2015; reglamento del Consejo | recomendada/separada | Secretario comisión |
| `LIBRO_ACTAS_COMISION_EJECUTIVA` | si existe comisión ejecutiva | art. 249 LSC | recomendada/separada | Secretario comisión |
| `LIBRO_ACTAS` | fallback legacy | arts. 202 y 250 LSC | obligatoria | Secretario |
| `LIBRO_REGISTRO_SOCIOS` | SL/SLU | art. 104 LSC | obligatoria | órgano de administración |
| `LIBRO_ACCIONES_NOMINATIVAS` | SA/SAU | art. 116 LSC | obligatoria | órgano de administración |
| `LIBRO_CONTRATOS_SOCIO_UNICO` | SLU/SAU | art. 16 LSC | obligatoria | órgano de administración |
| `LIBRO_DIARIO` | todas | arts. 25 y ss. CCom | obligatoria | dirección financiera |
| `LIBRO_INVENTARIOS_CUENTAS_ANUALES` | todas | arts. 25 y ss. CCom; art. 253 LSC | obligatoria | dirección financiera |

### Registros auxiliares

| Código | Función |
|---|---|
| `REGISTRO_PERSONAS_CARGOS` | continuidad de cargos, autoridad certificante e inscripción RM |
| `REGISTRO_CONFLICTOS_OPERACIONES_VINCULADAS` | abstenciones, conflictos y operaciones vinculadas |
| `REGISTRO_DELEGACIONES_FACULTADES` | alcance de delegaciones, límites del art. 249 bis LSC |
| `REGISTRO_PODERES_REPRESENTACIONES` | poderes y representaciones puntuales |
| `REGISTRO_PACTOS_PARASOCIALES` | vetos, compromisos de voto y alertas contractuales |
| `REGISTRO_COMUNICACIONES_REGULATORIAS` | CNMV/DGSFP y obligaciones de supervisión |
| `REGISTRO_IDONEIDAD_FIT_PROPER` | consejeros/directivos clave en aseguradora |
| `REGISTRO_SOLVENCIA_II_SUPERVISION` | SFCR, RSR y evidencias de Pilar 3 |

## Integración funcional

1. Alta de sociedad:
   - La RPC/trigger debe sembrar la cartera esperada según `tipo_social`, `es_cotizada`, `regulated_sector` y órganos existentes.
   - Si los órganos se crean después, la UI debe poder sintetizar libros por órgano desde `governing_bodies`.

2. Mantenimiento:
   - La pantalla `/secretaria/libros` debe mostrar grupo, base legal, custodia, legalización, plazo, estado operativo, asientos y ruta natural.
   - Los estados de vencimiento se clasifican como vencido, vence pronto, en plazo, legalizado o sin plazo.

3. Steppers:
   - Reunión: el cierre informa el libro de actas destino según `body_type` y nombre de órgano.
   - Acuerdo sin sesión, co-aprobación y solidario: se documentan como acta escrita o de órgano y se anuncian como asiento del libro de actas del órgano.
   - Decisión unipersonal: se anuncia como acta/consignación y, si procede, como entrada del libro de contratos del socio único.
   - Certificación y registro público siguen bloqueados por acta aprobada/firmada cuando aplique; los libros no sustituyen ese gate.

## Compatibilidad

- Mantener soporte para códigos legacy: `ACTAS`, `SOCIOS`, `ACCIONES`, `SOCIO_UNICO`.
- Mantener `data-testid="libros-mobile-list"` y `data-testid="libros-desktop-table"`.
- No introducir clases Tailwind nativas de color ni hexadecimales en componentes Garrigues.
- La ruta no debe volver a mostrar "Vista no disponible".
