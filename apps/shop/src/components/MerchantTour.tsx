import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReferenceIcon, type ReferenceIconName } from './ReferenceIcon';
import { clearMerchantTourProgress, consumeFirstMerchantTour, readMerchantTourProgress, saveMerchantTourProgress } from '../lib/merchant-tour-state';
import './merchant-tour.css';

type TourStep = { title: string; description: string; detail: string; path: string; target: string; icon: ReferenceIconName };
const STEPS: TourStep[] = [
  { title: 'Your shop at a glance', description: 'The overview brings new orders, today’s activity and stock that needs attention together.', detail: 'Use the menu to move between the parts of your shop.', path: '/', target: '[data-tour="nav-overview"]', icon: 'overview' },
  { title: 'Manage incoming orders', description: 'Open Orders to review a new order and accept it. The customer then sees that you’re preparing it.', detail: 'Continue preparation and rider assignment from the same order panel.', path: '/orders', target: '[data-tour="nav-orders"]', icon: 'orders' },
  { title: 'Keep your listings current', description: 'Products shows what your shop sells, including each item’s price, stock and availability.', detail: 'Choose My shop listings to review or edit items already in your shop.', path: '/products', target: '[data-tour="nav-products"]', icon: 'package' },
  { title: 'Add products from the catalog', description: 'Browse the shared catalog, select several products, then set a selling price and stock for each.', detail: 'Review your selection before you add the products to your shop.', path: '/products', target: '[data-tour="catalog-browse"]', icon: 'plus' },
  { title: 'Sell at the counter with iPOS', description: 'iPOS is your counter register for walk-in sales. Scan a barcode or search for an item to build a bill.', detail: 'You can also find held bills, sales history, keyboard commands and POS settings there.', path: '/ipos', target: '[data-tour="nav-ipos"]', icon: 'monitor' },
  { title: 'Get a rider ready', description: 'Add a rider or approve a rider request in Riders.', detail: 'You can assign an available rider from an order while preparing it.', path: '/riders', target: '[data-tour="nav-riders"]', icon: 'rider' },
  { title: 'Give your team access', description: 'Team lets you add staff and choose what each person can do in your shop.', detail: 'Use a separate account for every teammate.', path: '/team', target: '[data-tour="nav-team"]', icon: 'team' },
  { title: 'Review earnings', description: 'Earnings and settlements show the money recorded for completed orders.', detail: 'Use this page to review shop payments and settlement history.', path: '/earnings', target: '[data-tour="nav-earnings"]', icon: 'finance' },
  { title: 'Make the shop yours', description: 'Shop settings hold your profile, opening hours, delivery area and minimum order.', detail: 'You can replay this tour from here whenever you need it.', path: '/profile', target: '[data-tour="nav-profile"]', icon: 'settings' },
  { title: 'Find help when you need it', description: 'Help and support keeps answers and ways to contact the SirfBazar team in one place.', detail: 'You can return here whenever something needs attention.', path: '/support', target: '[data-tour="nav-support"]', icon: 'support' },
];
type Rect = { left: number; top: number; width: number; height: number };
type CardPosition = { left: number; top: number; width: number; maxHeight?: number };
function sameRect(a: Rect | null, b: Rect | null) { return a === b || !!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height; }

