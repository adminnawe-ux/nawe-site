import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
const uploadMock = vi.fn();
const removeMock = vi.fn();
const insertMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }) },
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => uploadMock(...args),
        remove: (...args: unknown[]) => removeMock(...args),
      }),
    },
    from: (table: string) => {
      if (table === 'resources') {
        return {
          insert: (row: unknown) => ({ select: () => ({ single: () => insertMock(row) }) }),
          delete: () => ({ eq: (_c: string, id: string) => deleteMock(id) }),
        };
      }
      return { select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
    },
  },
}));

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }));

import AdminBroadcast from './AdminBroadcast';

function file(name: string, size = 1024, type = '') {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

async function attach(...files: File[]) {
  fireEvent.change(screen.getByLabelText(/attach files/i), { target: { files } });
}

describe('AdminBroadcast — file attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock.mockResolvedValue({ error: null });
    removeMock.mockResolvedValue({ error: null });
    deleteMock.mockResolvedValue({ error: null });
    insertMock.mockImplementation((row: { slug: string; original_filename: string; size_bytes: number }) =>
      Promise.resolve({ data: { id: `id-${row.original_filename}`, ...row }, error: null }));
  });

  async function renderReady() {
    render(<AdminBroadcast />);
    await waitFor(() => expect(screen.getByText('No broadcasts sent yet.')).toBeInTheDocument());
  }

  it('uploads with a random-prefixed slug, records it, and shows the public link', async () => {
    await renderReady();
    await attach(file('Q3 Report.pptx'));

    await waitFor(() => expect(insertMock).toHaveBeenCalled());
    const [slug, , opts] = uploadMock.mock.calls[0];
    expect(slug).toMatch(/^[a-z0-9]{8}-q3-report\.pptx$/);
    expect(opts).toMatchObject({
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      upsert: false,
    });
    expect(insertMock).toHaveBeenCalledWith({
      slug, original_filename: 'Q3 Report.pptx',
      mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size_bytes: 1024,
    });
    expect(await screen.findByText('Q3 Report.pptx')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`/resource/${slug.replace('.', '\\.')}$`))).toBeInTheDocument();
  });

  it('sends resource_ids with the broadcast', async () => {
    invokeMock.mockResolvedValue({ data: { recipient_count: 1, sent: 1, failed: 0 }, error: null });
    await renderReady();
    await attach(file('Agenda.pdf'));
    await screen.findByText('Agenda.pdf');

    fireEvent.click(screen.getByText('Clients'));
    fireEvent.click(screen.getByRole('button', { name: /preview recipient count/i }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('send-broadcast', expect.objectContaining({
      body: expect.objectContaining({ resource_ids: ['id-Agenda.pdf'] }),
    })));
  });

  it('rejects disallowed and oversized files without uploading', async () => {
    await renderReady();
    await attach(file('virus.exe'), file('huge.pdf', 26 * 1024 * 1024));
    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(2));
    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('caps attachments at 5', async () => {
    await renderReady();
    await attach(...['a', 'b', 'c', 'd', 'e', 'f'].map(n => file(`${n}.pdf`)));
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(5));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/up to 5/i) }));
  });

  it('cleans up the stored file if recording it in the database fails', async () => {
    insertMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await renderReady();
    await attach(file('doc.pdf'));
    await waitFor(() => expect(removeMock).toHaveBeenCalled());
    expect(removeMock.mock.calls[0][0][0]).toMatch(/^[a-z0-9]{8}-doc\.pdf$/);
    expect(screen.queryByText('doc.pdf')).not.toBeInTheDocument();
  });

  it('removing an attachment deletes the file and its record', async () => {
    await renderReady();
    await attach(file('doc.pdf'));
    const row = (await screen.findByText('doc.pdf')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: /remove doc\.pdf/i }));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('id-doc.pdf'));
    expect(removeMock).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('doc.pdf')).not.toBeInTheDocument());
  });
});
