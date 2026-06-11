import type { Metadata } from 'next';
import { ProsePage } from '@/components/ProsePage';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function Page() {
  return (
    <ProsePage title="Privacy policy">
      <p>SirfBazar collects only the data needed to run the marketplace.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your phone number or Google email for login</li>
        <li>Delivery addresses you save</li>
        <li>Approximate location (with your permission) to show nearby shops</li>
        <li>Order history and support conversations</li>
      </ul>
      <h2>How it is used</h2>
      <ul>
        <li>Showing nearby shops and calculating delivery fees and times</li>
        <li>Sharing your delivery address with the shop and its rider for your active order only</li>
        <li>Fraud prevention and customer support</li>
      </ul>
      <h2>What we never do</h2>
      <ul>
        <li>Sell your personal data</li>
        <li>Track your location outside of using the app</li>
        <li>Show your phone number to anyone except the shop/rider fulfilling your order</li>
      </ul>
      <p>To delete your account and personal data, use the “Delete account” option in your profile.</p>
    </ProsePage>
  );
}
