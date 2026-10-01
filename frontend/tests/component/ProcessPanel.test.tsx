import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ProcessPanel } from '../../src/features/jobs/ProcessPanel';
import { cleanTemplate } from '../../src/lib/template';
import { useTemplateStore } from '../../src/store/templateStore';
import { SALES_TEMPLATE } from '../fixtures/data';
import { db } from '../mocks/handlers';
import { server } from '../mocks/server';
import { renderWithProviders } from '../utils';

const store = () => useTemplateStore.getState();

describe('ProcessPanel – procesamiento completo', () => {
  it('[RF-14][RF-15] procesa en segundo plano y ofrece descargas XLSX y CSV', async () => {
    const user = userEvent.setup();
    store().load(cleanTemplate(SALES_TEMPLATE));
    renderWithProviders(<ProcessPanel fileId="file-1" />);
    await user.click(screen.getByLabelText('CSV'));
    await user.click(screen.getByRole('button', { name: 'Procesar archivo completo' }));
    expect(await screen.findByTestId('job-progress')).toBeInTheDocument();
    const xlsx = await screen.findByTestId('download-xlsx', {}, { timeout: 4000 });
    expect(xlsx).toHaveAttribute(
      'href',
      expect.stringMatching(/jobs\/job-1-abcdef\/download\?format=xlsx$/),
    );
    expect(screen.getByTestId('download-csv')).toBeInTheDocument();
    expect(screen.getByText('Terminado', { selector: '.badge' })).toBeInTheDocument();
    expect(db.jobs[0].formats).toEqual(['xlsx', 'csv']);
  });

  it('[RF-17] pagina los resultados del trabajo', async () => {
    const user = userEvent.setup();
    store().load(cleanTemplate(SALES_TEMPLATE));
    renderWithProviders(<ProcessPanel fileId="file-1" />);
    await user.click(screen.getByRole('button', { name: 'Procesar archivo completo' }));
    const table = await screen.findByTestId('results-table', {}, { timeout: 4000 });
    expect(within(table).getByText('Fila 1')).toBeInTheDocument();
    expect(screen.getByText(/1–100 de 250/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Siguientes/ }));
    await waitFor(() =>
      expect(within(screen.getByTestId('results-table')).getByText('Fila 101')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /Siguientes/ }));
    await waitFor(() => expect(screen.getByText(/201–250 de 250/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Siguientes/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Anteriores/ }));
    await waitFor(() => expect(screen.getByText(/101–200 de 250/)).toBeInTheDocument());
  });

  it('[RF-14] permite cancelar un trabajo en curso', async () => {
    server.use(
      http.get('*/api/v1/jobs/:id', ({ params }) =>
        HttpResponse.json(db.jobs.find((j) => j.id === params.id)),
      ),
    );
    const user = userEvent.setup();
    store().load(cleanTemplate(SALES_TEMPLATE));
    renderWithProviders(<ProcessPanel fileId="file-1" />);
    await user.click(screen.getByRole('button', { name: 'Procesar archivo completo' }));
    expect(
      await screen.findByRole('progressbar', { name: 'Progreso del procesamiento' }),
    ).toHaveAttribute('aria-valuenow', '30');
    expect(screen.getByRole('button', { name: 'Procesar archivo completo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Cancelado', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.queryByTestId('download-xlsx')).not.toBeInTheDocument();
  });

  it('[RF-15] exige al menos un formato y una columna', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProcessPanel fileId="file-1" />);
    expect(screen.getByRole('button', { name: 'Procesar archivo completo' })).toBeDisabled();
    store().load(cleanTemplate(SALES_TEMPLATE));
    await user.click(await screen.findByLabelText('XLSX'));
    expect(screen.getByRole('button', { name: 'Procesar archivo completo' })).toBeDisabled();
  });

  it('[RF-13] advierte de errores locales de la plantilla y muestra errores del backend', async () => {
    server.use(
      http.post('*/api/v1/jobs', () =>
        HttpResponse.json({ detail: 'Plantilla inválida' }, { status: 422 }),
      ),
    );
    const user = userEvent.setup();
    const t = cleanTemplate(SALES_TEMPLATE);
    t.columns.push({ id: 'x', header: 'X', sources: ['nada.campo'] });
    store().load(t);
    renderWithProviders(<ProcessPanel fileId="file-1" />);
    expect(screen.getByText(/fuente inexistente: nada\.campo/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Procesar archivo completo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Plantilla inválida');
  });
});
