# Original User Request

## Initial Request — 2026-08-27T05:58:08Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full agent team

Implement the remediation plan to decouple the Garrigues modules (Secretaria, GRC, AI Governance) from the ARGA demo environment, removing hardcoded references and establishing a standalone packaging structure.

Working directory: /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map
Integrity mode: development

## Requirements

### R1. Eliminar referencias hardcodeadas
Abstraer cadenas de texto y referencias hardcodeadas a "ARGA" y "TGMS" dentro de los módulos `src/secretaria` y `src/grc`. Utilizar el `TenantBrandContext` existente o variables de configuración para inyectar estos valores dinámicamente.

### R2. Empaquetado Modular (Layout Independiente)
Proveer un contenedor/layout alternativo para los módulos de Garrigues, de forma que puedan instanciarse y navegarse sin depender del `ShellLayout.tsx` principal (que contiene el menú de la demostración ARGA).

## Acceptance Criteria

### Desacoplamiento (Auditoría de Agente)
- [ ] Un agente independiente puede auditar el código fuente e identificar que ninguna cadena literal como `"ARGA"` o `"TGMS"` está hardcodeada en las vistas de los módulos `src/secretaria` y `src/grc`.
- [ ] Un agente independiente confirma la existencia de un `GarriguesStandaloneLayout.tsx` (o similar) que importa y envuelve correctamente las rutas de los módulos sin depender del shell principal.
- [ ] La compilación del proyecto (TypeScript y Build) finaliza sin errores tras los cambios.
