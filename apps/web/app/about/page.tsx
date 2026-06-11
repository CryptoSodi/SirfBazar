import type { Metadata } from 'next';
import { ProsePage } from '@/components/ProsePage';

export const metadata: Metadata = {
  title: 'About SirfBazar',
  description: 'SirfBazar is your nearby bazar, now online — powered by trusted local shops.',
};

export default function Page() {
  return (
    <ProsePage title="About SirfBazar">
      <p>
        SirfBazar is a hyperlocal marketplace: customers order everyday essentials from trusted local shops nearby and
        get fast delivery by the shop's own riders.
      </p>
      <p>
        We do not own inventory. We do not operate warehouses or dark stores. Every rupee you spend goes through the
        shops that already serve your neighbourhood — we just make them one tap away.
      </p>
      <h2>What we believe</h2>
      <ul>
        <li>Local shops are the backbone of every community</li>
        <li>Convenience should not come at the cost of local livelihoods</li>
        <li>Software should empower shopkeepers, not replace them</li>
      </ul>
    </ProsePage>
  );
}
