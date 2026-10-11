'use client';

import { AppIcon } from '@/components/AppIcon';

import Link from 'next/link';
import { formatPKR } from '@/lib/format';
import { Icon } from './Icons';
import { CartQuantityControl } from './CartQuantityControl';

export interface ProductCardData {
  productId: string;
  merchantProductId: string;
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
  unit?: string | null;
  size?: string | null;
  pricePaisa: number;
  discountPricePaisa?: number | null;
  stockQuantity?: number;
  merchant?: { id: string; shopName: string; distanceKm?: number | null; estimatedDeliveryMinutes?: number | null; ratingAverage?: number };
}

export function ProductImage({ name, imageUrl, className = '' }: { name: string; imageUrl?: string | null; className?: string }) {
  if (imageUrl) return <img src={imageUrl} alt={name} className={`${className} object-contain`} />;
  return <div className={`${className} sb-image-unavailable`} role="img" aria-label={`Image unavailable for ${name}`}><AppIcon name="image" size={26} /><small>Image unavailable</small></div>;
}

export function ProductCard({ card }: { card: ProductCardData }) {
  const price = card.discountPricePaisa ?? card.pricePaisa;
  const priced = Number.isFinite(price) && price >= 0;
  const available = !!card.merchantProductId && card.stockQuantity !== 0 && priced;

  return <article className="card sb-product-card">
    <Link href={`/product/${card.productId}`} className="sb-product-media"><ProductImage name={card.name} imageUrl={card.imageUrl} className="sb-product-image" /></Link>
    <div className="sb-product-details"><Link href={`/product/${card.productId}`} className="sb-product-name">{card.name}</Link><p className="sb-product-size">{[card.brand, card.size ?? card.unit].filter(Boolean).join(' · ') || 'See product details'}</p><p className="sb-product-shop"><Icon name="shop" size={11} />{card.merchant?.shopName || 'Choose a shop'}</p><div className="sb-product-actions"><span className="sb-product-price">{priced ? formatPKR(price) : 'Check shops'}</span><CartQuantityControl merchantProductId={card.merchantProductId} name={card.name} maxStock={card.stockQuantity} available={available} /></div></div>
  </article>;
}
