# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

ENV NODE_ENV=development

# Install compilation tools needed for native packages (e.g. bcrypt)
RUN apk add --no-cache make gcc g++ python3

# Copy package descriptors
COPY package*.json ./

# Install all dependencies (development + production)
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and config files
COPY . .

# Build NestJS application
RUN npm run build

# Production Stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package descriptors
COPY package*.json ./

# Install production dependencies only
RUN apk add --no-cache make gcc g++ python3 \
    && npm ci --only=production \
    && npm cache clean --force \
    && apk del make gcc g++ python3

# Copy generated Prisma Client from build stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy compilation output and assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose backend port
EXPOSE 4000

# Run NestJS server
CMD ["node", "dist/main"]
