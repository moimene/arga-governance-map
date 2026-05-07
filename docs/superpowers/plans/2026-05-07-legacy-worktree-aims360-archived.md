# Worktree legacy `arga-governance-map-aims360` — Archivado

Fecha: 2026-05-07
Worktree principal: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`
Rama: `main`
Cierra: INC-12 del backlog de saneamiento integral.

## Resultado

El worktree legacy `arga-governance-map-aims360` quedó **archivado en disco**, neutralizado técnicamente y conscientemente excluido de cualquier carril operativo. El plan completo de 11 fases del inventario `2026-05-06-legacy-worktree-aims360-inventario.md` se ejecutó comprimido a 5 pasos según la auto-crítica adversarial del 2026-05-06.

## Estado pre-archivado

- Ruta original: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map-aims360`
- Tipo: worktree git ligado al repo principal (no repo independiente). `.git` apuntaba a `arga-governance-map/.git/worktrees/arga-governance-map-aims360`.
- Rama: `codex/aims360` en HEAD `93428ae`.
- 12 ramas locales totales.
- 167 archivos modificados/borrados en working tree (130 migraciones SQL borradas localmente, ya aplicadas en Cloud).
- 245 archivos untracked (~4 MB), incluyendo 22 docs/schema-registry, 3 planes superpowers, 5 e2e specs, 4 PDFs/PPTX EAD Trust, 2 stashes.

## Pasos ejecutados

### Paso 1 — Verificación de commits únicos en las 12 ramas

Comando ejecutado dentro del worktree legacy:

```bash
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/) ; do
  count=$(git rev-list --count origin/main..$b)
  echo "$b — $count commits ahead"
done
```

Resultado: **0 commits únicos en las 12 ramas locales** vs `origin/main`. Esto cierra el supuesto crítico de la auto-crítica adversarial 2026-05-06 ("verificación solo cubre 1 de 8 ramas"). No hay pérdida de commits al archivar.

Ramas verificadas:

```
claude/crazy-diffie-9bf775                   — 0
codex/aims360                                — 0
codex/ux-lovable-sync                        — 0
feat/canonical-identity-model-phase-0-1      — 0
fix/personas-g2                              — 0
fix/sociedades-g1                            — 0
main                                         — 0
sprint-i/gas-completeness                    — 0
worktree-agent-a1ead8b5                      — 0
worktree-agent-a475964d                      — 0
worktree-agent-aa19998d                      — 0
worktree-agent-af325be0                      — 0
```

### Paso 2 — Backup tarball

```bash
mkdir -p ~/Dropbox/backups
tar czf ~/Dropbox/backups/arga-aims360-20260507.tgz \
  -C /Users/moisesmenendez/Dropbox/DESARROLLO arga-governance-map-aims360
```

Backup creado:

- Ruta: `~/Dropbox/backups/arga-aims360-20260507.tgz`
- Tamaño: 69 MB
- SHA-256: `eab99eb42f748d6464f3052f684fe71abe55c9521dd8799c49716707f37e259c`

### Paso 3a — Neutralización técnica del `.env`

Único archivo `.env` encontrado: `.auth/.env` (135 bytes, parece config de Playwright/E2E). No había `.env` raíz, ni `.envrc`, ni `docs/superpowers/plans/.env`.

```bash
mv arga-governance-map-aims360/.auth/.env \
   arga-governance-map-aims360/.auth/.env.archived
```

Defensa técnica: cualquier proceso que arranque dentro del directorio archivado e intente cargar `.auth/.env` (cliente E2E, Supabase auth) fallará por archivo inexistente, en lugar de depender de la disciplina humana de "no trabajar ahí".

### Paso 3b — `mv` + `git worktree repair`

```bash
mv arga-governance-map-aims360 arga-governance-map-aims360-archived-20260507
cd arga-governance-map
git worktree repair /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map-aims360-archived-20260507
```

`git worktree repair` actualizó el pointer `gitdir` para que el repo principal reconozca la nueva ruta. Verificación post-mv con `git worktree list`:

```
arga-governance-map                                         410b7a6 [main]
arga-governance-map-aims360-archived-20260507               93428ae [codex/aims360]
arga-governance-map/.claude/worktrees/agent-{4×}            df03d20 [worktree-agent-*] locked
arga-governance-map/.claude/worktrees/crazy-diffie-9bf775   93428ae [claude/crazy-diffie-9bf775]
```

Los 5 worktrees `.claude/*` (sub-worktrees experimentales del repo principal) quedan **fuera del alcance de este archivado** y se resolverán en una sesión separada si procede.

