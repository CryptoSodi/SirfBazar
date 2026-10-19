import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { parseRupees, parseStock } from '../lib/bulk-import';
import { type CatalogCategory } from '../lib/catalog-categories';
import { readListing, type MerchantListing } from '../lib/merchant-contracts';
import { Modal, inputCls } from './ui';
import { ReferenceIcon } from './ReferenceIcon';

function categoryOptions(categories: CatalogCategory[], depth = 0): { id: string; label: string }[] {
  return categories.flatMap((category) => [
    { id: category.id, label: `${'— '.repeat(depth)}${category.name}` },
    ...categoryOptions(category.children ?? [], depth + 1),
  ]);
}

export default function AddProduct({ onClose, onSaved }: { onClose: () => void; onSaved: (listing: MerchantListing) => void }) {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [categoryError, setCategoryError] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('piece');
  const [size, setSize] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [sku, setSku] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/products/categories').then((rows: CatalogCategory[]) => {
      if (active) setCategories(rows);
    }).catch(() => {
      if (active) setCategoryError('Categories could not be loaded. Close this form and try again.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!image) { setPhotoPreviewUrl(''); return; }
    const preview = URL.createObjectURL(image);
    setPhotoPreviewUrl(preview);
    setPreviewFailed(false);
    return () => URL.revokeObjectURL(preview);
  }, [image]);

  const previewUrl = image ? photoPreviewUrl : imageUrl.trim();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    try {
      if (!name.trim()) throw Error('Enter a product name.');
      if (!categoryId) throw Error('Choose a category.');
      if (image && image.size > 6 * 1024 * 1024) throw Error('Choose a product photo smaller than 6 MB.');
      const pricePaisa = parseRupees(price);
      const stockQuantity = parseStock(stock);
      setBusy(true);
      let savedImageUrl = imageUrl.trim();
      if (image) {
        const form = new FormData();
        form.append('file', image);
        const uploaded = await api.upload('/uploads/image', form) as { url?: string };
        if (!uploaded.url) throw Error('The product image could not be saved. Please try again.');
        savedImageUrl = uploaded.url;
      }
      const listing = readListing(await api.post('/merchant/products', {
        newProduct: {
          name: name.trim(), categoryId, unit,
          ...(brand.trim() ? { brand: brand.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(size.trim() ? { size: size.trim() } : {}),
          ...(savedImageUrl ? { imageUrl: savedImageUrl } : {}),
        },
        pricePaisa, stockQuantity,
        ...(sku.trim() ? { merchantSku: sku.trim() } : {}),
      }));
      onSaved(listing);
      onClose();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };

  return <Modal title="Add a new product" onClose={onClose}>
    <form className="add-product-form" onSubmit={(event) => void submit(event)}>
      <p className="add-product-note">Add this item to your shop now. The shared catalogue can include it after a separate review.</p>
      <h3>Product details</h3>
      <label>Product name <span aria-hidden="true">*</span><input className={inputCls} required maxLength={240} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Fresh apples" /></label>
      <label>Category <span aria-hidden="true">*</span><select className={inputCls} required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Choose a category</option>{categoryOptions(categories).map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
      {categoryError && <p role="alert" className="catalog-field-error">{categoryError}</p>}
      <div className="add-product-pair"><label>Brand (optional)<input className={inputCls} maxLength={160} value={brand} onChange={(event) => setBrand(event.target.value)} /></label><label>Pack size (optional)<input className={inputCls} maxLength={80} value={size} onChange={(event) => setSize(event.target.value)} placeholder="e.g. 500 g" /></label></div>
      <div className="add-product-pair"><label>Unit <span aria-hidden="true">*</span><select className={inputCls} value={unit} onChange={(event) => setUnit(event.target.value)}><option value="piece">Piece</option><option value="kg">Kilogram</option><option value="g">Gram</option><option value="litre">Litre</option><option value="ml">Millilitre</option><option value="pack">Pack</option><option value="dozen">Dozen</option></select></label><label>Shop SKU (optional)<input className={inputCls} maxLength={160} value={sku} onChange={(event) => setSku(event.target.value)} /></label></div>
      <h3>Product photo</h3>
      <div className="add-product-photo">
        <div className="add-product-preview" aria-label={previewUrl && !previewFailed ? 'Product photo preview' : 'No product photo selected'}>
          {previewUrl && !previewFailed ? <img src={previewUrl} alt="Selected product preview" onError={() => setPreviewFailed(true)} /> : <span><ReferenceIcon name="package" size="lg" /><small>{previewFailed ? 'Photo could not be displayed' : 'Photo preview'}</small></span>}
        </div>
        <div className="add-product-photo-controls">
          <label>Upload a photo (optional)<input ref={photoInput} className={inputCls} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setImage(event.target.files?.[0] ?? null); setPreviewFailed(false); }} /><small>JPG, PNG or WebP · up to 6 MB</small></label>
          {image && <button type="button" className="btn tiny" onClick={() => { setImage(null); if (photoInput.current) photoInput.current.value = ''; }}>Remove selected photo</button>}
          {!image && <label>Or paste an image URL<input className={inputCls} type="url" value={imageUrl} onChange={(event) => { setImageUrl(event.target.value); setPreviewFailed(false); }} placeholder="https://example.com/product.jpg" /></label>}
          {previewFailed && <p className="catalog-field-error" role="status">Check the image link or choose another photo. You can also save without a photo.</p>}
        </div>
      </div>
      <h3>Selling details</h3>
      <div className="add-product-pair"><label>Selling price (Rs) <span aria-hidden="true">*</span><input className={inputCls} required inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" /></label><label>Stock quantity <span aria-hidden="true">*</span><input className={inputCls} required inputMode="numeric" value={stock} onChange={(event) => setStock(event.target.value)} /></label></div>
      <label>Description (optional)<textarea className={inputCls} maxLength={2000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      {error && <p className="catalog-field-error" role="alert">{error}</p>}
      <div className="add-product-actions"><button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="btn primary" disabled={busy || !categories.length}>{busy ? 'Saving…' : 'Add to my shop'}</button></div>
    </form>
  </Modal>;
}
