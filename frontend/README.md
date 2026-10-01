# PDF Mapper – Frontend

SPA en **React + TypeScript + Vite** para mapear **visualmente** reportes PDF/TXT de formato desconocido a Excel.
Consume la API REST descrita en [`docs/architecture/api-contract.md`](../docs/architecture/api-contract.md).

## Flujo de uso

1. **Archivos** (`/`): arrastra un PDF/TXT o pulsa _Seleccionar archivo_. Los archivos pesados se suben en fragmentos
   (3 en paralelo, con reintentos y **reanudación** si se corta la conexión). Luego el backend extrae el texto y se ve el progreso.
2. **Mapeador** (`/files/:id/map?template=…`):
   - **1. Reglas y campos**: haz clic en una línea → _Crear regla desde esta línea_ (regex sugerida por el backend).
     **Arrastra el ratón sobre los caracteres** de una línea para crear un campo; las bandas de colores sobre la regla de
     columnas se pueden **mover/redimensionar** con el ratón o el teclado (flechas, Mayús+flechas, Alt+flechas).
     _Detectar columnas_ propone campos automáticamente. Las líneas se colorean según la regla que coincide.
   - **2. Diseño Excel**: arrastra las fuentes (campos) a la franja de columnas, suéltalas sobre una columna para añadir
     alternativas y reordena columnas arrastrando por ⠿. Vista previa en vivo con estadísticas de cuadre.
   - **3. Procesar**: procesa el archivo completo en segundo plano, con progreso, cancelación, resultados paginados y
     descarga XLSX/CSV.
3. **Plantillas** (`/templates`): listar, abrir con un archivo, clonar, exportar/importar JSON y eliminar.

## Scripts

| Script                            | Descripción                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Servidor de desarrollo en http://localhost:5173 (proxy `/api` → http://localhost:8000)                          |
| `npm run build`                   | Compila TypeScript y genera `dist/`                                                                             |
| `npm run preview`                 | Sirve `dist/`                                                                                                   |
| `npm run typecheck`               | `tsc --noEmit`                                                                                                  |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                                                               |
| `npm test`                        | Pruebas unitarias, de componentes y de accesibilidad (Vitest + Testing Library + MSW)                           |
| `npm run test:coverage`           | Igual, con cobertura (umbral: 70 % de líneas)                                                                   |
| `npm run test:a11y`               | Solo pruebas de accesibilidad (axe-core, WCAG 2.1 AA)                                                           |
| `npm run e2e`                     | Pruebas end-to-end con Playwright (requiere backend en :8000; `npx playwright install chromium` la primera vez) |

## Estructura

```
src/
  api/          cliente HTTP tipado + tipos del contrato
  components/   UI compartida (barras de progreso, paneles, badges)
  features/
    upload/     zona de carga y subida por fragmentos
    files/      lista de archivos
    mapper/     visor del documento, reglas, campos, bandas
    designer/   diseñador de columnas Excel (dnd-kit) y vista previa
    jobs/       procesamiento, resultados y descargas
    templates/  gestión de plantillas
  lib/          utilidades puras (fragmentos, selección, solapes, regex, formato…)
  store/        estado del editor de plantillas (zustand)
tests/
  unit/         lógica pura y store
  component/    componentes con MSW
  a11y/         axe-core
  mocks/        backend simulado (MSW)
  fixtures/     datos de prueba
e2e/            Playwright
```

Las pruebas llevan como prefijo el requisito que verifican (`[RF-08]`, `[RNF-05]`…) para la matriz de trazabilidad.

## Docker

```bash
docker build -t pdfmap-frontend .
docker run -p 8080:80 --link backend pdfmap-frontend   # nginx hace proxy de /api a backend:8000
```
