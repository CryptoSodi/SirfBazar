import { money, type PosLine } from '../lib/ipos';

export default function IPosClassicBill({ lines, selectedId, disabled, showCodes, showStock, onSelect, onQuantity, onRemove }: {
  lines: PosLine[]; selectedId: string; disabled: boolean; showCodes: boolean; showStock: boolean;
  onSelect: (id: string) => void; onQuantity: (id: string) => void; onRemove: (id: string) => void;
}) {
  return <table className="ipos-classic-table">
    <caption>Current unpaid bill · select an item to change its quantity</caption>
    <thead><tr>{showCodes && <th scope="col">Item code</th>}<th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Price</th><th scope="col">Total</th><th scope="col">Action</th></tr></thead>
    <tbody>{lines.map(({ product, quantity }) => <tr key={product.merchantProductId} data-selected={selectedId === product.merchantProductId}>
      {showCodes && <td data-label="Item code" className="ipos-code">{product.barcode || product.merchantSku || 'Not assigned'}</td>}
      <td data-label="Description"><button className="ipos-line-select" disabled={disabled} aria-pressed={selectedId === product.merchantProductId} onClick={() => onSelect(product.merchantProductId)}>{product.name}</button><small>{product.unit}{showStock ? ` · ${product.stockQuantity} on hand` : ''}</small>{quantity > product.stockQuantity && <small>Insufficient stock. Reduce quantity.</small>}</td>
      <td data-label="Quantity"><button className="ops-button" disabled={disabled} aria-label={`Set quantity of ${product.name}`} onClick={() => onQuantity(product.merchantProductId)}>{quantity}</button></td>
      <td data-label="Unit price">{money(product.pricePaisa)}</td><td data-label="Total"><strong>{money(product.pricePaisa * quantity)}</strong></td>
      <td data-label="Action"><button className="ops-button ops-button-danger" disabled={disabled} aria-label={`Remove ${product.name}`} onClick={() => onRemove(product.merchantProductId)}>Remove</button></td>
    </tr>)}</tbody>
  </table>;
}
