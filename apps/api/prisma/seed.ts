/**
 * SirfBazar development seed: Lahore-based demo marketplace.
 * Idempotent — safe to run repeatedly (upserts by slug/phone/email).
 *
 * Demo logins (all OTP logins accept master code 123456 in dev):
 *   Admin:            admin@sirfbazar.pk / Admin@12345
 *   Merchant owners:  +923010000001..4
 *   Riders:           +923020000001..4
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PKR = (rupees: number) => Math.round(rupees * 100); // paisa

async function main() {
  console.log('Seeding SirfBazar…');

  // ── Admin users ─────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@12345', 10);
  await prisma.user.upsert({
    where: { email: 'admin@sirfbazar.pk' },
    update: {},
    create: {
      email: 'admin@sirfbazar.pk',
      fullName: 'SirfBazar Admin',
      passwordHash: adminHash,
      role: 'SUPER_ADMIN',
      isEmailVerified: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'finance@sirfbazar.pk' },
    update: {},
    create: {
      email: 'finance@sirfbazar.pk',
      fullName: 'Finance Admin',
      passwordHash: adminHash,
      role: 'FINANCE_ADMIN',
      isEmailVerified: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'support@sirfbazar.pk' },
    update: {},
    create: {
      email: 'support@sirfbazar.pk',
      fullName: 'Support Agent',
      passwordHash: adminHash,
      role: 'SUPPORT_AGENT',
      isEmailVerified: true,
    },
  });

  // ── Categories ──────────────────────────────────────────────────────────
  const categoryDefs = [
    { name: 'Groceries', slug: 'groceries', icon: '🛒' },
    { name: 'Milk, Eggs & Bread', slug: 'milk-eggs-bread', icon: '🥛' },
    { name: 'Fruits & Vegetables', slug: 'fruits-vegetables', icon: '🥕' },
    { name: 'Snacks & Drinks', slug: 'snacks-drinks', icon: '🥤' },
    { name: 'Bakery Items', slug: 'bakery', icon: '🥐' },
    { name: 'Pharmacy Essentials', slug: 'pharmacy', icon: '💊' },
    { name: 'Personal Care', slug: 'personal-care', icon: '🧴' },
    { name: 'Baby Care', slug: 'baby-care', icon: '🍼' },
    { name: 'Household Items', slug: 'household', icon: '🧹' },
    { name: 'Stationery', slug: 'stationery', icon: '✏️' },
    { name: 'Mobile Accessories', slug: 'mobile-accessories', icon: '🔌' },
    { name: 'Pet Food', slug: 'pet-food', icon: '🐾' },
  ];
  const categories: Record<string, string> = {};
  for (const [i, def] of categoryDefs.entries()) {
    const cat = await prisma.category.upsert({
      where: { slug: def.slug },
      update: { sortOrder: i },
      create: { name: def.name, slug: def.slug, iconUrl: def.icon, sortOrder: i },
    });
    categories[def.slug] = cat.id;
  }

  // ── Global product catalog ──────────────────────────────────────────────
  type P = { name: string; cat: string; brand?: string; unit: string; size?: string; img?: string };
  const productDefs: P[] = [
    { name: 'Basmati Rice', cat: 'groceries', brand: 'Falak', unit: 'kg', size: '5 kg' },
    { name: 'Wheat Flour (Atta)', cat: 'groceries', brand: 'Sunridge', unit: 'kg', size: '10 kg' },
    { name: 'Cooking Oil', cat: 'groceries', brand: 'Dalda', unit: 'litre', size: '5 L' },
    { name: 'Sugar', cat: 'groceries', unit: 'kg', size: '1 kg' },
    { name: 'Red Lentils (Masoor Daal)', cat: 'groceries', unit: 'kg', size: '1 kg' },
    { name: 'Black Tea', cat: 'groceries', brand: 'Tapal Danedar', unit: 'pack', size: '950 g' },
    { name: 'Iodized Salt', cat: 'groceries', brand: 'National', unit: 'pack', size: '800 g' },
    { name: 'Fresh Milk', cat: 'milk-eggs-bread', brand: 'Olpers', unit: 'litre', size: '1 L' },
    { name: 'Farm Eggs', cat: 'milk-eggs-bread', unit: 'dozen', size: '12 pcs' },
    { name: 'White Bread', cat: 'milk-eggs-bread', brand: 'Dawn', unit: 'pack', size: 'Large' },
    { name: 'Butter', cat: 'milk-eggs-bread', brand: 'Nurpur', unit: 'pack', size: '200 g' },
    { name: 'Yogurt', cat: 'milk-eggs-bread', brand: 'Nestle', unit: 'pack', size: '400 g' },
    { name: 'Bananas', cat: 'fruits-vegetables', unit: 'dozen' },
    { name: 'Apples', cat: 'fruits-vegetables', unit: 'kg' },
    { name: 'Potatoes', cat: 'fruits-vegetables', unit: 'kg' },
    { name: 'Onions', cat: 'fruits-vegetables', unit: 'kg' },
    { name: 'Tomatoes', cat: 'fruits-vegetables', unit: 'kg' },
    { name: 'Lemons', cat: 'fruits-vegetables', unit: 'kg', size: '500 g' },
    { name: 'Potato Chips', cat: 'snacks-drinks', brand: 'Lays', unit: 'pack', size: 'Family' },
    { name: 'Cola Drink', cat: 'snacks-drinks', brand: 'Pepsi', unit: 'litre', size: '1.5 L' },
    { name: 'Mineral Water', cat: 'snacks-drinks', brand: 'Nestle', unit: 'litre', size: '1.5 L' },
    { name: 'Chocolate Biscuits', cat: 'snacks-drinks', brand: 'Sooper', unit: 'pack' },
    { name: 'Mango Juice', cat: 'snacks-drinks', brand: 'Shezan', unit: 'litre', size: '1 L' },
    { name: 'Fresh Naan', cat: 'bakery', unit: 'piece' },
    { name: 'Chicken Patties', cat: 'bakery', unit: 'piece' },
    { name: 'Plain Cake', cat: 'bakery', unit: 'pack', size: '500 g' },
    { name: 'Zeera Biscuits', cat: 'bakery', unit: 'pack', size: '250 g' },
    { name: 'Paracetamol Tablets', cat: 'pharmacy', brand: 'Panadol', unit: 'pack', size: '20 tabs' },
    { name: 'Hand Sanitizer', cat: 'pharmacy', brand: 'Dettol', unit: 'piece', size: '250 ml' },
    { name: 'Adhesive Bandages', cat: 'pharmacy', brand: 'Band-Aid', unit: 'pack', size: '20 pcs' },
    { name: 'ORS Sachets', cat: 'pharmacy', unit: 'pack', size: '10 pcs' },
    { name: 'Shampoo', cat: 'personal-care', brand: 'Sunsilk', unit: 'piece', size: '360 ml' },
    { name: 'Toothpaste', cat: 'personal-care', brand: 'Colgate', unit: 'piece', size: '150 g' },
    { name: 'Beauty Soap', cat: 'personal-care', brand: 'Lux', unit: 'piece', size: '3-pack' },
    { name: 'Baby Diapers', cat: 'baby-care', brand: 'Pampers', unit: 'pack', size: 'M, 32 pcs' },
    { name: 'Baby Wipes', cat: 'baby-care', brand: 'Johnsons', unit: 'pack', size: '72 pcs' },
    { name: 'Dishwashing Liquid', cat: 'household', brand: 'Lemon Max', unit: 'piece', size: '500 ml' },
    { name: 'Laundry Detergent', cat: 'household', brand: 'Surf Excel', unit: 'kg', size: '1 kg' },
    { name: 'Garbage Bags', cat: 'household', unit: 'pack', size: '30 pcs' },
    { name: 'Ballpoint Pens', cat: 'stationery', brand: 'Dollar', unit: 'pack', size: '10 pcs' },
    { name: 'Spiral Notebook', cat: 'stationery', unit: 'piece', size: '200 pages' },
    { name: 'USB-C Charging Cable', cat: 'mobile-accessories', unit: 'piece', size: '1 m' },
    { name: 'Phone Power Bank', cat: 'mobile-accessories', unit: 'piece', size: '10000 mAh' },
    { name: 'Adult Cat Food', cat: 'pet-food', brand: 'Whiskas', unit: 'pack', size: '1.2 kg' },
  ];
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const products: Record<string, string> = {};
  for (const def of productDefs) {
    const slug = slugify(def.name);
    const product = await prisma.product.upsert({
      where: { slug },
      update: {},
      create: {
        name: def.name,
        slug,
        brand: def.brand ?? null,
        categoryId: categories[def.cat],
        unit: def.unit,
        size: def.size ?? null,
        approvalStatus: 'APPROVED',
        description: `${def.name}${def.brand ? ` by ${def.brand}` : ''} — available from local shops near you.`,
      },
    });
    products[slug] = product.id;
  }

  // ── Merchants (Gulberg, Lahore cluster) ─────────────────────────────────
  const merchantDefs = [
    {
      phone: '+923010000001', owner: 'Imran Akhtar', shop: 'Madina General Store',
      type: 'GROCERY', lat: 31.5204, lng: 74.3587, area: 'Gulberg III',
      prep: 15, minOrder: PKR(200),
      stock: ['basmati-rice', 'wheat-flour-atta', 'cooking-oil', 'sugar', 'red-lentils-masoor-daal', 'black-tea', 'iodized-salt', 'fresh-milk', 'farm-eggs', 'white-bread', 'potato-chips', 'cola-drink', 'mineral-water', 'chocolate-biscuits', 'mango-juice', 'dishwashing-liquid', 'laundry-detergent', 'garbage-bags', 'shampoo', 'toothpaste', 'beauty-soap'],
    },
    {
      phone: '+923010000002', owner: 'Saima Tariq', shop: 'Fresh Basket Fruits & Veggies',
      type: 'FRUITS_VEGETABLES', lat: 31.5165, lng: 74.3520, area: 'Gulberg II',
      prep: 10, minOrder: PKR(150),
      stock: ['bananas', 'apples', 'potatoes', 'onions', 'tomatoes', 'lemons', 'farm-eggs', 'fresh-milk'],
    },
    {
      phone: '+923010000003', owner: 'Bilal Sheikh', shop: 'Sheikh Bakers & Sweets',
      type: 'BAKERY', lat: 31.5230, 'lng': 74.3610, area: 'Liberty Market',
      prep: 20, minOrder: PKR(100),
      stock: ['fresh-naan', 'chicken-patties', 'plain-cake', 'zeera-biscuits', 'white-bread', 'butter', 'yogurt'],
    },
    {
      phone: '+923010000004', owner: 'Dr. Nadia Khan', shop: 'CarePlus Pharmacy',
      type: 'PHARMACY', lat: 31.5125, lng: 74.3450, area: 'Main Boulevard',
      prep: 10, minOrder: PKR(0),
      stock: ['paracetamol-tablets', 'hand-sanitizer', 'adhesive-bandages', 'ors-sachets', 'baby-diapers', 'baby-wipes', 'shampoo', 'toothpaste'],
    },
  ] as any[];

  const priceTable: Record<string, number> = {
    'basmati-rice': PKR(2350), 'wheat-flour-atta': PKR(1450), 'cooking-oil': PKR(2890),
    'sugar': PKR(165), 'red-lentils-masoor-daal': PKR(310), 'black-tea': PKR(1250),
    'iodized-salt': PKR(60), 'fresh-milk': PKR(225), 'farm-eggs': PKR(330),
    'white-bread': PKR(160), 'butter': PKR(540), 'yogurt': PKR(190),
    'bananas': PKR(180), 'apples': PKR(290), 'potatoes': PKR(95), 'onions': PKR(110),
    'tomatoes': PKR(130), 'lemons': PKR(150), 'potato-chips': PKR(150),
    'cola-drink': PKR(180), 'mineral-water': PKR(110), 'chocolate-biscuits': PKR(90),
    'mango-juice': PKR(280), 'fresh-naan': PKR(30), 'chicken-patties': PKR(120),
    'plain-cake': PKR(450), 'zeera-biscuits': PKR(220), 'paracetamol-tablets': PKR(95),
    'hand-sanitizer': PKR(350), 'adhesive-bandages': PKR(250), 'ors-sachets': PKR(200),
    'shampoo': PKR(650), 'toothpaste': PKR(280), 'beauty-soap': PKR(390),
    'baby-diapers': PKR(1550), 'baby-wipes': PKR(480), 'dishwashing-liquid': PKR(320),
    'laundry-detergent': PKR(600), 'garbage-bags': PKR(260), 'ballpoint-pens': PKR(200),
    'spiral-notebook': PKR(350), 'usb-c-charging-cable': PKR(450), 'phone-power-bank': PKR(3500),
    'adult-cat-food': PKR(1450),
  };

  const riderDefs = [
    { phone: '+923020000001', name: 'Aslam Pervaiz', merchantIdx: 0 },
    { phone: '+923020000002', name: 'Waqas Ali', merchantIdx: 0 },
    { phone: '+923020000003', name: 'Junaid Iqbal', merchantIdx: 1 },
    { phone: '+923020000004', name: 'Shahbaz Ahmed', merchantIdx: 2 },
    { phone: '+923020000005', name: 'Rashid Mehmood', merchantIdx: 3 },
  ];

  const merchantIds: string[] = [];
  for (const def of merchantDefs) {
    const ownerUser = await prisma.user.upsert({
      where: { phoneNumber: def.phone },
      update: { role: 'MERCHANT_OWNER' },
      create: {
        phoneNumber: def.phone,
        fullName: def.owner,
        role: 'MERCHANT_OWNER',
        isPhoneVerified: true,
      },
    });
    const merchant = await prisma.merchant.upsert({
      where: { userId: ownerUser.id },
      update: { approvalStatus: 'APPROVED', isOnline: true, isOpen: true },
      create: {
        userId: ownerUser.id,
        shopName: def.shop,
        shopType: def.type,
        description: `${def.shop} — your trusted local ${def.type.toLowerCase().replace(/_/g, ' ')} shop in ${def.area}, Lahore.`,
        phoneNumber: def.phone,
        address: `${def.area}, Lahore`,
        city: 'Lahore',
        area: def.area,
        latitude: def.lat,
        longitude: def.lng,
        serviceRadiusKm: 8,
        openingTime: '08:00',
        closingTime: '23:00',
        isOnline: true,
        isOpen: true,
        approvalStatus: 'APPROVED',
        commissionType: 'PERCENTAGE',
        commissionValue: 10,
        minimumOrderValuePaisa: def.minOrder,
        averagePreparationMinutes: def.prep,
      },
    });
    merchantIds.push(merchant.id);

    for (const slug of def.stock) {
      const productId = products[slug];
      if (!productId) continue;
      const base = priceTable[slug] ?? PKR(200);
      // Small price variation per shop; occasional discount.
      const variation = 1 + ((merchant.id.charCodeAt(3) + slug.length) % 7) / 100;
      const price = Math.round((base * variation) / 100) * 100;
      const hasDiscount = slug.length % 3 === 0;
      await prisma.merchantProduct.upsert({
        where: { merchantId_productId: { merchantId: merchant.id, productId } },
        update: { isAvailable: true, stockQuantity: { set: 60 } },
        create: {
          merchantId: merchant.id,
          productId,
          pricePaisa: price,
          discountPricePaisa: hasDiscount ? Math.round((price * 0.9) / 100) * 100 : null,
          stockQuantity: 60,
          lowStockThreshold: 5,
          isAvailable: true,
        },
      });
    }
  }

  for (const def of riderDefs) {
    const riderUser = await prisma.user.upsert({
      where: { phoneNumber: def.phone },
      update: {},
      create: {
        phoneNumber: def.phone,
        fullName: def.name,
        role: 'RIDER',
        isPhoneVerified: true,
      },
    });
    await prisma.rider.upsert({
      where: { userId: riderUser.id },
      update: { isActive: true, approvalStatus: 'APPROVED' },
      create: {
        merchantId: merchantIds[def.merchantIdx],
        userId: riderUser.id,
        fullName: def.name,
        phoneNumber: def.phone,
        vehicleType: 'MOTORBIKE',
        vehicleNumber: `LEB-${1000 + def.merchantIdx * 111}`,
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    });
  }

  // ── Coupons ─────────────────────────────────────────────────────────────
  const year = new Date();
  const nextYear = new Date(year.getTime() + 365 * 86400_000);
  const coupons = [
    {
      code: 'WELCOME10', title: '10% off your first order', discountType: 'PERCENTAGE',
      discountValue: 10, maxDiscountAmountPaisa: PKR(150), minimumOrderAmountPaisa: PKR(300),
      newUsersOnly: true, usageLimitPerCustomer: 1,
    },
    {
      code: 'SAVE50', title: 'Rs 50 off orders above Rs 500', discountType: 'FIXED',
      discountValue: PKR(50), minimumOrderAmountPaisa: PKR(500), usageLimitPerCustomer: 10,
    },
    {
      code: 'FREESHIP', title: 'Free delivery, no minimum', discountType: 'FREE_DELIVERY',
      discountValue: 0, minimumOrderAmountPaisa: 0, usageLimitPerCustomer: 5,
    },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { isActive: true, endDate: nextYear },
      create: {
        ...c,
        description: c.title,
        startDate: new Date(Date.now() - 86400_000),
        endDate: nextYear,
        isActive: true,
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    merchants: await prisma.merchant.count(),
    merchantProducts: await prisma.merchantProduct.count(),
    riders: await prisma.rider.count(),
    coupons: await prisma.coupon.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
