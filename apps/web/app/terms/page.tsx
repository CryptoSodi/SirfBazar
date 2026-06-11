import type { Metadata } from 'next';
import { ProsePage } from '@/components/ProsePage';

export const metadata: Metadata = { title: 'Terms and conditions' };

export default function Page() {
  return (
    <ProsePage title="Terms and conditions">
      <p>By using SirfBazar you agree to these terms.</p>
      <h2>The marketplace</h2>
      <p>
        SirfBazar is a platform connecting customers with independent local shops. Products are sold by the shops, and
        deliveries are made by riders managed by those shops. Prices, stock, and preparation are the shop's
        responsibility; SirfBazar provides the ordering, payment, and tracking software.
      </p>
      <h2>Orders</h2>
      <ul>
        <li>An order is a binding offer once placed; the shop may accept or reject it</li>
        <li>You may cancel free of charge until the shop accepts the order</li>
        <li>Delivery requires your 4-digit delivery code — keep it private until the rider arrives</li>
      </ul>
      <h2>Payments and fees</h2>
      <ul>
        <li>Prices shown include the product price set by the shop</li>
        <li>Delivery, service, and small-order fees are shown before you place the order</li>
        <li>Refunds are issued to your SirfBazar wallet per the refund policy</li>
      </ul>
      <h2>Fair use</h2>
      <p>Abusive behaviour toward shops or riders, fraudulent orders, or misuse of coupons may lead to account suspension.</p>
    </ProsePage>
  );
}
