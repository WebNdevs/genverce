#!/usr/bin/env bash
# ═══════════════════════════════════════════
# GENVERCE — Setup Script
# ═══════════════════════════════════════════

echo "🚀 Setting up Genverce..."
echo ""

# 1. Start Docker services
echo "📦 Starting PostgreSQL and Redis..."
docker-compose up -d
echo "⏳ Waiting for services to be ready..."
sleep 5

# 2. Backend setup
echo ""
echo "🔧 Setting up backend..."
cd backend
cp .env.example .env
echo "   ✓ .env created (fill in your API keys)"
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
cd ..

# 3. Frontend setup
echo ""
echo "🎨 Setting up frontend..."
cd frontend
cp .env.example .env.local
echo "   ✓ .env.local created"
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit backend/.env with your API keys"
echo "   2. Edit frontend/.env.local with your Stripe publishable key"
echo "   3. Start backend:  cd backend && npm run start:dev"
echo "   4. Start frontend: cd frontend && npm run dev"
echo ""
echo "🌐 URLs:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:4000"
echo "   GraphQL:   http://localhost:4000/graphql"
echo "   Prisma:    npx prisma studio (in backend/)"
echo ""
echo "🔑 Default credentials:"
echo "   Admin:     admin@genverce.ai    / admin123456"
echo "   Reviewer:  reviewer@genverce.ai / reviewer123456"
echo "   Customer:  demo@genverce.ai     / customer123456"
