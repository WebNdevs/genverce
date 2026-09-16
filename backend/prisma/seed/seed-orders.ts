/**
 * Seed script: Realistic dummy Order data for the Genverce platform.
 *
 * Run with:
 *   npm run seed:orders
 *
 * Prerequisites:
 *   - The main seed (prisma/seed/index.ts) must have been run first so that the
 *     demo customer (demo@genverce.ai) and influencers exist.
 *   - Each influencer must have at least one active InfluencerPackage row - this
 *     script creates the package rows automatically if they are missing.
 */

import { PrismaClient, OrderStatus, PackageType, DeliveryType, PaymentStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Package pricing mirror (must match order.service.ts)
// ---------------------------------------------------------------------------
const PACKAGE_META: Record<PackageType, { price: number; videos: number; name: string; description: string }> = {
  SINGLE:          { price: 9.99,   videos: 1,   name: "Single Video",      description: "1 AI-generated video tailored to your brand." },
  PACK_5:          { price: 39.99,  videos: 5,   name: "5-Video Pack",      description: "5 AI-generated videos at a discounted rate." },
  PACK_10:         { price: 70.00,  videos: 10,  name: "10-Video Pack",     description: "10 AI-generated videos best per-unit value." },
  MONTHLY_STARTER: { price: 199.00, videos: 30,  name: "Monthly Starter",   description: "30 videos per month great for growing brands." },
  MONTHLY_GROWTH:  { price: 499.00, videos: 100, name: "Monthly Growth",    description: "100 videos per month scale your content machine." },
  CUSTOM:          { price: 0,      videos: 0,   name: "Custom Package",    description: "Bespoke pricing agreed upon with the client." },
};

// ---------------------------------------------------------------------------
// Realistic project briefs keyed by influencer niche
// ---------------------------------------------------------------------------
const PROJECT_BRIEFS: Record<string, object[]> = {
  "Nova Sterling": [
    {
      productName: "CloudSync Pro",
      tagline: "The all-in-one SaaS workspace for remote teams",
      keyPoints: ["Seamless file sync", "Real-time collaboration", "Enterprise-grade security"],
      callToAction: "Start your free 14-day trial",
      tone: "Professional & authoritative",
      notes: "Emphasise the $0-setup and SOC-2 compliance badge.",
    },
    {
      productName: "FinTrack Analytics",
      tagline: "Turn your raw data into revenue insights",
      keyPoints: ["Live P&L dashboards", "AI-powered forecasting", "1-click Stripe integration"],
      callToAction: "Book a demo today",
      tone: "Data-driven & confident",
      notes: "Show the dashboard mockup at the 15-second mark.",
    },
  ],
  "Aria Bloom": [
    {
      productName: "GlowLab Serum",
      tagline: "Your skin is new best friend",
      keyPoints: ["Hyaluronic acid complex", "Clinically tested formula", "Cruelty-free & vegan"],
      callToAction: "Shop now 20% off first order",
      tone: "Warm & relatable",
      notes: "Reference Aria morning skincare routine in the intro.",
    },
    {
      productName: "ZenWell App",
      tagline: "Mindfulness made simple",
      keyPoints: ["Guided meditation library", "Sleep-tracking integration", "Community challenges"],
      callToAction: "Download free on iOS & Android",
      tone: "Calming & uplifting",
      notes: "End with a 5-second still of the sunrise meditation scene.",
    },
  ],
  "Kai Vortex": [
    {
      productName: "HyperX Pulse Pro Headset",
      tagline: "Hear every footstep. Win every round.",
      keyPoints: ["360 spatial audio", "45-hour battery", "Discord-certified mic"],
      callToAction: "Grab yours at hyperxgaming.com",
      tone: "High-energy & hype",
      notes: "Use the Apex Legends highlight reel from the shared drive.",
    },
  ],
  "Zara Nexus": [
    {
      productName: "Maison Eclat Summer Collection",
      tagline: "Wear the season",
      keyPoints: ["Limited-edition prints", "Sustainable linen fabric", "Free express shipping"],
      callToAction: "Explore the collection",
      tone: "Editorial & aspirational",
      notes: "Colour grade in warm golden tones to match the SS26 palette.",
    },
    {
      productName: "VOSS Luxury Tote",
      tagline: "Everyday luxury, redefined",
      keyPoints: ["Full-grain Italian leather", "Lifetime craftsmanship warranty", "Personalised monogramming"],
      callToAction: "Personalise yours at voss.com",
      tone: "Sophisticated & timeless",
      notes: "Feature the unboxing ritual and the signature dust-bag reveal.",
    },
  ],
  "Atlas Prime": [
    {
      productName: "Nexora ERP Suite",
      tagline: "One platform. Every process.",
      keyPoints: ["End-to-end supply-chain visibility", "AI-driven demand planning", "ISO-27001 certified"],
      callToAction: "Request an enterprise demo",
      tone: "Corporate & authoritative",
      notes: "Open with the ROI case-study headline: 37 percent cost reduction in Year 1.",
    },
  ],
  "Luna Spark": [
    {
      productName: "Primal Fuel Protein",
      tagline: "Fuel your gains, naturally",
      keyPoints: ["25g protein per scoop", "No artificial sweeteners", "NSF Certified for Sport"],
      callToAction: "Use code LUNA20 for 20% off",
      tone: "Motivational & energetic",
      notes: "Feature the post-workout shaker shot in the first 5 seconds.",
    },
    {
      productName: "FitForm App",
      tagline: "AI personal training in your pocket",
      keyPoints: ["Custom workout plans", "Real-time form correction", "Progress analytics"],
      callToAction: "Start training free for 30 days",
      tone: "Energetic & empowering",
      notes: "Show the split-screen comparison: incorrect vs correct squat form.",
    },
  ],
  "Rex Cipher": [
    {
      productName: "ChainVault DeFi Wallet",
      tagline: "Your keys. Your crypto.",
      keyPoints: ["Hardware-level security", "Multi-chain support (ETH, SOL, BTC)", "Built-in DEX swap"],
      callToAction: "Download ChainVault 100% non-custodial",
      tone: "Technical & community-focused",
      notes: "Clarify that this is not financial advice in the CTA overlay.",
    },
  ],
  "Mira Sol": [
    {
      productName: "Horizon Hotels Bali Retreat",
      tagline: "Wake up to paradise",
      keyPoints: ["Private villa pool", "Complimentary spa credit", "Curated local experiences"],
      callToAction: "Book direct and save 15%",
      tone: "Cinematic & aspirational",
      notes: "Use the sunrise drone footage from Ubud shared in Dropbox.",
    },
    {
      productName: "TasteAtlas Food Tours",
      tagline: "Eat like a local, everywhere",
      keyPoints: ["Expert local guides", "Hidden street-food gems", "Small groups max 8 people"],
      callToAction: "Book your next culinary adventure",
      tone: "Adventurous & warm",
      notes: "End on the night-market montage; use upbeat acoustic track.",
    },
  ],
};

interface OrderScenario {
  influencerName: string;
  package: PackageType;
  deliveryType: DeliveryType;
  status: OrderStatus;
  briefIndex: number;
  daysAgo: number;
  videosDelivered?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  reviewNotes?: string;
  review?: { rating: number; comment: string };
  paymentStatus?: PaymentStatus;
  paymentStripeId?: string;
}

const ORDER_SCENARIOS: OrderScenario[] = [
  // DELIVERED with review
  {
    influencerName: "Nova Sterling",
    package: "PACK_5",
    deliveryType: "QUALITY_CHECKED",
    status: "DELIVERED",
    briefIndex: 0,
    daysAgo: 45,
    videosDelivered: 5,
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnailUrl: "https://placehold.co/480x270/1a1a2e/7c3aed?text=Nova+Sterling",
    paymentStatus: "SUCCEEDED",
    paymentStripeId: "pi_3OaB1KLkdIwHu0vQ0y1FBnXa",
    review: {
      rating: 5,
      comment: "Absolutely blown away. Nova nailed our SaaS tone perfectly the videos converted better than our entire last quarter of ads.",
    },
  },
  {
    influencerName: "Aria Bloom",
    package: "SINGLE",
    deliveryType: "QUALITY_CHECKED",
    status: "DELIVERED",
    briefIndex: 0,
    daysAgo: 32,
    videosDelivered: 1,
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    thumbnailUrl: "https://placehold.co/480x270/1a1a2e/7c3aed?text=Aria+Bloom",
    paymentStatus: "SUCCEEDED",
    paymentStripeId: "pi_3OcZk2LkdIwHu0vQ0x9MEcDe",
    review: {
      rating: 5,
      comment: "Aria warm delivery felt genuinely authentic. Our DTC skincare brand saw a 23% CTR spike in the first week.",
    },
  },
  {
    influencerName: "Luna Spark",
    package: "PACK_10",
    deliveryType: "QUALITY_CHECKED",
    status: "DELIVERED",
    briefIndex: 0,
    daysAgo: 28,
    videosDelivered: 10,
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnailUrl: "https://placehold.co/480x270/1a1a2e/7c3aed?text=Luna+Spark",
    paymentStatus: "SUCCEEDED",
    paymentStripeId: "pi_3OdRp7LkdIwHu0vQ1z3NqKfB",
    review: {
      rating: 4,
      comment: "Great energy and on-brand messaging throughout. Slight tweak needed on the CTA wording but the team sorted it fast.",
    },
  },
  // DELIVERED without review
  {
    influencerName: "Zara Nexus",
    package: "PACK_5",
    deliveryType: "QUALITY_CHECKED",
    status: "DELIVERED",
    briefIndex: 1,
    daysAgo: 14,
    videosDelivered: 5,
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    thumbnailUrl: "https://placehold.co/480x270/1a1a2e/7c3aed?text=Zara+Nexus",
    paymentStatus: "SUCCEEDED",
    paymentStripeId: "pi_3OeWq9LkdIwHu0vQ2a4OpLgC",
  },
  {
    influencerName: "Mira Sol",
    package: "SINGLE",
    deliveryType: "INSTANT",
    status: "DELIVERED",
    briefIndex: 0,
    daysAgo: 10,
    videosDelivered: 1,
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
    thumbnailUrl: "https://placehold.co/480x270/1a1a2e/7c3aed?text=Mira+Sol",
    paymentStatus: "SUCCEEDED",
    paymentStripeId: "pi_3OfXr0LkdIwHu0vQ3b5PqMhD",
  },
  // APPROVED
  {
    influencerName: "Rex Cipher",
    package: "SINGLE",
    deliveryType: "QUALITY_CHECKED",
    status: "APPROVED",
    briefIndex: 0,
    daysAgo: 5,
    videosDelivered: 0,
    paymentStatus: "SUCCEEDED",
    paymentStripeId: "pi_3OgYs1LkdIwHu0vQ4c6QrNiE",
    reviewNotes: "Looks great approved for delivery.",
  },
  // PENDING_REVIEW
  {
    influencerName: "Nova Sterling",
    package: "PACK_5",
    deliveryType: "QUALITY_CHECKED",
    status: "PENDING_REVIEW",
    briefIndex: 1,
    daysAgo: 4,
    videosDelivered: 3,
    paymentStatus: "SUCCEEDED",
    paymentStripeId: "pi_3OhZt2LkdIwHu0vQ5d7RsOjF",
  },
  {
    influencerName: "Atlas Prime",
    package: "PACK_5",
    deliveryType: "QUALITY_CHECKED",
    status: "PENDING_REVIEW",
    briefIndex: 0,
    daysAgo: 3,
    videosDelivered: 2,
    paymentStatus: "SUCCEEDED",
    paymentStripeId: "pi_3OiAu3LkdIwHu0vQ6e8StPkG",
  },
  // GENERATING
  {
    influencerName: "Kai Vortex",
    package: "PACK_10",
    deliveryType: "QUALITY_CHECKED",
    status: "GENERATING",
    briefIndex: 0,
    daysAgo: 2,
    videosDelivered: 4,
    paymentStatus: "SUCCEEDED",
    paymentStripeId: "pi_3OjBv4LkdIwHu0vQ7f9TuQlH",
  },
  {
    influencerName: "Luna Spark",
    package: "MONTHLY_STARTER",
    deliveryType: "QUALITY_CHECKED",
    status: "GENERATING",
    briefIndex: 1,
    daysAgo: 1,
    videosDelivered: 8,
    paymentStatus: "SUCCEEDED",
    paymentStripeId: "pi_3OkCw5LkdIwHu0vQ8g0UvRmI",
  },
  // PAID
  {
    influencerName: "Mira Sol",
    package: "PACK_5",
    deliveryType: "INSTANT",
    status: "PAID",
    briefIndex: 1,
    daysAgo: 1,
    videosDelivered: 0,
    paymentStatus: "SUCCEEDED",
    paymentStripeId: "pi_3OlDx6LkdIwHu0vQ9h1VwSnJ",
  },
  // PENDING_PAYMENT
  {
    influencerName: "Aria Bloom",
    package: "MONTHLY_GROWTH",
    deliveryType: "QUALITY_CHECKED",
    status: "PENDING_PAYMENT",
    briefIndex: 1,
    daysAgo: 0,
    videosDelivered: 0,
    paymentStatus: "PENDING",
  },
  // CANCELLED
  {
    influencerName: "Zara Nexus",
    package: "SINGLE",
    deliveryType: "QUALITY_CHECKED",
    status: "CANCELLED",
    briefIndex: 0,
    daysAgo: 60,
    videosDelivered: 0,
    paymentStatus: "FAILED",
  },
  // REFUNDED
  {
    influencerName: "Rex Cipher",
    package: "PACK_5",
    deliveryType: "QUALITY_CHECKED",
    status: "REFUNDED",
    briefIndex: 0,
    daysAgo: 50,
    videosDelivered: 0,
    paymentStatus: "REFUNDED",
    paymentStripeId: "pi_3OmEy7LkdIwHu0vQah2XxToK",
  },
];

function daysAgoDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  console.log("Seeding order data...\n");

  const customer = await prisma.user.findUnique({ where: { email: "demo@genverce.ai" } });
  if (!customer) {
    throw new Error(
      "Demo customer (demo@genverce.ai) not found. Run the main seed first:\n   npm run prisma:seed",
    );
  }
  console.log(`Found demo customer: ${customer.email} (${customer.id})`);

  const influencers = await prisma.influencer.findMany();
  const influencerMap = new Map(influencers.map((i) => [i.name, i]));
  console.log(`Found ${influencers.length} influencer(s)\n`);

  let created = 0;
  let skipped = 0;

  for (const scenario of ORDER_SCENARIOS) {
    const influencer = influencerMap.get(scenario.influencerName);
    if (!influencer) {
      console.warn(`Influencer "${scenario.influencerName}" not found skipping.`);
      skipped++;
      continue;
    }

    const pkgMeta = PACKAGE_META[scenario.package];

    // Ensure InfluencerPackage exists
    const existingPkg = await prisma.influencerPackage.findFirst({
      where: { influencerId: influencer.id, type: scenario.package },
    });
    if (!existingPkg) {
      await prisma.influencerPackage.create({
        data: {
          influencerId: influencer.id,
          type: scenario.package,
          name: pkgMeta.name,
          price: pkgMeta.price,
          videoCount: pkgMeta.videos,
          description: pkgMeta.description,
          isActive: true,
          sortOrder: 0,
        },
      });
    }

    const briefs = PROJECT_BRIEFS[scenario.influencerName] ?? [{ notes: "Standard brand promotion campaign." }];
    const brief = briefs[scenario.briefIndex % briefs.length];

    const createdAt = daysAgoDate(scenario.daysAgo);
    const deliveredAt =
      scenario.status === "DELIVERED" ? daysAgoDate(Math.max(0, scenario.daysAgo - 3)) : undefined;

    const orderData: any = {
      customerId: customer.id,
      influencerId: influencer.id,
      projectBrief: brief,
      package: scenario.package,
      deliveryType: scenario.deliveryType,
      status: scenario.status,
      price: pkgMeta.price,
      videosOrdered: pkgMeta.videos || 1,
      videosDelivered: scenario.videosDelivered ?? 0,
      aiDisclosure: true,
      videoUrl: scenario.videoUrl ?? null,
      thumbnailUrl: scenario.thumbnailUrl ?? null,
      reviewNotes: scenario.reviewNotes ?? null,
      createdAt,
      updatedAt: new Date(),
      ...(deliveredAt ? { deliveredAt } : {}),
    };

    const order = await prisma.order.create({ data: orderData });

    if (scenario.paymentStatus) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          customerId: customer.id,
          stripePaymentId: scenario.paymentStripeId ? `${scenario.paymentStripeId}_${Date.now()}_${Math.floor(Math.random() * 1000)}` : null,
          amount: pkgMeta.price,
          currency: "usd",
          status: scenario.paymentStatus,
          refundedAmount: scenario.paymentStatus === "REFUNDED" ? pkgMeta.price : 0,
          createdAt,
          updatedAt: new Date(),
        },
      });
    }

    if (scenario.review) {
      await prisma.review.create({
        data: {
          orderId: order.id,
          customerId: customer.id,
          influencerId: influencer.id,
          rating: scenario.review.rating,
          comment: scenario.review.comment,
          createdAt: daysAgoDate(Math.max(0, scenario.daysAgo - 5)),
        },
      });
    }

    console.log(
      `  [${scenario.status.padEnd(15)}]  ${scenario.influencerName.padEnd(15)} ${scenario.package} (#${order.id.slice(0, 8)})`,
    );
    created++;
  }

  console.log(`\nDone! Created ${created} order(s), skipped ${skipped}.`);
  console.log(`\nLog in as the demo customer to view orders:`);
  console.log(`  Email:    demo@genverce.ai`);
  console.log(`  Password: customer123456`);
  console.log(`  URL:      http://localhost:3000/dashboard/orders`);
}

main()
  .catch((e) => {
    console.error("\nOrder seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