## Material descartado conscientemente

Las decisiones sobre el material untracked del worktree legacy:

| Material | Decisión | Razón |
|---|---|---|
| 22 docs/schema-registry/ (2026-04-27 a 2026-04-29) | Descartado conscientemente | Análisis de gaps obsoletos vs estado a 2026-05-07. Si algo crítico hubiera, ya se habría echado en falta. Backup tarball los preserva por si reaparece la necesidad. |
| 3 planes superpowers untracked | Descartado conscientemente | El SUPERSEDED ya marcado; los otros dos son roadmaps largos potencialmente obsoletos. Tarball los preserva. |
| 5 e2e specs únicos | Descartado conscientemente | Conflicto de numeración con specs vigentes; el repo principal tiene 35 specs activos y verde-base. |
| 4 PDFs/PPTX EAD Trust de marketing | Descartado del repo | No son código. Si se necesitan, viven en `Dropbox/DESARROLLO/assets/` o equivalente. |
| 2 stashes (`supabase-schema-hold`, `pre-lovable-sync`) | Descartado conscientemente | El primer stash trae types regenerados ya superados; el segundo trae CLAUDE.md/contratos/planes ya superados o portados. Tarball los preserva. |
| 130 migraciones SQL borradas localmente | Sin impacto | Ya aplicadas en Cloud (HOLD `000049` el último según CLAUDE.md). La supresión local nunca fue commiteada. |

## Ruta de reactivación si se necesita en el futuro

Si más adelante se descubre que algún material del worktree archivado era valioso:

```bash
# 1. Extraer el tarball
mkdir -p /tmp/aims360-recovery
tar xzf ~/Dropbox/backups/arga-aims360-20260507.tgz -C /tmp/aims360-recovery

# 2. Acceder al material untracked en /tmp/aims360-recovery/arga-governance-map-aims360/
# 3. Portar lo necesario al worktree principal mediante cp + commit revisado
# 4. Si se necesita git history, las ramas están preservadas en el .git del archivo
```

## Verificación post-archivado

| Comando | Resultado |
|---|---|
| `git worktree list` | nueva ruta archivada visible, sin "prunable" |
| `ls /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map-aims360` | no existe (movido) |
| `ls /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map-aims360-archived-20260507` | existe, contenido íntegro |
| `ls .auth/.env` (en archivado) | no existe (renombrado) |
| `ls .auth/.env.archived` (en archivado) | existe, 135 bytes |
| `~/Dropbox/backups/arga-aims360-20260507.tgz` | 69 MB, sha256 `eab99eb4…` |

## Política derivada

La auto-crítica adversarial 2026-05-06 señalaba que la regla "no trabajar en el worktree legacy" dependía de disciplina humana. Esta archivación añade **dos capas de control técnico**:

1. **Renombrado del directorio** a `*-archived-20260507`: cualquier comando que dependa de la ruta original falla por path inexistente.
2. **Neutralización del `.env`**: cualquier proceso que arranque dentro del directorio archivado e intente cargar `.auth/.env` falla.

La regla en CLAUDE.md y AGENTS.md queda actualizada para reflejar la nueva ruta y los controles técnicos.

## Pendientes derivados (fuera del alcance de INC-12)

- **5 worktrees `.claude/worktrees/*`** dentro del repo principal: 4 `agent-*` locked y 1 `crazy-diffie-9bf775`. Resolver en sesión separada (probablemente `git worktree remove --force` para los locked + `git branch -D` de las ramas correspondientes).
- **2 worktrees `prunable`** en `/private/tmp/`: ejecutar `git worktree prune` cuando sea oportuno.

## No secretos

Este documento no contiene credenciales, tokens, claves de Supabase ni secretos. La ruta `.auth/.env.archived` existe en el directorio archivado pero no se ha copiado ningún valor en este documento.

## Verificación

```md
Outcome:
- INC-12 RESUELTO ✅
- Worktree legacy archivado: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map-aims360-archived-20260507
- Backup: ~/Dropbox/backups/arga-aims360-20260507.tgz (69 MB)
- Backup sha256: eab99eb42f748d6464f3052f684fe71abe55c9521dd8799c49716707f37e259c
- 12 ramas verificadas con 0 commits únicos
- .env neutralizado a .env.archived
- git worktree list refleja nueva ruta
- CLAUDE.md y AGENTS.md actualizados
- Pendiente futuro: 5 worktrees .claude/worktrees/* en repo principal
```
