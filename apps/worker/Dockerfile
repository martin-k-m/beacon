# Beacon worker — multi-stage image.
#
# IMPORTANT: build with the *monorepo root* as the context so the workspace
# packages (@beacon/analytics, @beacon/database, @beacon/shared, …) resolve:
#
#   docker build -f apps/worker/Dockerfile -t beacon-worker .
#
# ---- Stage 1: build ---------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Copy the workspace manifests first for better layer caching.
COPY package.json package-lock.json* turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker

# Install all workspace dependencies (dev deps needed to compile TypeScript).
RUN npm install

# Build @beacon/worker and everything it depends on (analytics, database, …).
# `...` expands the filter to include the target's workspace dependencies, and
# @beacon/database's build runs `prisma generate` as part of its own script.
RUN npx turbo run build --filter=@beacon/worker...

# ---- Stage 2: runtime -------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy the installed dependencies (including generated Prisma client/engines)
# and the compiled output for the worker and its workspace deps.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json

CMD ["node", "apps/worker/dist/index.js"]
