'use client';
import { AppIcon as UiIcon } from '../components/AppIcon';


import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { FALLBACK_LOCATION, locationQuery, useLocation } from '@/lib/location';
import { ProductCard, ProductCardData } from '@/components/ProductCard';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Icon } from '@/components/Icons';
import { CoverageNotice } from '@/components/CoverageNotice';
import { HomeRail } from '@/components/HomeRail';

export default function HomePage() {
  const { location, resolved, choose } = useLocation();
  const [categories, setCategories] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!resolved || !location) return;
    let active = true;
    const query = locationQuery(location);
    setLoading(true); setLoadError(false);
    Promise.allSettled([
      api.get(`/products/categories?${query}`),
      api.get(`/merchants/nearby?${query}`),
      api.get(`/products/nearby?${query}&pageSize=24`),
    ]).then(([categoryResult, shopResult, productResult]) => {
      if (!active) return;
      if (categoryResult.status === 'fulfilled') setCategories(categoryResult.value ?? []);
      if (shopResult.status === 'fulfilled') setShops(shopResult.value.items ?? shopResult.value ?? []);
      if (productResult.status === 'fulfilled') setProducts(productResult.value.items ?? []);
      setLoadError(shopResult.status === 'rejected' || productResult.status === 'rejected');
      setLoading(false);
    });
    return () => { active = false; };
  }, [resolved, location?.latitude, location?.longitude, reload]);

  const noShopsInArea = !loading && !loadError && shops.length === 0 && products.length === 0;
  const inExampleArea = location?.label === FALLBACK_LOCATION.label;

  return <div className="sb-home">
    <section className="sb-home-hero" aria-labelledby="home-hero-title">
      <div className="sb-home-hero-copy"><span className="sb-home-eyebrow">Familiar shops. Easier shopping.</span><h1 id="home-hero-title">Your everyday<br />essentials.<br /><em>Closer than ever.</em></h1><p>Fill your basket from local shops. They prepare your order and deliver it to your door.</p><div className="sb-hero-actions"><Link href="/search" className="btn-primary">Shop essentials&nbsp; <UiIcon name="arrow" size={18} /></Link><Link href="/search?type=shops">Explore shops</Link></div></div>
      <div className="sb-hero-art" aria-hidden="true"><span className="sb-hero-orbit" /><Image className="sb-hero-bread" src="/design/product-bread.svg" alt="" width={150} height={180} /><Image className="sb-hero-banana" src="/design/product-banana.svg" alt="" width={155} height={140} /><div className="sb-hero-bag"><span>YOUR DAILY<br />GOOD THINGS</span></div><Image className="sb-hero-milk" src="/design/product-milk.svg" alt="" width={140} height={185} /><Image className="sb-hero-tomato" src="/design/product-tomato.svg" alt="" width={125} height={100} /></div>
      <div className="sb-hero-note">From their shelves.<br /><strong>To your doorstep.</strong></div>
    </section>

    {noShopsInArea && <CoverageNotice className="mt-6" inExampleArea={inExampleArea} onBrowseExample={() => choose(FALLBACK_LOCATION)} onRetry={() => setReload((value) => value + 1)} />}

    {categories.length > 0 && <section className="sb-home-section"><div className="sb-home-section-heading"><div><h2>Shop by category</h2><p>Start with what you need today.</p></div><Link href="/search">Browse all&nbsp; <UiIcon name="arrow" size={18} /></Link></div><HomeRail label="Categories" className="sb-home-categories">{categories.map((category) => <Link key={category.id} href={`/search?category=${encodeURIComponent(category.id)}`} className="sb-home-category"><span aria-hidden="true"><CategoryIcon slug={category.slug} storedIcon={category.iconUrl} /></span><strong>{category.name}</strong></Link>)}</HomeRail></section>}

    {!noShopsInArea && <section className="sb-home-section"><div className="sb-home-section-heading"><div><h2>Everyday essentials</h2><p>A useful place to start. Choose a product, see its shop.</p></div><Link href="/search">See all&nbsp; <UiIcon name="arrow" size={18} /></Link></div>
      {loading ? <div className="sb-product-grid" aria-label="Loading products">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="card sb-product-skeleton" />)}</div> : products.length ? <HomeRail label="Everyday essentials" className="sb-home-products">{products.slice(0, 6).map((product) => <ProductCard key={product.merchantProductId} card={product} />)}</HomeRail> : !loadError && <p className="sb-muted">No nearby products for this area yet. Choose another area to see what shops offer.</p>}
    </section>}

    {loadError && <div className="sb-load-error" role="alert"><p>We couldn’t load all local shops and products. Your basket stays in place.</p><button className="btn-secondary" onClick={() => setReload((value) => value + 1)}>Try again</button></div>}

    {!noShopsInArea && <section className="sb-home-section"><div className="sb-home-section-heading"><div><h2>Your neighbourhood, online</h2><p>Shops prepare and deliver their own orders.</p></div><Link href="/search?type=shops">Explore shops&nbsp; <UiIcon name="arrow" size={18} /></Link></div><HomeRail label="Neighbourhood shops" className="sb-home-shops">{shops.map((shop) => <Link key={shop.id} href={`/shop/${shop.id}`} className="sb-home-shop"><span className="sb-shop-mark"><Icon name="shop" size={27} /></span><span><strong>{shop.shopName}</strong><small>{shop.category?.name || shop.city || 'Local shop'}</small><small>{shop.isOnline && shop.isOpen ? 'Open' : 'Closed'}{shop.estimatedDeliveryMinutes ? ` · ${shop.estimatedDeliveryMinutes} min estimate` : ''}</small></span><span aria-hidden="true"><UiIcon name="chevron" size={18} /></span></Link>)}</HomeRail>{!loading && !loadError && shops.length === 0 && <p className="sb-muted">No shops available for this area yet. Choose another delivery area to explore.</p>}</section>}

    {products.length > 6 && <section className="sb-home-section"><div className="sb-home-section-heading"><div><h2>A little more for your basket</h2><p>Fresh picks and household favourites.</p></div><Link href="/search">View all&nbsp; <UiIcon name="arrow" size={18} /></Link></div><HomeRail label="More products" className="sb-home-products">{products.slice(6, 12).map((product) => <ProductCard key={product.merchantProductId} card={product} />)}</HomeRail></section>}
    <section className="sb-home-reassurance"><p><strong>Know your shop</strong><span>See who is preparing and delivering your order.</span></p><p><strong>Browse first, sign in later</strong><span>Start shopping. We’ll ask you to sign in at checkout.</span></p><p><strong>Clear before you confirm</strong><span>Review each shop, delivery charge and the full total.</span></p></section>
  </div>;
}
