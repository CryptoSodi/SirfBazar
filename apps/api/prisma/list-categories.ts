import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const cats = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  });
  for (const c of cats) {
    console.log(`${c._count.products.toString().padStart(4)}  ${c.iconUrl ? 'ICON' : '----'}  ${c.slug.padEnd(28)}  ${c.name}`);
  }
  console.log(`\n${cats.length} categories total`);
  await prisma.$disconnect();
})();
