'use client';
import { AppIcon as UiIcon } from '@/components/AppIcon';


import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatPKR } from '@/lib/format';
import { locationQuery, useLocation } from '@/lib/location';
import { ProductCard, ProductCardData } from '@/components/ProductCard';
import { Icon } from '@/components/Icons';
import { shopAcceptingOrders, shopStatus } from '@/components/ShopAvailability';

export default function ShopPage() {
  const { id } = useParams<{ id: string }>();
  const { location, resolved } = useLocation();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [tab, setTab] = useState<'products' | 'information'>('products');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [retryProducts, setRetryProducts] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!resolved) return;
    let active = true;
    setError('');
    api.get(`/merchants/${id}?${locationQuery(location)}`).then((value) => { if (active) setShop(value); }).catch((cause: Error) => { if (active) setError(cause.message); });
    api.get(`/merchants/${id}/reviews?pageSize=10`).then((value) => { if (active) setReviews(value.items ?? []); }).catch(() => undefined);
    return () => { active = false; };
  }, [id, resolved, location?.latitude, location?.longitude, retryProducts]);

  useEffect(() => {
    if (!shop || shop.id !== id || !shopAcceptingOrders(shop)) {
      setProducts([]); setTotal(0); setLoadingProducts(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setLoadingProducts(true); setProductsError('');
      api.get(`/merchants/${id}/products?pageSize=60&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
        .then((value) => { if (!active) return; setProducts((current) => page === 1 ? value.items ?? [] : [...current, ...(value.items ?? [])]); setTotal(value.total ?? 0); })
        .catch((cause: Error) => { if (active) setProductsError(cause.message || 'Unable to load shop products.'); })
        .finally(() => { if (active) setLoadingProducts(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [id, q, page, retryProducts, shop?.id, shop?.isOnline, shop?.isOpen]);

  if (error) return <div role="alert" className="card p-6"><p>Unable to load this shop: {error}</p><Link className="btn-secondary mt-3 inline-flex" href="/search?type=shops">Explore other shops</Link></div>;
  if (!shop || shop.id !== id) return <p role="status">Loading shop…</p>;
  if (!shopAcceptingOrders(shop)) return <div className="sb-shop-page">
    <nav className="sb-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/search?type=shops">Local shops</Link><span aria-hidden="true">/</span><span>{shop.shopName}</span></nav>
    <section className="card p-6"><h1>{shop.shopName}</h1><p className="mt-3 font-semibold">{shopStatus(shop)} · Not accepting orders</p><p className="sb-muted mt-3">This shop’s products are hidden until it is accepting orders again. Any items already in your basket stay there.</p>
      <div className="flex flex-wrap gap-3 mt-4"><Link className="btn-primary" href="/search?type=shops">Explore other shops</Link><button className="btn-secondary" onClick={() => { setPage(1); setRetryProducts((value) => value + 1); }}>Check availability again</button></div>
    </section>
  </div>;

  return <div className="sb-shop-page"><nav className="sb-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"><UiIcon name="chevron" size={18} /></span><Link href="/search?type=shops">Local shops</Link><span aria-hidden="true"><UiIcon name="chevron" size={18} /></span><span>{shop.shopName}</span></nav><section className="sb-shop-hero"><span className="sb-shop-hero-mark"><Icon name="shop" size={37} /></span><div><span className="sb-home-eyebrow">Your local shop</span><h1>{shop.shopName}</h1><p>{shop.shopType || 'Local shop'} · {shop.address || shop.city || 'Area details unavailable'}</p><div className="sb-shop-facts"><span>{shop.estimatedDeliveryMinutes ? `${shop.estimatedDeliveryMinutes} min estimated delivery` : 'Delivery time in basket'}</span><span>Delivery fee shown in basket</span><span>Prepared &amp; delivered by this shop</span></div></div><span className="sb-shop-open">{shop.isOnline && shop.isOpen ? <><Icon name="online" size={16} /> Open</> : "Closed"}</span></section>
    <div className="sb-shop-title"><h2>{tab === 'products' ? 'On the shelves' : 'Delivery & reviews'}</h2><button onClick={() => setTab('information')}>Shop information <Icon name="info" size={18} /></button></div><div className="sb-shop-tabs"><button className={tab === 'products' ? 'selected' : ''} onClick={() => setTab('products')}>All products</button><button className={tab === 'information' ? 'selected' : ''} onClick={() => setTab('information')}>Delivery &amp; reviews</button></div>
    {tab === 'products' ? <><div className="sb-shop-search"><label htmlFor="shop-product-search">Search in this shop</label><input id="shop-product-search" className="input" placeholder="Search products in this shop" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} /></div>{productsError && <div className="sb-error" role="alert">{productsError} <button className="underline" onClick={() => setRetryProducts((value) => value + 1)}>Try again</button></div>}{loadingProducts && products.length === 0 ? <p role="status">Loading products…</p> : <div className="sb-product-grid">{products.map((offer) => { const card: ProductCardData = { productId: offer.product.id, merchantProductId: offer.merchantProductId ?? offer.id, name: offer.product.name, brand: offer.product.brand, imageUrl: offer.product.imageUrl, size: offer.product.size, unit: offer.product.unit, pricePaisa: offer.pricePaisa, discountPricePaisa: offer.discountPricePaisa, stockQuantity: offer.isAvailable ? offer.stockQuantity : 0, merchant: { id: shop.id, shopName: shop.shopName } }; return <ProductCard key={card.merchantProductId} card={card} />; })}</div>}{!loadingProducts && !productsError && products.length === 0 && <p className="sb-muted">No products match this search. Try another word.</p>}<div role="status" className="sb-muted mt-4">Showing {products.length} of {total} products</div>{!productsError && products.length < total && <button className="btn-secondary mt-3" disabled={loadingProducts} onClick={() => setPage((value) => value + 1)}>{loadingProducts ? 'Loading…' : 'Load more products'}</button>}</> : <div className="sb-shop-information"><section className="card"><h3>Delivery from {shop.shopName}</h3><p>Orders are prepared and delivered by this shop. The delivery fee and full total are calculated in your basket for your location.</p>{shop.estimatedDeliveryMinutes && <p>Estimated delivery: {shop.estimatedDeliveryMinutes} min. Final timing depends on the shop and rider.</p>}{shop.minimumOrderValuePaisa > 0 && <p>Minimum order: {formatPKR(shop.minimumOrderValuePaisa)}</p>}{shop.openingTime && <p>Hours: {shop.openingTime}–{shop.closingTime}</p>}</section><section className="card"><h3>Customer reviews</h3>{reviews.length ? reviews.map((review) => <div key={review.id} className="sb-review"><strong aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: Math.min(5, Math.max(0, Math.round(review.rating))) }, (_, index) => <UiIcon key={index} name="star" size={16} fill="currentColor" />)}</strong><span>{review.customer?.fullName || 'Customer'}</span>{review.reviewText && <p>{review.reviewText}</p>}</div>) : <p>No reviews yet.</p>}</section></div>}
  </div>;
}
