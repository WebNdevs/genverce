# Genverce — AI Influencer Marketplace

Genverce is a state-of-the-art marketplace for AI-powered influencers, matching brands and agencies with virtual creators. The platform features instant messaging, custom media creation, order pipelines, quality checks, automated billing, and vector-based long-term agent memories.

## Project Structure

```
├── backend/            # NestJS API Server (GraphQL & Websockets)
├── frontend/           # Next.js Frontend Client (React & Tailwind CSS)
├── docker-compose.yml  # Local developer infrastructure (PostgreSQL & Redis templates)
├── setup.sh            # Setup scripting guide
└── README.md           # Project Documentation
```

## Technologies

- **Frontend**: Next.js 14, React 18, Apollo Client, framer-motion, TailwindCSS, Zustand
- **Backend**: NestJS 10, Apollo GraphQL, Prisma ORM, Socket.io, ioredis, Stripe SDK, Pinecone Vector DB, Anthropic SDK
- **Database**: MySQL (MariaDB) / PostgreSQL
- **Caching**: Redis
- **Hosting**: Docker-ready (supports VPS deployments like Coolify, Hostinger, CapRover)

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended, local setup tested on v22)
- MySQL / MariaDB (e.g. via XAMPP) or Docker

### Local Installation

1. Clone or copy this repository.
2. Initialize environment configurations:
   - In `backend/`: Copy `.env.example` to `.env` and configure your database URL (`mysql://root:@localhost:3306/genverce`).
   - In `frontend/`: Copy `.env.example` to `.env.local`.
3. In `backend/`:
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   npm run prisma:seed
   ```
4. In `frontend/`:
   ```bash
   npm install
   ```

### Running the Services

- **Backend Dev Server**: Run `npm run start:dev` inside `backend/` (listens on `http://localhost:4000`).
- **Frontend Dev Server**: Run `npm run dev` inside `frontend/` (listens on `http://localhost:3000`).

---

## VPS Deployment (Docker & Coolify)

Both backend and frontend are Docker-compatible and include production-grade `Dockerfile`s configured for multi-stage alpine builds. 

To deploy using **Coolify** on Hostinger or any VPS:
1. Push this repository to GitHub.
2. In Coolify, create a **New Resource** -> **Private Repository** or **Public Repository**.
3. Select your repository.
4. **Backend deployment**:
   - Set the build pack to **Dockerfile**.
   - Set the Dockerfile directory/path to `./backend/Dockerfile` or point the service base path to `./backend`.
   - Expose port `4000`.
5. **Frontend deployment**:
   - Set the build pack to **Dockerfile**.
   - Set the Dockerfile directory/path to `./frontend/Dockerfile` or point the service base path to `./frontend`.
   - Expose port `3000`.
