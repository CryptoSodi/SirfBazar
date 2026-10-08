'use client';

import { ToastMessage } from '@/components/Toast';
import { AppIcon } from '@/components/AppIcon';

import Link from 'next/link';
import { useState } from 'react';
import { addToCart, ApiError } from '@/lib/api';
import { formatPKR } from '@/lib/format';
import { Icon } from './Icons';

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
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const price = card.discountPricePaisa ?? card.pricePaisa;
  const priced = Number.isFinite(price) && price >= 0;
  const available = !!card.merchantProductId && card.stockQuantity !== 0 && priced;

  const add = async () => {
    setAdding(true); setError('');
    try {
      await addToCart(card.merchantProductId, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1200);
    } catch (e: any) { setError(e instanceof ApiError && e.status === 401 ? 'Basket session expired. Open your basket to start a new one.' : e.message || 'Unable to add this item. Try again.'); }
    finally { setAdding(false); }
  };

  return <article className="card sb-product-card">
    <Link href={`/product/${card.productId}`} className="sb-product-media"><ProductImage name={card.name} imageUrl={card.imageUrl} className="sb-product-image" /></Link>
    <div className="sb-product-details"><Link href={`/product/${card.productId}`} className="sb-product-name">{card.name}</Link><p className="sb-product-size">{[card.brand, card.size ?? card.unit].filter(Boolean).join(' · ') || 'See product details'}</p><p className="sb-product-shop"><Icon name="shop" size={11} />{card.merchant?.shopName || 'Choose a shop'}</p><div className="sb-product-actions"><span className="sb-product-price">{priced ? formatPKR(price) : 'Check shops'}</span><button type="button" className="sb-product-add" onClick={add} disabled={adding || !available} aria-label={`Add ${card.name} to basket`}>{card.stockQuantity === 0 ? 'Out of stock' : added ? <><AppIcon name="check" size={16} /> Added</> : adding ? 'Adding…' : <><AppIcon name="plus" size={16} /> Add</>}</button></div>{error && <ToastMessage>{error}</ToastMessage>}</div>
  </article>;
}
