# Beacon API — multi-stage image.
#
# IMPORTANT: build with the *monorepo root* as the context so the workspace
# packages (@beacon/analytics, @beacon/database, @beacon/config) resolve:
#
#   docker build -f apps/api/Dockerfile -t beacon-api .
#
# ---- Stage 1: build ---------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Copy the workspace manifests first for better layer caching.
COPY package.json package-lock.json* turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install all workspace dependencies (dev deps needed to compile TypeScript).
RUN npm install

# Build @beacon/api and everything it depends on (core, database).
# `...` expands the filter to include the target's workspace dependencies, and
# @beacon/database's build runs `prisma generate` as part of its own script.
RUN npx turbo run build --filter=@beacon/api...

# ---- Stage 2: runtime -------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy the installed dependencies (including generated Prisma client/engines)
# and the compiled output for the api and its workspace deps.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
