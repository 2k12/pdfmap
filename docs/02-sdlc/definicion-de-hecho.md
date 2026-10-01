# Definition of Ready (DoR) y Definition of Done (DoD)

## Definition of Ready — un issue puede entrar al sprint si:
- [ ] Está vinculado a un requisito `RF-xx`/`RNF-xx` del [SRS](../01-requisitos/SRS-IEEE-830.md) (o es un defecto con su ID).
- [ ] Tiene criterios de aceptación verificables (Dado/Cuando/Entonces).
- [ ] Está estimado (puntos) y priorizado (etiqueta `priority/*`).
- [ ] Las dependencias están identificadas y no hay bloqueos abiertos.
- [ ] Si cambia la API o la plantilla, se esbozó el cambio en el contrato.
- [ ] Hay datos de prueba sintéticos disponibles o se planificó crearlos.

## Definition of Done — un incremento está terminado si:
### Código
- [ ] Implementa todos los criterios de aceptación.
- [ ] ruff + mypy (backend) y ESLint + `tsc --noEmit` (frontend) sin errores.
- [ ] Sin secretos ni datos reales (gitleaks verde).

### Pruebas
- [ ] Pruebas unitarias nuevas o actualizadas, marcadas con `@pytest.mark.req("RF-xx")` o con el prefijo `[RF-xx]`.
- [ ] Pruebas de integración/API si cambia un endpoint; contrato OpenAPI verde.
- [ ] E2E actualizado si cambia un flujo de UI.
- [ ] Cobertura ≥ 80 % backend / ≥ 70 % frontend.
- [ ] Prueba de regresión añadida si corrige un defecto.

### Documentación
- [ ] SRS / contrato API / modelo de plantilla actualizados si aplica.
- [ ] [RTM](../04-testing/matriz-trazabilidad-RTM.md) y [casos de prueba](../04-testing/casos-de-prueba.md) actualizados.
- [ ] Entrada en `CHANGELOG.md` (sección Unreleased).

### Proceso
- [ ] PR con plantilla completa, revisado y aprobado por CODEOWNERS.
- [ ] CI verde (ci, codeql, security).
- [ ] Squash merge a `main`; issue cerrado automáticamente.
