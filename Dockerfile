# ──────────────────────────────────────────────────────────────────
# Stage 1: Dependencies
# ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
# to understand why libc6-compat is needed.
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package manifests from the frontend sub-directory.
COPY frontend/package.json frontend/package-lock.json ./
# Preserve JSR registry config so @creit-tech/stellar-wallets-kit resolves correctly.
COPY frontend/.npmrc ./

RUN npm ci --ignore-scripts --legacy-peer-deps

# ──────────────────────────────────────────────────────────────────
# Stage 2: Builder
# ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy installed node_modules from the deps stage.
COPY --from=deps /app/node_modules ./node_modules

# Copy all frontend source files.
COPY frontend/ .

# Disable Next.js telemetry during build.
ENV NEXT_TELEMETRY_DISABLED=1

# Build arguments that become NEXT_PUBLIC_ env vars at build time.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SOROBAN_CONTRACT_ID
ARG NEXT_PUBLIC_STELLAR_NETWORK=testnet

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SOROBAN_CONTRACT_ID=$NEXT_PUBLIC_SOROBAN_CONTRACT_ID \
    NEXT_PUBLIC_STELLAR_NETWORK=$NEXT_PUBLIC_STELLAR_NETWORK

RUN npm run build

# ──────────────────────────────────────────────────────────────────
# Stage 3: Runner (minimal production image)
# ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Create a non-root user for security.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Copy only what's needed to run the server.
COPY --from=builder /app/public ./public

# Leverage Next.js standalone output for the smallest possible image.
# Requires `output: 'standalone'` in next.config.ts (see README).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Start the Next.js server.
CMD ["node", "server.js"]
