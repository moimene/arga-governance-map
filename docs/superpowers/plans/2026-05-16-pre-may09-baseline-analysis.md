# Pre-May09 Supabase baseline analysis

Fecha: 2026-05-16

Rama: `codex/platform-pre-may09-baseline`

## Alcance

Cluster `pre-may09-baseline`:

- abril completo;
- mayo 4-5;
- versiones local-only y remote-only anteriores a `20260509`.

No se han ejecutado escrituras Cloud, `db push`, `db pull`, `repair`, renombres ni cambios funcionales.

Este informe depende del export read-only abierto en PR #29.

## Conclusion

La estrategia correcta es mixta, con sesgo fuerte a reconstruccion Git desde el ledger remoto.

No es un problema de timestamps. Hay bifurcacion real:

- Cloud tiene una historia granular.
- Local conserva migraciones consolidadas, renombradas o con contenido distinto.

Si se quiere recuperar operativa normal de migraciones, `supabase/migrations` debe representar el ledger Cloud aplicado. La deuda aceptable debe quedar archivada/documentada, no activa.

## Datos principales

| Metrica | Valor |
|---|---:|
| Remotas pre-May09 | 91 |
| Locales legacy pre-May09 | 45 |
| Remotas sin fichero local activo | 69 |
| Nombre candidato pero SHA distinto | 21 |
| SHA exacto | 1 |

SHA exacto detectado:

```text
20260424182718_000040_no_session_resolutions_matter_class
↔ supabase/migrations/20260424_000040_no_session_resolutions_matter_class.sql
```

## Riesgos

1. Si se añaden remotas sin retirar legacy locales, `db push` seguira bloqueado por local-only.
2. Si se retiran legacy sin recuperar remotas, se pierde trazabilidad Git de Cloud.
3. Los `name_candidate_diff_content` no son equivalencias: requieren revision o reemplazo por SQL remoto exacto.
4. Ejecutar `repair` seria incorrecto: ocultaria la divergencia en vez de hacer que Git represente Cloud.
5. Un reset local/fresh setup puede romper durante la transicion si se mezclan remotas recuperadas con legacy activos.

## Descomposicion de PRs recomendada

1. `pre-may09-baseline-analysis`
   - Solo documento de estrategia.
2. `pre-may09-recover-20260417-18`
   - Recuperar SQL remoto aplicado 17-18 a `supabase/migrations`.
3. `pre-may09-recover-20260419-20`
   - Recuperar SQL remoto 19-20.
   - Mover legacy local 20260419/20260420 a `docs/superpowers/retired-migrations/`.
4. `pre-may09-recover-20260421`
   - Recuperar secuencia granular modelo canonico/F1-F10.
   - Retirar consolidados locales 20260421.
5. `pre-may09-recover-20260423-24`
   - Resolver user profiles, sprint G/C, catalogo, deed y reglas.
   - Unico rename claramente seguro: `000040` por SHA exacto.
6. `pre-may09-recover-20260426-0505`
   - Recuperar AIMS/GRC/P0 y mayo 4-5.
   - Especial cuidado con RPC P0: SHA distinto, estrategia remote-first.
7. `baseline-final-verification`
   - `supabase migration list | tail -n 160`
   - Documentar drifts resueltos, aceptados o bloqueantes.

## Go / No-Go

No-Go para `supabase db push` todavia.

Go para carriles Git-only secuenciales, siempre con:

- PR pequeno;
- sin Cloud writes;
- sin `repair`;
- sin `db push`;
- sin `db pull`;
- sin tocar funcionalidad.
