# Ensayo revertido — MOI-150 (órgano de gobierno de la IA del grupo nuevo)

Fecha: 2026-10-02. Cabecera Cloud: `20260928160000` (sin cambios). MCP `execute_sql`, `begin … rollback`.

Decisión aplicada: D-28 (órgano = Consejo de Administración de Corporación Nueva, S.A., `db8073bb…`, hipótesis a validar) y
D-28 bis (completar la RPC de sujetos con el órgano, sin fabricar una política de IA).

## Por qué el script no se ejecutó en seco desde aquí

`scripts/aims/seed-organo-ia-grupo-nuevo.ts` inicia sesión con `admin@` del grupo nuevo y necesita `DEMO_PASSWORD_NUEVO`, que solo
vive en el `.env` del Mac de Moisés. El ensayo SQL de abajo hace exactamente la misma llamada (mismos argumentos, misma cuenta)
dentro de una transacción revertida. Para la aplicación: `bun run scripts/aims/seed-organo-ia-grupo-nuevo.ts` (en seco) y,
con OK, `--commit`, después de aplicar la migración `20261002101000`.

## Resultado

Huella del cuerpo de la RPC creada en el ensayo: `1ff7e6460abcba8ed5d729ccba36b1ea`, idéntica a la del fichero.

```
paso 1  grupo nuevo: sujeto … status=PROPUESTO órgano=db8073bb-5089-4bbf-a9a9-456d457f59b7
paso 2  lectura del panel en el grupo nuevo → db8073bb-5089-4bbf-a9a9-456d457f59b7
paso 3  negativo órgano ajeno → 42501 ORGANO_DE_OTRO_TENANT
paso 4  negativo ARGA con órgano del grupo nuevo → 42501 ORGANO_DE_OTRO_TENANT
paso 5  lo que ve ARGA: sujetos con órgano visibles = 0
paso 6  sujetos con órgano por tenant dentro del ensayo: …0001:0  …0002:0  …0003:1
```

Después (solo lectura): `sin_firma_nueva=true`, `sujetos_grupo_nuevo=0`, `con_organo=0`. Nada quedó en Cloud.

## Qué ve cada grupo tras aplicar

- Grupo nuevo: panel «Órgano rector» con el Consejo de Corporación Nueva (vía `aims_ria_subjects.governing_body_id`).
- Garrigues: sin cambio (su panel sale de la política PI-30, `policies.owner_body_id`).
- ARGA: sin cambio en este paso (ninguno de sus 13 sujetos lleva órgano).

Pendiente de verificar con sesión real tras aplicar: `e2e/72-verif-moi150-organo-ia.spec.ts`.
