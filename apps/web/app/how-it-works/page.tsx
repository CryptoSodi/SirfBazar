import type { Metadata } from 'next';
import { ProsePage } from '@/components/ProsePage';

export const metadata: Metadata = {
  title: 'How it works',
  description: 'Order from trusted local shops near you and get fast delivery — here is how SirfBazar works.',
};

export default function Page() {
  return (
    <ProsePage title="How SirfBazar works">
      <p>SirfBazar connects you with real local shops in your neighbourhood — no warehouses, no middlemen.</p>
      <h2>1. Browse nearby shops</h2>
      <p>Open the app or website and instantly see shops and products near you. No signup needed to browse.</p>
      <h2>2. Build your cart</h2>
      <p>Add groceries, pharmacy essentials, bakery items and more — even from multiple shops at once.</p>
      <h2>3. Login at checkout</h2>
      <p>Only when you are ready to order do we ask for a quick phone OTP or Google login. Your cart is kept safe.</p>
      <h2>4. The shop prepares your order</h2>
      <p>The shop accepts your order, packs it, and hands it to one of its own riders.</p>
      <h2>5. Track to your door</h2>
      <p>Watch live status and rider location. Share your 4-digit delivery code with the rider to complete the handover.</p>
    </ProsePage>
  );
}
