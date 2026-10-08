'use client';

import { AppIcon } from '@/components/AppIcon';
import { AppIcon as UiIcon } from '../../../components/AppIcon';


import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { addToCart, api } from '@/lib/api';
import { formatPKR } from '@/lib/format';
import { locationQuery, useLocation } from '@/lib/location';
import { ProductCard, ProductImage } from '@/components/ProductCard';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { location, resolved } = useLocation();
  const [product, setProduct] = useState<any>(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!resolved) return;
    let active = true;
    setError(''); setProduct(null);
    api.get(`/products/${id}?${locationQuery(location)}`).then((value) => {
      if (!active) return;
      setProduct(value);
      setSelectedId((value.offers ?? []).find((offer: any) => offer.isAvailable && offer.stockQuantity !== 0)?.merchantProductId ?? '');
    }).catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [id, resolved, location?.latitude, location?.longitude, reload]);

  if (error) return <div role="alert" className="card p-6"><p>Unable to load this item: {error}</p><button className="btn-secondary mt-3" onClick={() => setReload((value) => value + 1)}>Try again</button></div>;
  if (!product) return <p role="status">Loading product…</p>;

  const offers: any[] = product.offers ?? [];
  const selected = offers.find((offer) => offer.merchantProductId === selectedId);
  const add = async () => {
    if (!selected) return;
    setAdding(true); setAddError('');
    try { await addToCart(selected.merchantProductId, 1); setAdded(true); }
    catch (cause: any) { setAddError(cause.message || 'Unable to add this item. Try again.'); }
    finally { setAdding(false); }
  };

  return <div className="sb-product-page"><nav className="sb-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"><UiIcon name="chevron" size={18} /></span><Link href="/search">{product.category?.name || 'All essentials'}</Link><span aria-hidden="true"><UiIcon name="chevron" size={18} /></span><span>{product.name}</span></nav><div className="sb-product-overview"><div><div className="sb-product-large-image"><ProductImage name={product.name} imageUrl={product.imageUrl} className="h-full w-full" /></div><p className="sb-muted mt-2 text-xs">Product image and details come from the current catalogue.</p></div><div className="sb-product-offers"><p className="sb-home-eyebrow">{product.category?.name || 'Everyday essentials'}</p><h1>{product.name}</h1><span className="sb-product-size-pill">{[product.brand, product.size ?? product.unit].filter(Boolean).join(' · ') || 'See item details'}</span><p className="sb-muted mt-4">Choose the shop you’d like to buy from. Price and availability belong to that shop.</p><h2>Available from</h2><fieldset><legend className="sr-only">Choose a shop</legend>{offers.map((offer) => <label key={offer.merchantProductId} className={selectedId === offer.merchantProductId ? 'sb-product-offer selected' : 'sb-product-offer'}><input type="radio" name="shop-offer" checked={selectedId === offer.merchantProductId} disabled={!offer.isAvailable || offer.stockQuantity === 0} onChange={() => { setSelectedId(offer.merchantProductId); setAdded(false); }} /><span><strong>{offer.merchant.shopName}</strong><small>{offer.merchant.estimatedDeliveryMinutes ? `Est. ${offer.merchant.estimatedDeliveryMinutes} min · ` : ''}Delivery fee in basket</small></span><b>{formatPKR(offer.discountPricePaisa ?? offer.pricePaisa)}</b></label>)}</fieldset>{offers.length === 0 && <p className="sb-notice">No shop in this area currently offers this item. Choose another area or keep browsing.</p>}<div className="sb-product-add-row"><span>{selected ? `${selected.stockQuantity ?? 'Stock'} units available` : 'Choose a shop'}</span><button className="sb-product-add" disabled={!selected || adding} onClick={() => void add()}>{adding ? 'Adding…' : added ? <><AppIcon name="check" size={16} /> Added</> : <><AppIcon name="plus" size={16} /> Add</>}</button></div>{addError && <p role="alert" className="sb-error">{addError}</p>}<div className="sb-product-about"><h2>About this item</h2><p>{product.description || 'Check the current catalogue and packaging for exact product details.'}</p>{selected && <p>Sold and delivered by {selected.merchant.shopName}.</p>}</div></div></div>{(product.similar ?? []).length > 0 && <section className="sb-home-section"><div className="sb-home-section-heading"><div><h2>Keep your list moving</h2><p>Other everyday essentials.</p></div><Link href="/search">View all&nbsp; <UiIcon name="arrow" size={18} /></Link></div><div className="sb-product-grid">{product.similar.slice(0,6).map((item: any) => <ProductCard key={item.merchantProductId ?? item.productId} card={item} />)}</div></section>}</div>;
}
