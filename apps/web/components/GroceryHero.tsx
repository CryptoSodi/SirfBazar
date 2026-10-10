import Image from 'next/image';
import Link from 'next/link';
import { AppIcon, type AppIconName } from './AppIcon';
import styles from './GroceryHero.module.css';

const benefits: { icon: AppIconName; label: string; description: string }[] = [
  { icon: 'shop', label: 'Local shops', description: 'Choose your store' },
  { icon: 'bike', label: 'Shop-managed delivery', description: 'To your doorstep' },
  { icon: 'basket', label: 'Everyday groceries', description: 'Your daily essentials' },
  { icon: 'receipt', label: 'Clear order total', description: 'Review before you confirm' },
];

/** Presentation only: discovery keeps the existing location and guest basket. */
export function GroceryHero({ hasConfirmedLocation, onChooseLocation }: { hasConfirmedLocation: boolean; onChooseLocation: () => void }) {
  return <section className={styles.hero} aria-labelledby="home-hero-title">
    <div className={styles.copy}>
      <p className={styles.eyebrow}>Local shops. A brighter neighbourhood.</p>
      <h1 id="home-hero-title" className={styles.title}>
        Everyday groceries from{' '}
        <span>{hasConfirmedLocation ? 'shops near you.' : 'local shops.'}</span>
      </h1>
      <p className={styles.description}>Shop everyday essentials from local stores. They prepare your order and deliver it to your door.</p>
      <div className={styles.actions}>
        <Link href="/search" className={styles.primary}>Shop groceries <AppIcon name="arrow" size={22} /></Link>
        {hasConfirmedLocation ? <Link href="/search?type=shops" className={styles.secondary}>Explore local shops</Link> : <button type="button" className={styles.secondary} onClick={onChooseLocation}>Set delivery location</button>}
      </div>
      <ul className={styles.benefits} aria-label="Shopping with SirfBazar">
        {benefits.map(({ icon, label, description }) => <li key={label}>
          <span className={styles.benefitIcon}><AppIcon name={icon} size={28} /></span>
          <strong>{label}</strong>
          <span className={styles.benefitDescription}>{description}</span>
        </li>)}
      </ul>
    </div>
    <div className={styles.artwork} aria-hidden="true">
      <Image src="/images/hero/grocery-hero-artwork.webp" alt="" width={809} height={644}
        sizes="(max-width: 359px) 226px, (max-width: 767px) 277px, (max-width: 979px) calc(44vw - 22px), (max-width: 1327px) calc(52vw - 25px), 666px" preload />
    </div>
  </section>;
}
