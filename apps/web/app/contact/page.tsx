import type { Metadata } from 'next';
import { ProsePage } from '@/components/ProsePage';

export const metadata: Metadata = { title: 'Contact' };

export default function Page() {
  return (
    <ProsePage title="Contact us">
      <p>We are here to help customers, merchants, and riders.</p>
      <ul>
        <li>📧 Email: <a className="text-emerald-700 underline" href="mailto:support@sirfbazar.pk">support@sirfbazar.pk</a></li>
        <li>📱 WhatsApp: +92 300 0000000</li>
        <li>🕘 Support hours: 9:00–23:00, 7 days a week</li>
      </ul>
      <p>For order issues, the fastest route is the “Report an issue” button on your order screen — it creates a support ticket linked to your order.</p>
    </ProsePage>
  );
}
