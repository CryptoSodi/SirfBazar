import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage } from '@/components/ProsePage';
import { LegalLinks } from '@/components/LegalLinks';
import { BUSINESS_NAME, SUPPORT_EMAIL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How Sirf Bazar handles information for customers, merchants and riders, and how to request account deletion.',
};

export default function Page() {
  return <ProsePage title="Privacy policy">
    <LegalLinks />
    <p>Last updated: <time dateTime="2026-10-13">13 October 2026</time></p>
    <p>{BUSINESS_NAME} operates SirfBazar, a local-commerce marketplace in Pakistan. This notice covers
      our website, SirfBazar customer app, SirfBazar Merchant app, SirfBazar Rider app and associated marketplace services.</p>
    <p>For privacy questions or requests, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      To request removal of your account and associated personal data, visit our <Link href="/account-deletion">account deletion page</Link>.</p>

    <h2>Information used by the service</h2>
    <ul>
      <li><strong>Account details:</strong> name, phone number, email, account identifiers and verification details.
        Google sign-in or linking provides a verified Google identifier and, where available, your name, email and profile image.
        We do not receive your Google password.</li>
      <li><strong>Shopping and delivery:</strong> basket contents, saved addresses, delivery instructions, orders,
        payment status, cash-on-delivery records, refunds, ratings and support messages.</li>
      <li><strong>Location:</strong> coordinates you select or provide through device permission, which may be precise,
        to find shops, check delivery coverage and support deliveries.</li>
      <li><strong>Merchant and rider details:</strong> shop profile, contact information, address, photos,
        products, stock, opening hours, delivery settings, staff or rider membership, vehicle details and settlement records,
        depending on the features you use.</li>
      <li><strong>Device and service information:</strong> session and guest identifiers, notification tokens,
        preferences and technical request information used to operate, secure and troubleshoot the service.</li>
    </ul>

    <h2>How information is used</h2>
    <p>We use information to authenticate accounts, maintain baskets, show relevant shops, process and track orders,
      coordinate delivery, provide notifications and support, manage merchant operations, prevent misuse and resolve disputes.
      Account access and information shown within the service depend on your role and shop membership.</p>

    <h2>Location, photos and notifications</h2>
    <p>You can decline device location permission and use manual delivery-location selection where available.
      Rider location sharing supports assigned active deliveries while the delivery screen is open and the app is in the foreground;
      it is not a promise of continuous background tracking. You can change permissions in your device or browser settings.</p>
    <p>Merchant photo features use photos you select or capture for your shop. Push notifications use a device registration token
      to deliver service updates. Camera, photo and notification access depend on the feature and permissions you choose.</p>

    <h2>Who receives information</h2>
    <p>Independent shops, their authorised staff and assigned riders receive information needed to prepare orders,
      make deliveries and handle related issues. Authorised SirfBazar support and operations personnel may access records
      to assist you, protect the service or resolve disputes.</p>
    <p>Technical providers process information for hosting, authentication, maps, messaging, notifications and support.
      These include Google services where used, Expo push services and our phone-verification delivery service.
      Their services may process information outside Pakistan. External services opened from the apps, such as a maps
      or email application, also operate under their own privacy notices.</p>
    <p>Information may also be disclosed when required by applicable law or necessary to address fraud,
      security incidents or legal claims. Sirf Bazar does not sell your personal information.</p>

    <h2>Browser and device storage</h2>
    <p>The website and apps use browser or device storage for sessions, guest baskets, delivery-location choices and preferences.
      Clearing local storage or uninstalling an app does not delete server-side account or order records.
      Google sign-in, maps and other external features may process technical information when you use them.</p>

    <h2>Retention and security</h2>
    <p>Account and transaction records are stored on our systems. Retention depends on the record, ongoing service needs,
      outstanding orders or balances, disputes and applicable legal or security requirements. Closing access to an account
      does not by itself erase all associated information.</p>
    <p>For a deletion request, support can explain which records can be removed, what needs to be retained and why,
      and the applicable processing and retention periods. We do not promise immediate erasure of transaction records or backup copies.</p>
    <p>We use access controls and other safeguards to protect information. No online service can guarantee absolute security.
      Do not share your password, sign-in verification code or account tokens with anyone, including support.</p>

    <h2 id="account-deletion">Your choices and deletion requests</h2>
    <p>You can update supported profile and address fields, change device permissions, sign out, and contact support
      to request access, correction or deletion of your information. Customers, merchants and riders can all request
      account and associated-data deletion by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    <p>See <Link href="/account-deletion">how to request account deletion</Link> for the information to include,
      verification steps and treatment of outstanding transactions. You do not need to reinstall an app to send a request.</p>

    <h2>Updates and contact</h2>
    <p>Changes to this notice will be posted here with an updated date. Contact {BUSINESS_NAME} at{' '}
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with questions about this notice or your information.</p>
  </ProsePage>;
}
