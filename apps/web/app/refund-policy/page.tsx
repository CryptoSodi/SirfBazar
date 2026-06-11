import type { Metadata } from 'next';
import { ProsePage } from '@/components/ProsePage';

export const metadata: Metadata = { title: 'Refund policy' };

export default function Page() {
  return (
    <ProsePage title="Refund policy">
      <h2>Automatic refunds</h2>
      <p>Prepaid amounts are refunded to your SirfBazar wallet automatically and immediately when:</p>
      <ul>
        <li>The shop rejects or does not respond to your order</li>
        <li>You cancel before the shop accepts</li>
        <li>The payment succeeds but the order cannot be fulfilled</li>
      </ul>
      <h2>Item issues</h2>
      <p>
        Missing, wrong, damaged, or poor-quality items? Report the issue from the order screen within 24 hours. Our
        support team reviews each case and issues full or partial refunds to your wallet.
      </p>
      <h2>Wallet refunds</h2>
      <p>
        Wallet balance can be used on any future order. Refunds to the original payment method can be arranged through
        support where required by the payment provider.
      </p>
    </ProsePage>
  );
}
