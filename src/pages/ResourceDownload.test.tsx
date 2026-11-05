import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const rpc = vi.fn();
const getPublicUrl = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    storage: { from: () => ({ getPublicUrl: (...args: unknown[]) => getPublicUrl(...args) }) },
  },
}));

const redirectTo = vi.fn();
vi.mock('@/lib/browser', () => ({ redirectTo: (url: string) => redirectTo(url) }));

import ResourceDownload from './ResourceDownload';

const SLUG = 'abcdefgh-q3-report.pptx';
const STORAGE_URL = 'https://x.supabase.co/storage/v1/object/public/resources/abcdefgh-q3-report.pptx?download=Q3%20Report.pptx';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/resource/:slug" element={<ResourceDownload />} /></Routes>
    </MemoryRouter>,
  );
}

describe('ResourceDownload (/resource/:slug)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublicUrl.mockReturnValue({ data: { publicUrl: STORAGE_URL } });
  });

  it('looks up the file and redirects to the storage download URL with the original filename', async () => {
    rpc.mockResolvedValue({ data: [{ original_filename: 'Q3 Report.pptx', mime_type: 'x', size_bytes: 10 }], error: null });
    renderAt(`/resource/${SLUG}`);

    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith(STORAGE_URL));
    expect(rpc).toHaveBeenCalledWith('get_resource', { p_slug: SLUG });
    expect(getPublicUrl).toHaveBeenCalledWith(SLUG, { download: 'Q3 Report.pptx' });
    expect(screen.getByText(/your download is starting/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download q3 report\.pptx/i })).toHaveAttribute('href', STORAGE_URL);
  });

  it('handles the trailing-slash form used in emails', async () => {
    rpc.mockResolvedValue({ data: [{ original_filename: 'Q3 Report.pptx', mime_type: 'x', size_bytes: 10 }], error: null });
    renderAt(`/resource/${SLUG}/`);
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith(STORAGE_URL));
    expect(rpc).toHaveBeenCalledWith('get_resource', { p_slug: SLUG });
  });

  it('shows "not found" for an unknown slug without redirecting', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    renderAt(`/resource/${SLUG}`);
    expect(await screen.findByText(/file not found/i)).toBeInTheDocument();
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('rejects malformed slugs without querying the database', async () => {
    renderAt('/resource/..%2F..%2Fsecret.pdf');
    expect(await screen.findByText(/file not found/i)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
    expect(redirectTo).not.toHaveBeenCalled();
  });
});
