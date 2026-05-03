# Design System

## Overview

TGMS uses two related visual systems:

- TGMS shell: red executive platform shell for cross-module composition and readiness.
- Garrigues modules: green institutional module UI for Secretaría, GRC Compass and AI Governance.

The product register is product UI. Visual design should serve repeated expert workflows, not marketing presentation.

## Color

### TGMS Shell

Use `--t-*` tokens from `src/index.css`.

- Primary brand: `--t-brand`
- Primary hover: `--t-brand-hover`
- Page surface: `--t-surface-page`
- Card surface: `--t-surface-card`
- Primary text: `--t-text-primary`
- Secondary text: `--t-text-secondary`
- Default border: `--t-border-default`

### Garrigues Modules

Use `--g-*`, `--status-*` and sidebar HSL tokens. Do not use native Tailwind color names or raw hex classes inside `/secretaria/*`, `/grc/*` or `/ai-governance/*`.

- Brand: `--g-brand-3308`
- Accent: `--g-brand-bright`
- Primary text: `--g-text-primary`
- Secondary text: `--g-text-secondary`
- Page surface: `--g-surface-page`
- Card surface: `--g-surface-card`
- Subtle surface: `--g-surface-subtle`
- State colors: `--status-success`, `--status-warning`, `--status-error`, `--status-info`

## Typography

The shell uses Inter through `src/index.css`. Garrigues modules may use Montserrat where already configured. Text hierarchy should be compact and operational:

- Page H1: restrained executive heading.
- Section headings: short, scannable, sentence-case or title-case.
- Tables and dense cards: small but legible text, no hero-scale typography.

## Layout

Use responsive grid variants instead of fixed desktop-only grids. Core product surfaces should avoid horizontal overflow at 390px, 768px and 1440px. Cards are acceptable for repeated records, tool panels and framed operational surfaces; avoid nested cards and decorative card grids.

## Components

- Navigation: sidebar and drawer patterns must preserve keyboard and screen-reader access.
- Buttons: icon-only buttons require `aria-label`; loading buttons require `aria-busy`.
- Forms: labels must be visible; validation errors require `aria-invalid` and `aria-describedby`.
- Tables: headers should use tokenized subtle surfaces and rows should preserve density.
- Badges: status chips must use tokenized status colors and clear wording.

## Motion

Use restrained transitions. Do not animate layout properties. Avoid bounce, elastic motion and decorative effects.

## Content

Copy should be explicit about ownership and state:

- TGMS composes, routes and shows readiness.
- Owner modules own writes.
- Evidence/legal hold remains HOLD unless explicitly promoted by approved gates.
- Read-only handoffs must not imply mutations.
