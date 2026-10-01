## Resumen
<!-- Qué cambia y por qué -->

## Requisito / issue
- Requisito: RF-__ / RNF-__
- Closes #

## Tipo de cambio
- [ ] feat · [ ] fix · [ ] test · [ ] docs · [ ] refactor · [ ] perf · [ ] ci/build · [ ] chore
- [ ] ⚠️ Cambio incompatible (API o esquema de plantilla)

## Pruebas
- [ ] Unitarias (`backend/tests/unit`, `frontend/tests/unit`)
- [ ] Componentes (`frontend/tests/component`)
- [ ] Integración (`backend/tests/integration`)
- [ ] API (`backend/tests/api`)
- [ ] Contrato OpenAPI (`backend/tests/contract`)
- [ ] Seguridad (`backend/tests/security`)
- [ ] Regresión / golden (`backend/tests/regression`)
- [ ] E2E (`frontend/e2e`)
- [ ] Accesibilidad (`frontend/tests/a11y`)
- [ ] Rendimiento (`backend/tests/performance`) — si afecta la extracción/exportación
- [ ] Tests marcados con `@pytest.mark.req("RF-xx")` / prefijo `[RF-xx]`
- [ ] No aplica (justificar):

## Documentación
- [ ] SRS / contrato API / modelo de plantilla actualizados
- [ ] RTM (`docs/04-testing/matriz-trazabilidad-RTM.md`) y casos de prueba actualizados
- [ ] `CHANGELOG.md` (Unreleased)

## Checklist
- [ ] ruff + mypy / eslint + tsc sin errores
- [ ] Cobertura ≥ 80 % backend / ≥ 70 % frontend
- [ ] **Sin datos reales de clientes** ni secretos en el diff
- [ ] Dependencias de Python solo en `requirements*.txt` (sin instalación global)

## Capturas / evidencia