export function MerchantTour({ shopId, userId, replay }: { shopId: string; userId: string; replay: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousReplay = useRef(replay);
  const [active, setActive] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [cardPosition, setCardPosition] = useState<CardPosition>({ left: 16, top: 80, width: 340 });

  useEffect(() => {
    const saved = readMerchantTourProgress(shopId, userId);
    if (saved && saved.step < STEPS.length) {
      setStep(saved.step); setActive(true); setOpen(!saved.paused); setPending(false);
      return;
    }
    if (saved) clearMerchantTourProgress(shopId, userId);
    const shouldStart = consumeFirstMerchantTour(shopId, userId);
    setStep(0); setActive(shouldStart); setOpen(false); setPending(shouldStart);
    if (shouldStart) { saveMerchantTourProgress(shopId, userId, { step: 0, paused: false }); navigate('/'); }
  }, [shopId, userId, navigate]);
  useEffect(() => {
    if (replay === previousReplay.current) return;
    previousReplay.current = replay;
    saveMerchantTourProgress(shopId, userId, { step: 0, paused: false });
    setStep(0); setActive(true); setOpen(false); setPending(true); navigate('/');
  }, [replay, shopId, userId, navigate]);
  useEffect(() => {
    if (!pending || location.pathname !== '/') return;
    const content = document.getElementById('main-content');
    if (!content) return;
    let frame = 0;
    const ready = () => {
      if (!content.querySelector('[data-tour="dashboard-heading"]')) return;
      frame = requestAnimationFrame(() => { setPending(false); setOpen(true); });
      observer.disconnect();
    };
    const observer = new MutationObserver(ready);
    observer.observe(content, { childList: true, subtree: true });
    ready();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [pending, location.pathname]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
    if (open) requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    let observedTarget: Element | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const update = () => {
      const selector = window.innerWidth <= 800 && step !== 3 ? '[data-tour="mobile-menu"]' : STEPS[step].target;
      const target = document.querySelector(selector);
      if (target !== observedTarget) {
        resizeObserver?.disconnect(); observedTarget = target;
        if (target) { resizeObserver = new ResizeObserver(update); resizeObserver.observe(target); }
      }
      let nextRect: Rect | null = null;
      if (target) {
        const bounds = target.getBoundingClientRect();
        if (bounds.width && bounds.height) {
          if (bounds.bottom < 0 || bounds.top > window.innerHeight) target.scrollIntoView({ block: 'center', behavior: 'auto' });
          const visible = target.getBoundingClientRect();
          const left = Math.max(4, visible.left - 5), top = Math.max(4, visible.top - 5);
          nextRect = { left, top, width: Math.max(0, Math.min(window.innerWidth - left - 4, visible.width + 10)), height: Math.max(0, Math.min(window.innerHeight - top - 4, visible.height + 10)) };
        }
      }
      setTargetRect((previous) => sameRect(previous, nextRect) ? previous : nextRect);
      const width = Math.min(352, window.innerWidth - 24), height = cardRef.current?.offsetHeight ?? 350;
      let left = Math.max(12, (window.innerWidth - width) / 2), top = Math.max(12, (window.innerHeight - height) / 2);
      let maxHeight: number | undefined;
      if (window.innerWidth <= 800) {
        if (nextRect) {
          const below = nextRect.top + nextRect.height + 18;
          const roomBelow = window.innerHeight - below - 12;
          if (roomBelow >= 240) { top = below; maxHeight = roomBelow; }
          else if (nextRect.top - 24 >= 240) { top = 12; maxHeight = nextRect.top - 24; }
          else { top = Math.max(12, window.innerHeight - height - 12); maxHeight = window.innerHeight - 24; }
        }
      } else if (nextRect) {
        const right = nextRect.left + nextRect.width + 18;
        const before = nextRect.left - width - 18;
        if (right + width <= window.innerWidth - 12) left = right;
        else if (before >= 12) left = before;
        else {
          left = Math.max(12, (window.innerWidth - width) / 2);
          top = nextRect.top + nextRect.height + 18;
          if (top + height > window.innerHeight - 12) top = Math.max(12, nextRect.top - height - 18);
        }
        if (right + width <= window.innerWidth - 12 || before >= 12) top = Math.max(12, Math.min(nextRect.top, window.innerHeight - height - 12));
      }
      const position = { left: Math.round(left), top: Math.round(top), width: Math.round(width), maxHeight: maxHeight === undefined ? undefined : Math.round(maxHeight) };
      setCardPosition((previous) => previous.left === position.left && previous.top === position.top && previous.width === position.width && previous.maxHeight === position.maxHeight ? previous : position);
    };
    const frame = requestAnimationFrame(update);
    const mutations = new MutationObserver(update);
    const content = document.getElementById('main-content');
    if (content) mutations.observe(content, { childList: true, subtree: true });
    const cardObserver = new ResizeObserver(update);
    if (cardRef.current) cardObserver.observe(cardRef.current);
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true);
    return () => { cancelAnimationFrame(frame); mutations.disconnect(); resizeObserver?.disconnect(); cardObserver.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open, step, location.pathname]);

  const finish = () => { clearMerchantTourProgress(shopId, userId); setActive(false); setOpen(false); };
  const pause = () => { saveMerchantTourProgress(shopId, userId, { step, paused: true }); setOpen(false); };
  const resume = () => { saveMerchantTourProgress(shopId, userId, { step, paused: false }); setOpen(true); };
  const goToStep = (next: number) => {
    saveMerchantTourProgress(shopId, userId, { step: next, paused: false });
    setStep(next);
    if (location.pathname !== STEPS[next].path) navigate(STEPS[next].path);
  };
  const current = STEPS[step];
  return <>
    {active && !open && !pending && <div className="merchant-tour-resume"><span>Workspace tour · {step + 1} of {STEPS.length}</span><button type="button" onClick={resume}>Continue tour</button><button type="button" className="merchant-tour-resume-close" onClick={finish} aria-label="End tour"><ReferenceIcon name="close" size="sm" /></button></div>}
    <dialog ref={dialogRef} className="merchant-tour-dialog" aria-labelledby="merchant-tour-title" aria-describedby="merchant-tour-description" onCancel={(event) => { event.preventDefault(); pause(); }}>
      {targetRect ? <div className="merchant-tour-spotlight" aria-hidden="true" style={targetRect} /> : <div className="merchant-tour-shade" aria-hidden="true" />}
      <div ref={cardRef} className="merchant-tour-card" style={cardPosition}>
        <div className="merchant-tour-illustration" aria-hidden="true"><span className="merchant-tour-illustration-halo"><ReferenceIcon name={current.icon} size="lg" /></span><span className="merchant-tour-illustration-line" /><span className="merchant-tour-illustration-tile tile-one" /><span className="merchant-tour-illustration-tile tile-two" /></div>
        <div className="merchant-tour-card-body">
          <div className="merchant-tour-card-top"><span className="merchant-tour-step">Step {step + 1} of {STEPS.length}</span><button type="button" className="merchant-tour-close" onClick={pause} aria-label="Pause tour" title="Pause tour"><ReferenceIcon name="close" size="sm" /></button></div>
          <h2 id="merchant-tour-title" ref={titleRef} tabIndex={-1}>{current.title}</h2>
          <p id="merchant-tour-description">{current.description}</p>
          <p className="merchant-tour-detail">{current.detail}</p>
          <div className="merchant-tour-progress" aria-label={`Tour progress: step ${step + 1} of ${STEPS.length}`}>{STEPS.map((item, index) => <span key={item.title} className={index <= step ? 'filled' : ''} />)}</div>
          <div className="merchant-tour-actions"><button type="button" className="merchant-tour-quiet" onClick={pause}>Try this page</button><div className="merchant-tour-navigation"><button type="button" className="merchant-tour-back" disabled={step === 0} onClick={() => goToStep(step - 1)}>Back</button><button type="button" className="merchant-tour-next" onClick={() => step === STEPS.length - 1 ? finish() : goToStep(step + 1)}>{step === STEPS.length - 1 ? 'Finish tour' : 'Next'}<ReferenceIcon name="right" size="sm" /></button></div></div>
          <button type="button" className="merchant-tour-skip" onClick={finish}>Skip tour</button>
        </div>
      </div>
    </dialog>
  </>;
}
