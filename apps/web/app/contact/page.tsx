import { AppIcon as UiIcon } from '../../components/AppIcon';
import type { Metadata } from 'next';
import { ProsePage } from '@/components/ProsePage';
import { LegalLinks } from '@/components/LegalLinks';
import { SUPPORT_EMAIL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Contact' };

export default function Page() {
  return (
    <ProsePage title="Contact us">
      <LegalLinks />
      <p>We are here to help customers, merchants, and riders.</p>
      <ul>
        <li><UiIcon name="mail" size={18} /> Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
      </ul>
      <p>For order issues, the fastest route is the “Report an issue” button on your order screen — it creates a support ticket linked to your order.</p>
    </ProsePage>
  );
}
