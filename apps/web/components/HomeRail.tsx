'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

type Props = { label: string; className: string; children: ReactNode };

export function HomeRail({ label, className, children }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const element = track.current;
    if (!element) return;
    setAtStart(element.scrollLeft <= 2);
    setAtEnd(element.scrollLeft + element.clientWidth >= element.scrollWidth - 2);
  }, []);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (track.current) {
      observer.observe(track.current);
      for (const child of track.current.children) observer.observe(child);
    }
    return () => observer.disconnect();
  }, [children, measure]);

  const move = (direction: -1 | 1) => {
    const element = track.current;
    if (!element) return;
    const first = element.firstElementChild as HTMLElement | null;
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 14;
    const step = (first?.getBoundingClientRect().width ?? element.clientWidth) + gap;
    const distance = Math.max(step, Math.floor(element.clientWidth / step) * step);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({ left: direction * distance, behavior: reducedMotion ? 'instant' : 'smooth' });
  };

  return <div className="sb-home-rail">
    {(!atStart || !atEnd) && <div className="sb-home-rail-controls" role="group" aria-label={`${label} slider controls`}>
      <button type="button" aria-label={`Previous ${label}`} disabled={atStart} onClick={() => move(-1)}>‹</button>
      <button type="button" aria-label={`Next ${label}`} disabled={atEnd} onClick={() => move(1)}>›</button>
    </div>}
    <div ref={track} className={`sb-home-rail-track ${className}`} role="region" aria-label={label} tabIndex={0} onScroll={measure}>{children}</div>
  </div>;
}
