import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ScrollToHash from './ScrollToHash';

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

function App({ start = '/' }: { start?: string }) {
  return (
    <MemoryRouter initialEntries={[start]}>
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<Link to="/grow#pricing">See pricing tiers</Link>} />
        <Route path="/grow" element={<section id="pricing">Pricing</section>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ScrollToHash', () => {
  // Regression: links like /grow#pricing from the homepage landed at the top of /grow.
  it('scrolls to the #hash target after navigating to another page', async () => {
    const { getByText } = render(<App />);
    fireEvent.click(getByText('See pricing tiers'));
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(scrollIntoView.mock.contexts[0]).toHaveProperty('id', 'pricing');
  });

  it('scrolls to the target when the page is opened directly with a hash', async () => {
    render(<App start="/grow#pricing" />);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('waits for a target that renders later (e.g. lazy-loaded page)', async () => {
    function Late() {
      const [show, setShow] = useState(false);
      useEffect(() => { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }, []);
      return show ? <section id="pricing">Pricing</section> : null;
    }
    render(
      <MemoryRouter initialEntries={['/grow#pricing']}>
        <ScrollToHash />
        <Routes><Route path="/grow" element={<Late />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('does nothing without a hash, or when the target never appears', async () => {
    render(<App start="/grow" />);
    render(
      <MemoryRouter initialEntries={['/grow#missing']}>
        <ScrollToHash />
      </MemoryRouter>,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

