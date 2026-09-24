# Pack base LSC — snapshot

Suelo jurídico común (España, SA y SL) que recibe todo tenant que nace en blanco: rule packs, rule sets de jurisdicción y plantillas `ACTIVA`.

**No se edita a mano.** Es texto jurídico revisado, congelado desde el estado vivo de Cloud. `MANIFEST.json` guarda el sha256 de cada fichero y `cargarPackBase()` se niega a cargar uno que no case. Para actualizarlo:

```
bun run scripts/export-pack-base-lsc.ts            # resumen, no escribe
bun run scripts/export-pack-base-lsc.ts --write    # regenera los cuatro ficheros
bun test src/test/tenants/pack-base-lsc.test.ts
```

El exportador solo **lee** de Cloud. Revisa el diff antes de darlo por bueno: cada línea que cambie es una regla o una plantilla que cambió en origen.

`notas_legal_origen` y `aprobada_por_origen` conservan la procedencia y por eso mencionan al tenant de origen; ningún campo que llegue a un documento lo hace, y un test lo vigila.

Diseño, reglas de selección y la única transformación admitida: `docs/superpowers/specs/2026-09-19-tenant-cero-onboarding-design.md` §5.
