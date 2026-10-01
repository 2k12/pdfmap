import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { MapperPage } from '../../src/features/mapper/MapperPage';
import { renderWithProviders } from '../utils';

/** Ejecuta axe-core (WCAG 2.1 A/AA). El contraste se valida en e2e: jsdom no calcula estilos. */
async function expectNoViolations(container: Element) {
  const result = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  const summary = result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
  expect(summary).toEqual([]);
}

describe('Accesibilidad (WCAG 2.1 AA)', () => {
  it('[RNF-05] la página de archivos no tiene violaciones', async () => {
    const { container } = renderWithProviders(<App />);
    await screen.findByTestId('file-row');
    await expectNoViolations(container);
  });

  it('[RNF-05] la página de plantillas no tiene violaciones', async () => {
    const { container } = renderWithProviders(<App />, { route: '/templates' });
    await screen.findAllByTestId('template-row');
    await expectNoViolations(container);
  });

  it('[RNF-05] el mapeador (reglas, diseño y proceso) no tiene violaciones', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<MapperPage />, {
      route: '/files/file-1/map?template=tpl-sales',
      path: '/files/:fileId/map',
    });
    await screen.findByTestId('rule-item-vendedor');
    await waitFor(() => expect(screen.getByTestId('doc-line-3')).toHaveAttribute('title'));
    await expectNoViolations(container);
    await user.click(screen.getByRole('tab', { name: '2. Diseño Excel' }));
    await screen.findByTestId('preview-table', {}, { timeout: 3000 });
    await expectNoViolations(container);
    await user.click(screen.getByRole('tab', { name: '3. Procesar' }));
    await expectNoViolations(container);
  });
});
