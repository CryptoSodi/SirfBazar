import type { Metadata } from 'next';
import { ProsePage } from '@/components/ProsePage';

export const metadata: Metadata = {
  title: 'Become a merchant',
  description: 'Put your shop online with SirfBazar: manage products, orders, and your own riders.',
};

export default function Page() {
  return (
    <ProsePage title="Grow your shop with SirfBazar">
      <p>
        SirfBazar gives local shops the tools to sell online and fulfil nearby orders quickly — your shop, your
        inventory, your riders, our software.
      </p>
      <h2>What you get</h2>
      <ul>
        <li>A digital storefront visible to customers near your shop</li>
        <li>Order management: accept, prepare, and hand over in a couple of taps</li>
        <li>Product catalog and inventory tools, including bulk upload</li>
        <li>Your own rider management with live delivery tracking</li>
        <li>Earnings dashboard and transparent weekly settlements</li>
      </ul>
      <h2>How to join</h2>
      <ul>
        <li>Download the SirfBazar Merchant app and sign up with your phone number</li>
        <li>Add your shop details, location, and documents</li>
        <li>Our team reviews and approves your shop — usually within 1–2 working days</li>
        <li>Add products, go online, and start receiving orders</li>
      </ul>
      <p>Commission is simple and transparent — a small percentage per delivered order. No order, no fee.</p>
    </ProsePage>
  );
}
