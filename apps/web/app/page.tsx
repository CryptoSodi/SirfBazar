'use client';

import { AppIcon as UiIcon } from '../components/AppIcon';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { locationQuery, useLocation } from '@/lib/location';
import { ProductCard, ProductCardData } from '@/components/ProductCard';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Icon } from '@/components/Icons';
import { CoverageNotice } from '@/components/CoverageNotice';
import { HomeRail } from '@/components/HomeRail';
import { GroceryHero } from '@/components/GroceryHero';
import { LocationPicker } from '@/components/LocationPicker';
import { ShopAvailabilityLink, shopAcceptingOrders, shopStatus } from '@/components/ShopAvailability';

export default function HomePage() {
  const { location, resolved } = useLocation();
  const [categories, setCategories] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopError, setShopError] = useState(false);
  const [productError, setProductError] = useState(false);
  const [reload, setReload] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!resolved) return;
    let active = true;
    const query = locationQuery(location);
    setLoading(true);
    setShopError(false);
    setProductError(false);
    const requests = [api.get('/products/categories'), ...(location ? [
      api.get(`/merchants/nearby?${query}`),
      api.get(`/products/nearby?${query}&pageSize=24`),
    ] : [])];
    Promise.allSettled(requests).then(([categoryResult, shopResult, productResult]) => {
      if (!active) return;
      if (categoryResult.status === 'fulfilled') setCategories(categoryResult.value ?? []);
      if (location && shopResult?.status === 'fulfilled') setShops(shopResult.value.items ?? shopResult.value ?? []);
      else setShops([]);
      if (location && productResult?.status === 'fulfilled') setProducts(productResult.value.items ?? []);
      else setProducts([]);
      setShopError(!!location && shopResult?.status === 'rejected');
      setProductError(!!location && productResult?.status === 'rejected');
      setLoading(false);
    });
    return () => { active = false; };
  }, [resolved, location?.latitude, location?.longitude, reload]);

  const noShopsInArea = !!location && !loading && !shopError && shops.length === 0;
  const retry = () => setReload((value) => value + 1);
  let shopContent: ReactNode;
  if (!location) {
    shopContent = <CoverageNotice className="mt-4" hasLocation={false} onChooseLocation={() => setPickerOpen(true)} onRetry={retry} />;
  } else if (loading) {
    shopContent = <div className="sb-home-shops" aria-label="Loading nearby shops">
      {Array.from({ length: 3 }).map((_, index) => <div key={index} className="card sb-shop-skeleton" />)}
    </div>;
  } else if (shopError) {
    shopContent = <div className="sb-load-error" role="alert">
      <p>We couldn’t load shops for this delivery area.</p>
      <button type="button" className="btn-secondary" onClick={retry}>Try again</button>
    </div>;
  } else if (shops.length) {
    shopContent = <HomeRail label="Shops that deliver to you" className="sb-home-shops">
      {shops.map((shop) => <ShopAvailabilityLink key={shop.id} shop={shop} className="sb-home-shop">
        <span className="sb-shop-mark">
          {shop.logoUrl ? <img src={shop.logoUrl} alt={`${shop.shopName} logo`} /> : <Icon name="shop" size={27} />}
        </span>
        <span>
          <strong>{shop.shopName}</strong>
          <small>{String(shop.shopType || 'Local shop').replace(/_/g, ' ').toLowerCase()}</small>
          <small>{shopStatus(shop)}{shopAcceptingOrders(shop) ? shop.estimatedDeliveryMinutes ? ` · ${shop.estimatedDeliveryMinutes} min estimate` : '' : ' · Not accepting orders'}</small>
          {Number.isFinite(shop.distanceKm) && <small>{shop.distanceKm} km away</small>}
        </span>
        {shopAcceptingOrders(shop) && <span aria-hidden="true"><UiIcon name="chevron" size={18} /></span>}
      </ShopAvailabilityLink>)}
    </HomeRail>;
  } else {
    shopContent = <CoverageNotice className="mt-4" hasLocation onChooseLocation={() => setPickerOpen(true)} onRetry={retry} />;
  }

  let productContent: ReactNode;
  if (loading) {
    productContent = <div className="sb-product-grid" aria-label="Loading products">
      {Array.from({ length: 6 }).map((_, index) => <div key={index} className="card sb-product-skeleton" />)}
    </div>;
  } else if (productError) {
    productContent = <div className="sb-load-error" role="alert">
      <p>We couldn’t load products for this delivery area.</p>
      <button className="btn-secondary" onClick={retry}>Try again</button>
    </div>;
  } else if (products.length) {
    productContent = <HomeRail label="Everyday essentials" className="sb-home-products">
      {products.slice(0, 6).map((product) => <ProductCard key={product.merchantProductId} card={product} />)}
    </HomeRail>;
  } else {
    productContent = <p className="sb-muted">No nearby products for this area yet. Choose another area to see what shops offer.</p>;
  }

  return <div className="sb-home">
    <GroceryHero hasConfirmedLocation={resolved && !!location} onChooseLocation={() => setPickerOpen(true)} />

    <section className="sb-home-section" aria-labelledby="nearby-shops-title">
      <div className="sb-home-section-heading">
        <div><h2 id="nearby-shops-title">Shops that deliver to you</h2><p>Availability is based on each shop’s delivery coverage.</p></div>
        {location && <Link href="/search?type=shops">See all&nbsp; <UiIcon name="arrow" size={18} /></Link>}
      </div>
      {shopContent}
    </section>

    {categories.length > 0 && <section className="sb-home-section">
      <div className="sb-home-section-heading">
        <div><h2>Shop by category</h2><p>Start with what you need today.</p></div>
        <Link href="/search">Browse all&nbsp; <UiIcon name="arrow" size={18} /></Link>
      </div>
      <HomeRail label="Categories" className="sb-home-categories">
        {categories.map((category) => <Link key={category.id} href={`/search?category=${encodeURIComponent(category.id)}`} className="sb-home-category">
          <span aria-hidden="true"><CategoryIcon slug={category.slug} storedIcon={category.iconUrl} /></span><strong>{category.name}</strong>
        </Link>)}
      </HomeRail>
    </section>}

    {location && !noShopsInArea && <section className="sb-home-section">
      <div className="sb-home-section-heading">
        <div><h2>Everyday essentials</h2><p>A useful place to start. Choose a product, see its shop.</p></div>
        <Link href="/search">See all&nbsp; <UiIcon name="arrow" size={18} /></Link>
      </div>
      {productContent}
    </section>}

    {location && products.length > 6 && <section className="sb-home-section">
      <div className="sb-home-section-heading">
        <div><h2>A little more for your basket</h2><p>Fresh picks and household favourites.</p></div>
        <Link href="/search">View all&nbsp; <UiIcon name="arrow" size={18} /></Link>
      </div>
      <HomeRail label="More products" className="sb-home-products">
        {products.slice(6, 12).map((product) => <ProductCard key={product.merchantProductId} card={product} />)}
      </HomeRail>
    </section>}

    <section className="sb-home-reassurance">
      <p><strong>Know your shop</strong><span>See who is preparing and delivering your order.</span></p>
      <p><strong>Browse first, sign in later</strong><span>Start shopping. We’ll ask you to sign in at checkout.</span></p>
      <p><strong>Clear before you confirm</strong><span>Review each shop, delivery charge and the full total.</span></p>
    </section>
    {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
  </div>;
}
