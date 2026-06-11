# syntax=docker/dockerfile:1

# Build stage
# NOTE: upstream used dhi.io/node:20-debian13-dev (Docker Hardened Images —
# subscription-gated, returns 401 when building a fork). Swapped to the public
# Debian 13 (trixie) Node image so anyone can clone and build.
# Node 22 (LTS) is required: Nuxt 4.4.6+ dropped Node 20 (engines node >=22.12).
# See docs/skylite-ux-review.md.
FROM --platform=$BUILDPLATFORM node:22-trixie AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install system dependencies and npm packages.
# npm@11: node:22-trixie ships npm 10.9.x, which errors EBADPLATFORM on the
# optional cross-platform native bindings (rolldown/oxc) that npm 11 records in
# the lockfile and correctly skips. Match the lockfile's generator.
RUN apt-get update -y && apt-get install -y openssl && \
    npm install -g npm@11 && \
    npm ci && \
    rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:22-trixie AS production

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Set working directory
WORKDIR /app

# Copy prisma directory for migrations
COPY prisma ./prisma/

# Copy package-lock.json to extract Prisma version
COPY package-lock.json ./package-lock.json

# Install system dependencies and Prisma CLI
RUN apt-get update -y && apt-get install -y openssl && \
    PRISMA_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") && \
    npm install -g prisma@${PRISMA_VERSION} && \
    rm package-lock.json && \
    rm -rf /var/lib/apt/lists/*

# Copy built application from builder stage
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose the port the app runs on
EXPOSE 3000

# Initialize database and start application
CMD ["sh", "-c", "npx prisma migrate deploy && node .output/server/index.mjs"]