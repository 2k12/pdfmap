# ADR-005: React + Vite + TypeScript + dnd-kit para el frontend

- **Estado**: Aceptado · **Fecha**: 2026-10-01 · **Requisitos**: RF-01, RF-08, RF-11, RNF-04, RNF-05

## Contexto
El usuario pidió React y una experiencia **totalmente gráfica**: arrastrar archivos, arrastrar sobre el texto para
definir campos y arrastrar columnas para diseñar el Excel, con accesibilidad AA.

## Opciones
- Bundler: **Vite** (rápido, ESM, Vitest integrado) vs. CRA (deprecado) vs. Next.js (SSR innecesario).
- Drag & drop: **dnd-kit** (accesible, sensores de teclado, ligero) vs. react-beautiful-dnd (archivado) vs. HTML5 DnD nativo (sin teclado).
- Selección sobre el texto: componente propio con eventos de puntero (mapeo píxel → columna con ancho de carácter monoespaciado).

## Decisión
React + TypeScript (`strict`) + Vite; dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) para ordenar columnas y reglas;
selección de campos propia; Vitest + Testing Library para pruebas unitarias/componentes; Playwright + axe para E2E y accesibilidad.

## Consecuencias
- ✅ El `KeyboardSensor` de dnd-kit cumple RNF-05 para el reordenamiento.
- ✅ Vitest comparte la configuración de Vite: pruebas rápidas en CI.
- ⚠️ La selección personalizada requiere una alternativa por teclado (inputs numéricos de inicio/fin) para la accesibilidad.
