const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const inf = await p.influencer.findFirst({
    where: { name: 'Nova Sterling' },
    include: { packages: true, portfolio: true, reviews: true }
  });
  console.log('NOVA PACKAGES:', JSON.stringify(inf.packages, null, 2));
  console.log('NOVA PORTFOLIO:', JSON.stringify(inf.portfolio, null, 2));
  console.log('NOVA REVIEWS:', JSON.stringify(inf.reviews, null, 2));
}

run().catch(console.error).finally(() => p.$disconnect());
