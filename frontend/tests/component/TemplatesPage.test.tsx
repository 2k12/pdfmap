import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { TemplatesPage } from '../../src/features/templates/TemplatesPage';
import { db } from '../mocks/handlers';
import { renderWithProviders } from '../utils';

describe('TemplatesPage – gestión de plantillas', () => {
  it('[RF-13] lista plantillas marcando las de ejemplo', async () => {
    renderWithProviders(<TemplatesPage />);
    const rows = await screen.findAllByTestId('template-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('ejemplo')).toBeInTheDocument();
    // Las de ejemplo no se pueden eliminar.
    expect(within(rows[0]).queryByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument();
  });

  it('[RF-13] clona una plantilla', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TemplatesPage />);
    const rows = await screen.findAllByTestId('template-row');
    await user.click(within(rows[0]).getByRole('button', { name: 'Clonar' }));
    expect(
      await screen.findByText(/«Ventas por vendedor \(ejemplo\) \(copia\)» creada/),
    ).toBeInTheDocument();
    expect(db.templates).toHaveLength(3);
    expect(db.templates[2].builtin).toBe(false);
  });

  it('[RF-13] elimina una plantilla propia tras confirmar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TemplatesPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Eliminar plantilla Ventas por vendedor' }),
    );
    await waitFor(() => expect(screen.getAllByTestId('template-row')).toHaveLength(1));
  });

  it('[RF-13] exporta una plantilla como JSON descargable', async () => {
    const user = userEvent.setup();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderWithProviders(<TemplatesPage />);
    const rows = await screen.findAllByTestId('template-row');
    await user.click(within(rows[1]).getByRole('button', { name: 'Exportar JSON' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe('Ventas_por_vendedor.json');
  });

  it('[RF-13] importa un JSON válido y rechaza uno inválido', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TemplatesPage />);
    await screen.findAllByTestId('template-row');
    const input = screen.getByTestId('template-import-input');
    const good = new File(
      [JSON.stringify({ id: 'x', name: 'Importada', rules: [], columns: [], options: {} })],
      't.json',
      {
        type: 'application/json',
      },
    );
    await user.upload(input, good);
    expect(await screen.findByText(/«Importada» importada/)).toBeInTheDocument();
    expect(db.templates.at(-1)!.id).not.toBe('x');
    await user.upload(input, new File(['nope'], 'bad.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/JSON válido/);
    const invalid = new File(
      [JSON.stringify({ name: 'Mala', rules: [{ name: 'sin id' }], columns: [] })],
      'm.json',
      {
        type: 'application/json',
      },
    );
    await user.upload(input, invalid);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Plantilla inválida: Regla sin id/);
  });

  it('[RF-13] abre una plantilla con un archivo listo', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TemplatesPage />, { route: '/templates', path: '/templates' });
    const rows = await screen.findAllByTestId('template-row');
    const open = within(rows[1]).getByRole('button', { name: 'Abrir' });
    expect(open).toBeDisabled();
    await screen.findAllByRole('option', { name: 'ventas.pdf' });
    await user.selectOptions(
      within(rows[1]).getByLabelText('Archivo para Ventas por vendedor'),
      'file-1',
    );
    await user.click(open);
    expect(screen.getByTestId('other-route')).toBeInTheDocument();
  });
});

describe('App', () => {
  it('[RNF-04] muestra la navegación principal y la página de archivos', async () => {
    renderWithProviders(<App />);
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plantillas' })).toHaveAttribute('href', '/templates');
    expect(await screen.findByTestId('file-row')).toBeInTheDocument();
  });

  it('[RNF-04] muestra un mensaje para rutas inexistentes', () => {
    renderWithProviders(<App />, { route: '/no-existe' });
    expect(screen.getByText('Página no encontrada.')).toBeInTheDocument();
  });
});
