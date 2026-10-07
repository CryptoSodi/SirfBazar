// Generated from the supplied v2 reference's static SVG paths. No icon redesign.
// Copy into the existing frontend only when needed; reuse the reference CSS .icon rules.
import type { SVGProps } from 'react';

const paths = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  orders: <><path d="M8 3h8l2 3h3v15H3V6h3l2-3Z"/><path d="M8 3v4h8V3M7 12h10M7 16h6"/></>,
  package: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5M12 13v9M7.5 5.5l9 5v4"/></>,
  rider: <><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="m5 17 4-9h5l5 9M8 11l6 6H5M14 17l3-10h3M10 5h3"/></>,
  team: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/></>,
  finance: <><path d="M3 6h17v15H3V6Z"/><path d="M3 6V4h14v2M15 12h6v5h-6v-5Z"/><circle cx="17.5" cy="14.5" r=".6"/></>,
  settings: <><path d="m9 3-.6 2.4-2.2 1L4 5.8 2 9.2l1.7 1.7v2.2L2 14.8l2 3.4 2.2-.6 2.2 1L9 21h4l.6-2.4 2.2-1 2.2.6 2-3.4-1.7-1.7v-2.2L20 9.2l-2-3.4-2.2.6-2.2-1L13 3H9Z"/><circle cx="11" cy="12" r="3"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>,
  moon: <><path d="M20.8 13.1A9 9 0 0 1 10.9 3.2 9 9 0 1 0 20.8 13.1Z"/></>,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></>,
  down: <><path d="m6 9 6 6 6-6"/></>,
  right: <><path d="m9 5 7 7-7 7"/></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
  back: <><path d="M20 12H4m6-6-6 6 6 6"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  close: <><path d="m6 6 12 12M6 18 18 6"/></>,
  code: <><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/></>,
  support: <><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v7h4v-7H4Zm16 0h2v7h-4v-7h2Zm0 7c0 2-3 3-6 3h-2"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  refresh: <><path d="M20 7V3m0 4h-4M4 17v4m0-4h4M20 7a9 9 0 0 0-15-3M4 17a9 9 0 0 0 15 3"/></>,
  alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.5"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-10v.5"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/></>,
  store: <><path d="m4 3-2 6a3 3 0 0 0 5 2 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5-2l-2-6H4ZM4 12v9h16v-9M9 21v-7h6v7"/></>,
  edit: <><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5Z"/></>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7"/></>,
  empty: <><path d="m3 8 4-5h10l4 5v12H3V8Z"/><path d="M3 8h5l2 4h4l2-4h5"/></>,
  receipt: <><path d="M5 3h14v19l-3-2-4 2-4-2-3 2V3Z"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
  filter: <><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/></>,
} as const;

export type ReferenceIconName = keyof typeof paths;
export interface ReferenceIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: ReferenceIconName;
  size?: 'normal' | 'sm' | 'lg';
  label?: string;
}

export function ReferenceIcon({ name, size = 'normal', className = '', label, ...props }: ReferenceIconProps) {
  return (
    <svg {...props} className={`icon ${size === 'normal' ? '' : size} ${className}`.trim()}
      viewBox="0 0 24 24" aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined} aria-label={label}>
      {paths[name]}
    </svg>
  );
}
