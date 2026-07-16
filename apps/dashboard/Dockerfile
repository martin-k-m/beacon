# Multi-stage build for the Beacon analytics dashboard (Next.js).
# Build context is the monorepo ROOT: `docker build -f apps/dashboard/Dockerfile .`
# (docker-compose sets this automatically).

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --- Install dependencies (whole workspace, for @beacon/* linking) ---
FROM base AS deps
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/cli/package.json ./apps/cli/package.json
RUN npm ci

# --- Build ---
FROM base AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx turbo run build --filter=@beacon/dashboard...

# --- Runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
COPY --from=build /app ./
EXPOSE 3001
WORKDIR /app/apps/dashboard
CMD ["npm", "run", "start"]
