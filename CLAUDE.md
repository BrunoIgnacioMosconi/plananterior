# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"Plan Nutricional" is a single-page, Spanish-language PWA for tracking daily meals, water, and supplements. It is plain HTML + CSS + vanilla JS — **no build step, no package manager, no tests, no framework**. The repo is deployed via GitHub Pages from `master` (remote: `BrunoIgnacioMosconi/plananterior`).

## Running locally

Open `index.html` directly in a browser, or serve the directory statically (any of these work from the repo root):

```bash
python3 -m http.server 8000
# or
npx serve .
```

A static server is preferred over `file://` because the service worker only registers on `http(s)://`.

## Cache busting after edits

`service-worker.js` precaches `index.html`, `styles.css`, `app.js`, `manifest.json`, and the icons under `CACHE_NAME` (currently `'nutricion-v5'`). When you change any of those files, **bump `CACHE_NAME`** (e.g. `'nutricion-v6'`). On the next load the new SW will:

- precache the new versions on `install`,
- `skipWaiting()` so it activates immediately,
- delete any old `nutricion-*` caches in `activate`,
- `clients.claim()` so open pages start using it without a second reload.

Additionally, `app.js` listens for `controllerchange` (after a prior controller existed) and force-reloads the page once the new SW claims it. Net effect: an existing user sees the new version on the **first** open after a deploy, not the second. The `hadController` guard prevents a reload loop on the very first install.

The `fetch` handler is cache-first (`caches.match` then network fallback) and never revalidates entries individually, so the `CACHE_NAME` bump is the only mechanism that promotes new files to users.

The `?v=1.0.1` query on the manifest `<link>` in `index.html` is a separate mechanism — it only busts the browser's HTTP cache for that one request, and does **not** affect the service worker (which caches `manifest.json` without a query). Don't conflate the two.

## Architecture

Everything runs out of `app.js` (~1500 lines, top-level script, no modules). `index.html` is mostly static markup with four tab sections (`Principal`, `Historial`, `Configuración`, `Ayuda`); `app.js` populates them on `DOMContentLoaded` (see `app.js:1447`).

### Data model — all in `localStorage`

There is no backend. Every piece of state lives in `localStorage` under these keys:

| Key | Shape | Purpose |
| --- | --- | --- |
| `historialComidas` | `[{ fecha, nombre, seleccion }]` | Completed meals across all days. `fecha` is an `es-AR` locale date string. |
| `waterCounts` | `{ [fecha]: number }` | Glasses of water per day. |
| `suplementosPorDia` | `{ [fecha]: string[] }` | Supplements checked off per day. |
| `opcionesDropdowns` | `{ [grupoKey]: string[] }` | User-customized dropdown options. Overrides the default `opciones` const. |
| `comidasEntrenamiento` / `comidasNoEntrenamiento` | `[{ nombre, tipo, grupos: string[] }]` | User-customized meal-to-food-group mapping per day type. Overrides the default consts. |

Dates everywhere use `new Date().toLocaleDateString('es-AR')` (DD/MM/YYYY) — keep that format consistent or historical lookups will miss.

### Defaults vs. saved state — important asymmetry

The in-source defaults and the saved state interact differently for the two configurable consts. This is the easiest thing to get wrong when modifying defaults:

- **`opciones`** (`app.js:334`) is **never mutated**. Reads always go through `getOpciones()`, which returns `localStorage.opcionesDropdowns` if present, else a deep clone of `opciones`. Edits to the source literal only affect users whose `opcionesDropdowns` key is absent.
- **`comidasEntrenamiento` / `comidasNoEntrenamiento`** (`app.js:466`, `app.js:506`) are declared `const` but their **contents are mutated in place** at runtime — `cargarConfiguracionComidas()` (`app.js:305`) and CSV import do `arr.length = 0; saved.forEach(x => arr.push(x))`. After that runs, the literal in the source no longer reflects in-memory state. Direct reads of `comidasEntrenamiento` are intentional (see `cargarComidas` at `app.js:643`); the array identity is stable but the contents are not.

Practical consequence: editing the default `comidas*` arrays in source **will not reach existing users** until they hit "Reiniciar aplicación" (`app.js:1500`), which does `localStorage.clear()` + reload — the only documented way to roll users back to in-source defaults.

### Meal configuration

Two day types drive what UI appears on the `Principal` tab:

- `comidasEntrenamiento` (training day, `app.js:466`)
- `comidasNoEntrenamiento` (rest day, `app.js:506`)

Each entry has `nombre` (display name), `tipo` (suffix used to disambiguate dropdown option groups), and `grupos` (a list of food-group keys; duplicates are intentional — e.g. two `proteinas` entries render two protein dropdowns).

`crearSelector(grupo, idx, tipo, selected)` (`app.js:546`) resolves `grupo + tipo` to a key in `opciones` — e.g. `("proteinas", "almuerzo_entrenamiento")` → `proteinas_almuerzo_entrenamiento`. When adding a new meal type or food group, the key-resolution logic in `crearSelector` must understand the new `tipo`, **and** matching keys must exist in the default `opciones` object (`app.js:334`).

### Render flow

The UI re-renders by re-running these functions; there is no virtual DOM or reactivity:

- `cargarComidas()` — `Principal` tab meal list
- `cargarHistorial()` — `Historial` tab
- `cargarSuplementosDia()` — supplement checkboxes
- `renderOpcionesForm()` — `Configuración` tab editor

After mutating `localStorage`, call the relevant `cargar*` / `render*` function(s) to refresh the DOM. All styling lives in `styles.css` — `app.js` adds classes (`comida-completada`, `suplemento-check.checked`, `historial-badge--agua`, etc.) rather than setting `element.style.X`. CSS variables drive colors; a `@media (prefers-color-scheme: dark)` block at the top of `styles.css` overrides them, so theme changes propagate everywhere automatically. Fonts are system-stack (no Google Fonts download, so offline rendering looks the same as online).

### CSV import/export

`exportarHistorialCSV` / `importarHistorialCSV` (`app.js:54`, `app.js:120`) round-trip everything: history, water, supplements, customized dropdown options, and customized meal configs. The format is a single CSV with named section headers (`Opciones de Dropdowns`, `Configuración de Comidas - Entrenamiento`, `Configuración de Comidas - Sin Entrenamiento`) separating tables. The parser locates sections by header substring match, so renaming any header is a breaking change for users with existing backups.

### Undo stacks

`eliminadosStack` and `gruposEliminadosStack` (`app.js:3`) back the "deshacer" toast messages in `mostrarMensajeRestaurar` / `mostrarMensajeRestaurarGrupo`. They are in-memory only — undo state is lost on reload.

## Language

All UI strings, comments, variable names, and `localStorage` keys are in Spanish. Match that convention when adding code; mixing English identifiers makes the file harder to navigate.
