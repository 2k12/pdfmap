import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { FilesPage } from '../../src/features/files/FilesPage';
import { db } from '../mocks/handlers';
import { server } from '../mocks/server';
import { renderWithProviders } from '../utils';

describe('FilesPage', () => {
  it('[RF-01] lista los archivos con estado, páginas y acción Mapear', async () => {
    renderWithProviders(<FilesPage />);
    const row = await screen.findByTestId('file-row');
    expect(within(row).getByText('ventas.pdf')).toBeInTheDocument();
    expect(within(row).getByText('Listo')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Mapear' })).toHaveAttribute(
      'href',
      '/files/file-1/map',
    );
  });

  it('[RF-01] muestra estado vacío si no hay archivos', async () => {
    db.files = [];
    renderWithProviders(<FilesPage />);
    expect(await screen.findByText(/Aún no hay archivos/)).toBeInTheDocument();
  });

  it('[RF-01][RF-02] sube un archivo seleccionado con el botón y muestra el progreso', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FilesPage />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    await user.upload(input, new File(['0123456789'], 'nuevo.pdf', { type: 'application/pdf' }));
    const progress = await screen.findByTestId('upload-progress');
    expect(within(progress).getByText('nuevo.pdf')).toBeInTheDocument();
    await waitFor(() => expect(within(progress).getByText(/Subida completa/)).toBeInTheDocument());
    // La lista se refresca y muestra el archivo en extracción.
    await waitFor(() => expect(screen.getAllByTestId('file-row')).toHaveLength(2));
    expect(screen.getByText('Extrayendo')).toBeInTheDocument();
  });

  it('[RF-01] acepta archivos arrastrados a la zona de carga', async () => {
    renderWithProviders(<FilesPage />);
    const zone = screen.getByTestId('dropzone');
    const file = new File(['abc'], 'arrastrado.txt', { type: 'text/plain' });
    fireEvent.dragOver(zone, { dataTransfer: { files: [file] } });
    expect(zone).toHaveClass('dropzone--active');
    fireEvent.dragLeave(zone);
    expect(zone).not.toHaveClass('dropzone--active');
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(await screen.findByText('arrastrado.txt')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Subida completa/)).toBeInTheDocument());
  });

  it('[RF-03] rechaza tipos de archivo no soportados sin llamar al backend', async () => {
    renderWithProviders(<FilesPage />);
    const zone = screen.getByTestId('dropzone');
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'foto.png')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/no soportado/);
    expect(db.uploads.size).toBe(0);
  });

  it('[RF-02] muestra el error si la subida falla y permite cancelar', async () => {
    server.use(
      http.post('*/api/v1/uploads', () =>
        HttpResponse.json({ detail: 'Archivo demasiado grande' }, { status: 413 }),
      ),
    );
    renderWithProviders(<FilesPage />);
    fireEvent.drop(screen.getByTestId('dropzone'), {
      dataTransfer: { files: [new File(['x'], 'g.pdf')] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Archivo demasiado grande');
  });

  it('[RF-02] el botón Cancelar aborta una subida en curso', async () => {
    let release: () => void = () => undefined;
    server.use(
      http.put('*/api/v1/uploads/:id/chunks/:index', async () => {
        await new Promise<void>((r) => (release = r));
        return HttpResponse.json({ received: 1, total_chunks: 1 });
      }),
    );
    renderWithProviders(<FilesPage />);
    fireEvent.drop(screen.getByTestId('dropzone'), {
      dataTransfer: { files: [new File(['abc'], 'lento.pdf')] },
    });
    const cancel = await screen.findByRole('button', { name: 'Cancelar' });
    fireEvent.click(cancel);
    release();
    expect(await screen.findByText('Subida cancelada')).toBeInTheDocument();
  });

  it('[RF-18] elimina un archivo tras confirmar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FilesPage />);
    await user.click(await screen.findByRole('button', { name: 'Eliminar ventas.pdf' }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('file-row')).not.toBeInTheDocument());
  });

  it('[RF-18] no elimina si el usuario cancela la confirmación', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const user = userEvent.setup();
    renderWithProviders(<FilesPage />);
    await user.click(await screen.findByRole('button', { name: 'Eliminar ventas.pdf' }));
    expect(db.files).toHaveLength(1);
  });

  it('[RF-04] muestra el progreso de extracción y errores', async () => {
    db.files = [
      {
        ...db.files[0],
        id: 'f2',
        name: 'grande.pdf',
        status: 'extracting',
        progress: 0.5,
        pages: null,
      },
      {
        ...db.files[0],
        id: 'f3',
        name: 'roto.pdf',
        status: 'error',
        error: 'PDF sin texto (¿escaneado?)',
      },
    ];
    renderWithProviders(<FilesPage />);
    expect(
      await screen.findByRole('progressbar', { name: 'Extracción de grande.pdf' }),
    ).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('PDF sin texto (¿escaneado?)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mapear' })).not.toBeInTheDocument();
  });
});
