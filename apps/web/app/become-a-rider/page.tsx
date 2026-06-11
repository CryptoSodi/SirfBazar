import type { Metadata } from 'next';
import { ProsePage } from '@/components/ProsePage';

export const metadata: Metadata = {
  title: 'Become a rider',
  description: 'Deliver for a local shop on SirfBazar with simple tools and live navigation.',
};

export default function Page() {
  return (
    <ProsePage title="Ride with SirfBazar">
      <p>
        Riders on SirfBazar work directly with local shops. The shop you join manages your assignments; the SirfBazar
        Rider app gives you everything to deliver smoothly.
      </p>
      <h2>How it works</h2>
      <ul>
        <li>A shop owner adds you as their rider using your phone number</li>
        <li>Log in to the Rider app with a one-time code — no paperwork in the app</li>
        <li>Go online, receive assigned orders, and navigate to pickup and drop-off</li>
        <li>Complete deliveries with the customer's secure delivery code</li>
      </ul>
      <h2>Why riders like it</h2>
      <ul>
        <li>Work with a shop you know, in your own neighbourhood</li>
        <li>Clear order details, customer notes, and one-tap navigation</li>
        <li>Your delivery history in one place</li>
      </ul>
      <p>Ask a SirfBazar merchant near you to add you as a rider, and you are set.</p>
    </ProsePage>
  );
}
