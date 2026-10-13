import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage } from '@/components/ProsePage';
import { LegalLinks } from '@/components/LegalLinks';
import { BUSINESS_NAME, SUPPORT_EMAIL, DELETION_EMAIL_URL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Request account deletion', description: 'Request deletion of your SirfBazar customer, merchant or rider account and associated personal data through Sirf Bazar support.' };

export default function Page() {
  return <ProsePage title="Request account deletion">
    <LegalLinks />
    <p>{BUSINESS_NAME} accepts account and associated personal-data deletion requests for the SirfBazar customer app,
      SirfBazar Merchant app, SirfBazar Rider app and website through support.</p>
    <p><a href={DELETION_EMAIL_URL}>Email {SUPPORT_EMAIL} to request deletion</a></p>
    <p>You can also send an email manually to {SUPPORT_EMAIL} with the subject
      &quot;SirfBazar account and data deletion request&quot;. No website sign-in or app reinstallation is required to send a request.</p>
    <h2>What to include</h2>
    <ol>
      <li>Identify the app or apps you use: customer, merchant or rider.</li>
      <li>Provide the email address or phone number associated with your SirfBazar account, preferably by writing from
        the registered email address. If you no longer have access to it, explain that in your message.</li>
      <li>State that you want your account and associated personal data deleted. Mention any outstanding order or
        settlement reference that support should review.</li>
    </ol>
    <p>Do not send passwords, sign-in codes, payment-card details or identity-document copies with the initial request.</p>
    <h2>Verification and processing</h2>
    <p>Support may need to verify that the account belongs to you before taking action. Ask support to confirm receipt,
      the expected processing time and completion. Sending an email, signing out or uninstalling the app does not itself
      delete your server-side data.</p>
    <h2>Data covered and possible retention</h2>
    <p>Your request covers account/profile information and associated personal data, including saved addresses,
      linked sign-in details and device registrations where applicable. Support will review associated orders, uploaded
      content and support records as part of the request.</p>
    <p>Some order, payment, refund, settlement, dispute, security or legally required records may need to be retained.
      Active deliveries, shop ownership and staff access may need to be resolved to protect other users' records.
      Ask support to explain any retained data, its purpose and retention period, including backup handling.
      A disabled account is not confirmation that all personal data has been erased.</p>
    <p>Read our <Link href="/privacy-policy">Privacy policy</Link> for more information, or contact{' '}
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with questions about your request.</p>
  </ProsePage>;
}
