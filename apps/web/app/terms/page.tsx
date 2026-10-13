import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage } from '@/components/ProsePage';
import { LegalLinks } from '@/components/LegalLinks';
import { BUSINESS_NAME, SUPPORT_EMAIL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Terms and conditions', description: 'Terms for using the SirfBazar marketplace, merchant and rider services.' };

export default function Page() {
  return <ProsePage title="Terms and conditions">
    <LegalLinks />
    <p>Last updated: <time dateTime="2026-10-13">13 October 2026</time></p>
    <p>These terms describe the use of the SirfBazar website, customer, merchant and rider apps, and associated services
      operated by {BUSINESS_NAME}. Please read them with our <Link href="/privacy-policy">Privacy policy</Link> before using the service.</p>

    <h2>Our marketplace</h2>
    <p>SirfBazar connects customers with independent local shops in Pakistan. Shops sell their products, maintain their
      inventory and arrange delivery through their own riders. SirfBazar provides the marketplace software.
      Product selection, serviceability, stock, opening hours and delivery charges depend on the participating shop.</p>

    <h2>Accounts and authorised access</h2>
    <p>Provide accurate contact and delivery details and keep access to your account secure. Use only accounts and shop
      roles you are authorised to access. Merchant and rider access may require approval. Guest browsing is available,
      but account features and checkout may require sign-in. Never share a sign-in verification code or password.</p>

    <h2>Orders, changes and delivery</h2>
    <ul>
      <li>Review the products, quantities, delivery address and total before placing an order. Submission does not
        guarantee acceptance: shops may accept or reject according to availability and serviceability.</li>
      <li>Orders from different shops may be prepared and delivered separately. Delivery estimates are estimates, not guarantees.</li>
      <li>Where an order-revision feature is offered, a proposed reduction or removal requires your approval before it takes effect.
        Review the revised quantities and total; silence is not approval.</li>
      <li>Use the cancellation options available for your order status or contact support. A deletion request does not automatically cancel an order.</li>
      <li>Where a delivery confirmation code is used, provide it to the assigned rider only when you receive the delivery.
        This is separate from a sign-in code.</li>
    </ul>

    <h2>Prices, payments and problems with an order</h2>
    <p>Prices are shown in Pakistani rupees (PKR). Review the item prices, discounts and any delivery, service or other
      charges shown at checkout. Use only the payment methods actually offered for your order; an unavailable method
      must not be assumed to be supported.</p>
    <p>Report missing, incorrect or damaged items through the order support options or email{' '}
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the order reference. Cancellation and refund handling
      depends on the order status, payment collected and the issue under review. Support will confirm the applicable outcome
      and refund route. These terms do not remove rights you have under applicable consumer law.</p>

    <h2>Merchant, staff and rider responsibilities</h2>
    <p>Merchants are responsible for accurate listings, prices, stock, lawful products, shop permissions and their delivery team.
      Staff and riders must use customer information only for authorised shop work and delivery, keep it confidential,
      and record fulfilment steps accurately. The service does not guarantee order volumes, assignments or earnings.</p>

    <h2>POS trials and additional features</h2>
    <p>Where a POS trial is offered and selected, the account shows its activation and expiry details. A trial does not
      authorise automatic charging. After expiry, POS sales may be disabled while existing records remain available for
      viewing. Any paid renewal requires separately communicated commercial terms; declining POS does not by itself
      remove core marketplace access.</p>

    <h2>Acceptable use</h2>
    <p>Do not submit fraudulent orders, abuse promotions, access another person's records, upload unlawful material,
      harass customers or workers, or interfere with the service. Access may be restricted to protect users, investigate
      misuse or meet legal requirements. Contact support if you believe a restriction is mistaken.</p>

    <h2>Privacy and account closure</h2>
    <p>Our <Link href="/privacy-policy">Privacy policy</Link> explains information handling. You can request account and
      associated-data deletion through <Link href="/account-deletion">our deletion-request page</Link> or by emailing{' '}
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Outstanding orders, settlements, disputes and legally required
      records may need separate handling; submitting a request does not mean deletion is already complete.</p>

    <h2>Service changes and contact</h2>
    <p>Features and availability may change, and interruptions can occur. Updated terms will be posted on this page with
      a revised date. For questions or disputes, contact {BUSINESS_NAME} at{' '}
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Nothing here limits rights or responsibilities that cannot
      lawfully be excluded.</p>
  </ProsePage>;
}
