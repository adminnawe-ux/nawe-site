import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

import Grow from './Grow';

const PRIMARY_CTA = 'Discuss Organisational Health';

function renderGrow() {
  return render(<MemoryRouter><Grow /></MemoryRouter>);
}

// Text position in the document, for "explainer comes before pricing" checks.
function follows(a: HTMLElement, b: HTMLElement) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('Grow (/grow) — Organisational Health explainer + pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('has a single H1 naming Organisational Health', () => {
    renderGrow();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/organisation/i);
  });

  it('explains the offer before showing pricing', () => {
    renderGrow();
    const pricing = screen.getByRole('heading', { level: 2, name: /packages and pricing/i });
    for (const name of [
      /what is organisational health/i,
      /what we help organisations address/i,
      /how an engagement works/i,
      /what employers gain/i,
    ]) {
      const section = screen.getByRole('heading', { level: 2, name });
      expect(follows(section, pricing)).toBe(true);
    }
  });

  it('pricing sits in its own clearly labelled section', () => {
    renderGrow();
    const section = document.getElementById('pricing');
    expect(section).not.toBeNull();
    expect(within(section!).getByText('KES 950')).toBeInTheDocument();
  });

  it('uses one primary call to action — no competing "free assessment", mailto or "Back to Home" buttons', () => {
    renderGrow();
    expect(screen.getAllByRole('button', { name: PRIMARY_CTA }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/free assessment/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /back to home/i })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('the primary CTA opens the enquiry form and submits without a plan', async () => {
    renderGrow();
    fireEvent.click(screen.getAllByRole('button', { name: PRIMARY_CTA })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/tell us about your organisation/i)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText(/organisation name/i), { target: { value: 'Acme Ltd' } });
    fireEvent.change(within(dialog).getByPlaceholderText(/your name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(within(dialog).getByPlaceholderText(/work email/i), { target: { value: 'jane@acme.co.ke' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /send enquiry/i }));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    const [fn, { body }] = invoke.mock.calls[0];
    expect(fn).toBe('corporate-enquiry');
    expect(body).toMatchObject({ company_name: 'Acme Ltd', contact_name: 'Jane Doe', email: 'jane@acme.co.ke', plan: null });
  });

  it('a package button opens the same form tagged with that package', async () => {
    renderGrow();
    fireEvent.click(screen.getByRole('button', { name: /choose tier 2/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/tier 2/i)).toBeInTheDocument();
  });

  it('asks people not to include sensitive employee information in the form', async () => {
    renderGrow();
    fireEvent.click(screen.getAllByRole('button', { name: PRIMARY_CTA })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/do not include employee names or health details/i)).toBeInTheDocument();
  });
});
