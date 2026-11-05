import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router doesn't scroll to #hash targets on navigation, so links such as
// /grow#pricing would land at the top of the page. After each navigation with
// a hash, scroll to the matching element, polling briefly because the target
// may render late (lazy-loaded pages, data fetching).
const POLL_MS = 50;
const MAX_WAIT_MS = 3000;

export default function ScrollToHash() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    let waited = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      waited += POLL_MS;
      if (waited < MAX_WAIT_MS) timer = setTimeout(tryScroll, POLL_MS);
    };

    tryScroll();
    return () => clearTimeout(timer);
  }, [pathname, hash, key]);

  return null;
}
