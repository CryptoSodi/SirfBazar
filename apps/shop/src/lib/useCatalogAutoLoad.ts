import { useEffect, useRef } from 'react';

/** Observe the real scroll viewport (including clipped ancestors), not a scroll counter. */
export function useCatalogAutoLoad(ready: boolean, requestNext: () => void) {
  const sentinel = useRef<HTMLDivElement>(null);
  const callback = useRef(requestNext);
  callback.current = requestNext;
  useEffect(() => {
    if (!ready || !sentinel.current || typeof IntersectionObserver === 'undefined') return;
    let active = true;
    const observer = new IntersectionObserver((entries) => {
      if (active && entries.some((entry) => entry.isIntersecting)) callback.current();
    }, { rootMargin: '0px 0px 360px 0px', threshold: 0 });
    observer.observe(sentinel.current);
    return () => { active = false; observer.disconnect(); };
  }, [ready]);
  return sentinel;
}
