'use client';

import Link from 'next/link';
import { useState } from 'react';
import { addToCart } from '@/lib/api';
import { formatPKR } from '@/lib/format';

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
  merchant?: {
    id: string;
    shopName: string;
    distanceKm?: number | null;
    estimatedDeliveryMinutes?: number | null;
    ratingAverage?: number;
  };
}

export function ProductImage({ name, imageUrl, className }: { name: string; imageUrl?: string | null; className?: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={name} className={`${className} object-cover`} />;
  }
  // Graceful placeholder: tinted tile with the product's initial.
  return (
    <div className={`${className} grid place-items-center bg-emerald-50 text-3xl`}>
      <span aria-hidden>🛍️</span>
    </div>
  );
}

export function ProductCard({ card }: { card: ProductCardData }) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const price = card.discountPricePaisa ?? card.pricePaisa;

  const add = async () => {
    setAdding(true);
    try {
      await addToCart(card.merchantProductId, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1200);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="card flex flex-col overflow-hidden">
      <Link href={`/product/${card.productId}`} className="block">
        <ProductImage name={card.name} imageUrl={card.imageUrl} className="h-32 w-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link href={`/product/${card.productId}`} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-emerald-700">
          {card.name}
        </Link>
        <div className="text-xs text-stone-500">
          {[card.brand, card.size ?? card.unit].filter(Boolean).join(' · ')}
        </div>
        {card.merchant && (
          <div className="truncate text-[11px] text-stone-400">
            {card.merchant.shopName}
            {card.merchant.estimatedDeliveryMinutes ? ` · ~${card.merchant.estimatedDeliveryMinutes} min` : ''}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <span className="font-bold">{formatPKR(price)}</span>
            {card.discountPricePaisa && (
              <span className="ml-1.5 text-xs text-stone-400 line-through">{formatPKR(card.pricePaisa)}</span>
            )}
          </div>
          <button
            onClick={add}
            disabled={adding || card.stockQuantity === 0}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              added ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            } disabled:opacity-50`}
          >
            {card.stockQuantity === 0 ? 'Out' : added ? '✓ Added' : adding ? '…' : '+ Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
