import type { Metadata } from 'next';
import { ProsePage } from '@/components/ProsePage';

export const metadata: Metadata = { title: 'FAQs' };

const FAQS: Array<[string, string]> = [
  ['Do I need an account to browse?', 'No. Browse shops, search products, and build your cart freely. You only log in (phone OTP or Google) when placing the order.'],
  ['Who delivers my order?', "The shop's own rider. Each shop on SirfBazar manages its own delivery team, which is why deliveries are fast and personal."],
  ['Can I order from multiple shops at once?', 'Yes. Your order is split per shop; each shop delivers separately and you track everything on one screen.'],
  ['What payment methods are supported?', 'Cash on delivery, JazzCash, EasyPaisa, and cards. Refunds go to your SirfBazar wallet instantly.'],
  ['How do refunds work?', 'If a shop rejects your prepaid order or something goes wrong, the amount is refunded automatically to your wallet. For item issues, raise a ticket from the order screen.'],
  ['What is the delivery code?', 'A 4-digit code shown in your order tracking after pickup. Share it with the rider on arrival — it confirms the delivery reached you.'],
  ['Is there a minimum order?', 'Each shop sets its own minimum. Small orders below the platform threshold may include a small order fee.'],
];

export default function Page() {
  return (
    <ProsePage title="Frequently asked questions">
      {FAQS.map(([q, a]) => (
        <details key={q} className="rounded-xl border border-stone-200 p-4">
          <summary className="cursor-pointer font-semibold">{q}</summary>
          <p className="mt-2">{a}</p>
        </details>
      ))}
    </ProsePage>
  );
}
